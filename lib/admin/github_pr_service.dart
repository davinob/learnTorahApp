import 'dart:convert';
import 'package:http/http.dart' as http;

import '../update_service.dart';

/// Result of a commit-push attempt.
///
/// `url` is the public GitHub URL for the new commit (or `null` if the
/// push failed). `commitSha` is the full SHA of the new commit, also
/// `null` on failure. `error` carries a human-readable message in the
/// failure case.
class PrResult {
  final bool success;
  final String? url;
  final String? error;
  final String? commitSha;

  PrResult.success(this.url, this.commitSha)
      : success = true,
        error = null;
  PrResult.failure(this.error)
      : success = false,
        url = null,
        commitSha = null;
}

/// One file edit: relative path under assets/html (e.g. 'Bereshit/1.html')
/// + the new full file content.
class FileEdit {
  final String relativePath;
  final String newContent;
  FileEdit(this.relativePath, this.newContent);
}

/// Commits the edits and pushes the new commit directly onto `master`.
///
/// The token therefore needs **Contents: Read and write** plus permission
/// to push to `master` (i.e. either no branch protection, or the token's
/// account is allowed to bypass it). PR scopes are no longer required.
class GithubPrService {
  final String token;
  final String owner;
  final String repo;
  final String baseBranch;

  GithubPrService({
    required this.token,
    String? owner,
    String? repo,
    String? baseBranch,
  })  : owner = owner ?? UpdateConfig.owner,
        repo = repo ?? UpdateConfig.repo,
        baseBranch = baseBranch ?? UpdateConfig.branch;

  Map<String, String> get _headers => {
        'Authorization': 'Bearer $token',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      };

  String get _api => 'https://api.github.com/repos/$owner/$repo';

  /// Verifies the token can read this repo. Useful for the "Test token" button.
  Future<String?> verifyToken() async {
    try {
      final r = await http.get(Uri.parse(_api), headers: _headers);
      if (r.statusCode == 200) return null;
      return 'GitHub returned ${r.statusCode}: ${_shortBody(r)}';
    } catch (e) {
      return 'Network error: $e';
    }
  }

  /// Implements the 5-step direct-commit flow:
  ///   1. GET  /git/ref/heads/master   -> baseSha (current HEAD)
  ///   2. POST /git/blobs              -> blobSha (per file)
  ///   3. POST /git/trees              -> treeSha (one entry per file, on top of base tree)
  ///   4. POST /git/commits            -> commitSha
  ///   5. PATCH /git/refs/heads/master -> fast-forward master to commitSha
  ///
  /// Step 5 fails with 422 if branch protection blocks the push or if
  /// master moved while we were composing the commit; the error is
  /// surfaced verbatim so the user can fix it (e.g. pull and retry).
  Future<PrResult> submitEdit({
    required List<FileEdit> edits,
    required String title,
    String? body,
  }) async {
    if (edits.isEmpty) {
      return PrResult.failure('No edits to submit.');
    }
    try {
      // Step 1: base ref
      final refResp = await http.get(
        Uri.parse('$_api/git/ref/heads/$baseBranch'),
        headers: _headers,
      );
      if (refResp.statusCode != 200) {
        return PrResult.failure(
            'Could not fetch base ref ($baseBranch): ${_shortBody(refResp)}');
      }
      final baseSha = (json.decode(refResp.body)['object']
          as Map<String, dynamic>)['sha'] as String;

      // Need the base commit's tree for step 3.
      final commitResp = await http.get(
        Uri.parse('$_api/git/commits/$baseSha'),
        headers: _headers,
      );
      if (commitResp.statusCode != 200) {
        return PrResult.failure(
            'Could not fetch base commit: ${_shortBody(commitResp)}');
      }
      final baseTreeSha = ((json.decode(commitResp.body) as Map)['tree']
          as Map)['sha'] as String;

      // Step 2: one blob per file
      final treeEntries = <Map<String, dynamic>>[];
      for (final edit in edits) {
        final blobResp = await http.post(
          Uri.parse('$_api/git/blobs'),
          headers: _headers,
          body: json.encode({
            'content': base64.encode(utf8.encode(edit.newContent)),
            'encoding': 'base64',
          }),
        );
        if (blobResp.statusCode != 201) {
          return PrResult.failure(
              'Failed to create blob for ${edit.relativePath}: ${_shortBody(blobResp)}');
        }
        final blobSha = (json.decode(blobResp.body) as Map)['sha'] as String;
        treeEntries.add({
          'path': '${UpdateConfig.htmlPath}/${edit.relativePath}',
          'mode': '100644',
          'type': 'blob',
          'sha': blobSha,
        });
      }

      // Step 3: tree
      final treeResp = await http.post(
        Uri.parse('$_api/git/trees'),
        headers: _headers,
        body: json.encode({
          'base_tree': baseTreeSha,
          'tree': treeEntries,
        }),
      );
      if (treeResp.statusCode != 201) {
        return PrResult.failure('Failed to create tree: ${_shortBody(treeResp)}');
      }
      final treeSha = (json.decode(treeResp.body) as Map)['sha'] as String;

      // Step 4: commit
      final commitMessage = _commitMessage(title, edits);
      final newCommitResp = await http.post(
        Uri.parse('$_api/git/commits'),
        headers: _headers,
        body: json.encode({
          'message': commitMessage,
          'tree': treeSha,
          'parents': [baseSha],
        }),
      );
      if (newCommitResp.statusCode != 201) {
        return PrResult.failure(
            'Failed to create commit: ${_shortBody(newCommitResp)}');
      }
      final newCommit = json.decode(newCommitResp.body) as Map<String, dynamic>;
      final commitSha = newCommit['sha'] as String;

      // Step 5: fast-forward master to the new commit.
      // Use force=false so we never overwrite history if master moved
      // between step 1 and now; the user gets a clear 422 in that case.
      final updateRefResp = await http.patch(
        Uri.parse('$_api/git/refs/heads/$baseBranch'),
        headers: _headers,
        body: json.encode({
          'sha': commitSha,
          'force': false,
        }),
      );
      if (updateRefResp.statusCode != 200) {
        return PrResult.failure(
            'Failed to push to $baseBranch: ${_shortBody(updateRefResp)}');
      }

      // Prefer the html_url returned by the commit endpoint; fall back
      // to the well-known commit URL pattern if it's missing.
      final url = (newCommit['html_url'] as String?) ??
          'https://github.com/$owner/$repo/commit/$commitSha';
      return PrResult.success(url, commitSha);
    } catch (e) {
      return PrResult.failure('Unexpected error: $e');
    }
  }

  String _commitMessage(String title, List<FileEdit> edits) {
    final paths = edits.map((e) => e.relativePath).join(', ');
    return '$title\n\nIn-app admin edit affecting: $paths';
  }

  String _shortBody(http.Response r) {
    final body = r.body;
    return body.length > 300 ? '${body.substring(0, 300)}...' : body;
  }
}
