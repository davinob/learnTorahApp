import 'dart:convert';
import 'package:http/http.dart' as http;

import '../update_service.dart';

/// Result of a PR creation attempt.
class PrResult {
  final bool success;
  final String? url;
  final String? error;
  final int? number;

  PrResult.success(this.url, this.number)
      : success = true,
        error = null;
  PrResult.failure(this.error)
      : success = false,
        url = null,
        number = null;
}

/// One file edit: relative path under assets/html (e.g. 'Bereshit/1.html')
/// + the new full file content.
class FileEdit {
  final String relativePath;
  final String newContent;
  FileEdit(this.relativePath, this.newContent);
}

/// Creates a branch, commits the edits, and opens a PR against `master`.
/// `master` is expected to be branch-protected so this token cannot push
/// to it directly even if it tried.
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

  /// Implements the 7-step PR flow:
  ///   1. GET base ref     -> baseSha
  ///   2. POST a blob      -> blobSha (per file)
  ///   3. POST a new tree  -> treeSha (with one entry per file)
  ///   4. POST a commit    -> commitSha
  ///   5. POST a new ref   -> refs/heads/admin-edit/<ts>-<slug>
  ///   6. POST a pull req  -> PR url
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
      final commitSha =
          (json.decode(newCommitResp.body) as Map)['sha'] as String;

      // Step 5: branch
      final branchName = _branchName(title);
      final refCreateResp = await http.post(
        Uri.parse('$_api/git/refs'),
        headers: _headers,
        body: json.encode({
          'ref': 'refs/heads/$branchName',
          'sha': commitSha,
        }),
      );
      if (refCreateResp.statusCode != 201) {
        return PrResult.failure(
            'Failed to create branch $branchName: ${_shortBody(refCreateResp)}');
      }

      // Step 6: pull request
      final prResp = await http.post(
        Uri.parse('$_api/pulls'),
        headers: _headers,
        body: json.encode({
          'title': title,
          'head': branchName,
          'base': baseBranch,
          'body': body ??
              'Submitted from the in-app admin editor.\n\n'
                  'Files changed:\n${edits.map((e) => '- ${e.relativePath}').join('\n')}',
          'maintainer_can_modify': true,
        }),
      );
      if (prResp.statusCode != 201) {
        return PrResult.failure('Failed to open PR: ${_shortBody(prResp)}');
      }
      final pr = json.decode(prResp.body) as Map<String, dynamic>;
      return PrResult.success(
        pr['html_url'] as String?,
        pr['number'] as int?,
      );
    } catch (e) {
      return PrResult.failure('Unexpected error: $e');
    }
  }

  String _commitMessage(String title, List<FileEdit> edits) {
    final paths = edits.map((e) => e.relativePath).join(', ');
    return '$title\n\nIn-app admin edit affecting: $paths';
  }

  String _branchName(String title) {
    final ts = DateTime.now().millisecondsSinceEpoch;
    final slug = title
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
        .replaceAll(RegExp(r'^-+|-+$'), '');
    final shortSlug = slug.isEmpty
        ? 'edit'
        : (slug.length > 40 ? slug.substring(0, 40) : slug);
    return 'admin-edit/$ts-$shortSlug';
  }

  String _shortBody(http.Response r) {
    final body = r.body;
    return body.length > 300 ? '${body.substring(0, 300)}...' : body;
  }
}
