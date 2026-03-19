import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

class UpdateConfig {
  static const String owner = 'davinob';
  static const String repo = 'learnTorahApp';
  static const String branch = 'master';
  static const String htmlPath = 'assets/html';
}

class UpdateService {
  static UpdateService? _instance;
  String? _localHtmlPath;
  bool _hasLocalContent = false;

  UpdateService._();

  static UpdateService get instance {
    _instance ??= UpdateService._();
    return _instance!;
  }

  bool get hasLocalContent => _hasLocalContent;
  String? get localHtmlPath => _localHtmlPath;

  Future<void> initialize() async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      _localHtmlPath = '${dir.path}/html_content';
      final localDir = Directory(_localHtmlPath!);
      final manifestFile = File('${_localHtmlPath!}/manifest.json');
      _hasLocalContent =
          await localDir.exists() && await manifestFile.exists();
      print('[UpdateService] Initialized. hasLocalContent=$_hasLocalContent');
    } catch (e) {
      print('[UpdateService] Initialize error: $e');
    }
  }

  String getIndexPath() {
    if (_hasLocalContent) {
      return 'file://${_localHtmlPath!}/indexIntro.html';
    }
    return 'assets/html/indexIntro.html';
  }

  String getMainIndexPath() {
    if (_hasLocalContent) {
      return 'file://${_localHtmlPath!}/index.html';
    }
    return 'assets/html/index.html';
  }

  bool get isConfigured {
    return UpdateConfig.owner != 'OWNER' && UpdateConfig.repo != 'REPO_NAME';
  }

  Future<bool> _hasInternet() async {
    try {
      final result = await http
          .get(Uri.parse('https://api.github.com'))
          .timeout(const Duration(seconds: 5));
      return result.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<UpdateResult> checkAndUpdate() async {
    if (!isConfigured) {
      return UpdateResult(
          success: false, message: 'GitHub repo not configured');
    }
    if (!await _hasInternet()) {
      print('[UpdateService] No internet, skipping update check');
      return UpdateResult(success: false, message: 'No internet connection');
    }
    try {
      print('[UpdateService] Checking for updates...');
      final remoteManifest = await _fetchRemoteManifest();
      if (remoteManifest == null) {
        return UpdateResult(
            success: false, message: 'Could not fetch remote manifest');
      }
      print('[UpdateService] Remote manifest: ${remoteManifest.length} files');

      final localManifest = await _loadLocalManifest();
      final filesToUpdate = _getFilesToUpdate(remoteManifest, localManifest);

      if (filesToUpdate.isEmpty) {
        print('[UpdateService] Already up to date');
        return UpdateResult(success: true, message: 'Already up to date');
      }

      print('[UpdateService] ${filesToUpdate.length} files to update');

      if (!_hasLocalContent) {
        await _copyBundledAssets();
        await _saveBundledManifest(remoteManifest);
        final localManifestAfterCopy = await _loadLocalManifest();
        final realUpdates =
            _getFilesToUpdate(remoteManifest, localManifestAfterCopy);
        if (realUpdates.isEmpty) {
          _hasLocalContent = true;
          print('[UpdateService] Bundled content matches remote, no downloads needed');
          return UpdateResult(success: true, message: 'Already up to date');
        }
        print('[UpdateService] ${realUpdates.length} files actually changed since bundle');
        await _downloadFiles(realUpdates, remoteManifest);
      } else {
        await _downloadFiles(filesToUpdate, remoteManifest);
      }
      _hasLocalContent = true;

      print('[UpdateService] Update complete: ${filesToUpdate.length} files');
      return UpdateResult(
          success: true,
          message: 'Updated ${filesToUpdate.length} files',
          updatedCount: filesToUpdate.length,
          needsReload: true);
    } catch (e) {
      print('[UpdateService] Update error: $e');
      return UpdateResult(success: false, message: 'Update error: $e');
    }
  }

  Future<Map<String, dynamic>?> _fetchRemoteManifest() async {
    try {
      final response = await _fetchGitHubTree();
      if (response == null) return null;
      final Map<String, dynamic> manifest = {};
      final tree = response['tree'] as List;
      for (var item in tree) {
        final path = item['path'] as String;
        if (path.startsWith(UpdateConfig.htmlPath) &&
            path.length > UpdateConfig.htmlPath.length + 1) {
          final relativePath =
              path.substring(UpdateConfig.htmlPath.length + 1);
          if (item['type'] == 'blob') {
            manifest[relativePath] = {
              'sha': item['sha'],
              'size': item['size'],
              'path': path,
            };
          }
        }
      }
      return manifest;
    } catch (e) {
      print('[UpdateService] Fetch remote manifest error: $e');
      return null;
    }
  }

  Future<Map<String, dynamic>?> _fetchGitHubTree() async {
    final url =
        'https://api.github.com/repos/${UpdateConfig.owner}/${UpdateConfig.repo}/git/trees/${UpdateConfig.branch}?recursive=1';
    final response = await http
        .get(Uri.parse(url),
            headers: {'Accept': 'application/vnd.github.v3+json'})
        .timeout(const Duration(seconds: 30));
    if (response.statusCode == 200) return json.decode(response.body);
    print('[UpdateService] GitHub tree API returned ${response.statusCode}');
    return null;
  }

  Future<Map<String, dynamic>> _loadLocalManifest() async {
    final manifestFile = File('${_localHtmlPath!}/manifest.json');
    if (await manifestFile.exists()) {
      final content = await manifestFile.readAsString();
      return json.decode(content);
    }
    return {};
  }

  List<String> _getFilesToUpdate(
      Map<String, dynamic> remote, Map<String, dynamic> local) {
    final toUpdate = <String>[];
    remote.forEach((path, info) {
      final localInfo = local[path];
      if (localInfo == null || localInfo['sha'] != info['sha']) {
        toUpdate.add(path);
      }
    });
    return toUpdate;
  }

  static const List<String> _parshaFolders = [
    'Bereshit', 'Noah', 'LehLeha', 'Vayera', 'HayeSara', 'Toldot',
    'Vayetze', 'Vayishlah', 'Vayeshev', 'Miketz', 'Vayigash', 'Vayehi',
    'Shemot', 'Vaera', 'Bo', 'Beshalah', 'Yitro', 'Mishpatim',
    'Terouma', 'Tetzave', 'KiTissa', 'Vayakhel', 'Pekoudey',
    'Vayikra', 'Zav', 'Shemini', 'Tazria', 'Mezora', 'AhareiMot',
    'Kedoshim', 'Emor', 'Behar', 'Behoukotay',
    'Bamidbar', 'Nasso', 'Behaaloteha', 'ShelahLeha', 'Korah',
    'Hukat', 'Balak', 'Pinhas', 'Matot', 'Massey',
    'Devarim', 'Vaethanan', 'Ekev', 'Reeh', 'Shoftim',
    'KiTztze', 'KiTavo', 'Nizavim', 'Vayeleh', 'Haazinu',
    'VezotHaberaha',
  ];

  Future<void> _copyBundledAssets() async {
    print('[UpdateService] Copying bundled assets to local storage...');
    final baseDir = Directory(_localHtmlPath!);
    if (!await baseDir.exists()) await baseDir.create(recursive: true);

    final filesToCopy = <String>[
      'index.html', 'indexIntro.html', 'zhouiot.html',
      'total', 'listOfBooks.txt', 'allFolders.txt',
      'css/stylesTorah.css', 'js/myScript.js',
    ];

    for (var folder in _parshaFolders) {
      for (var i = 1; i <= 8; i++) {
        filesToCopy.add('$folder/$i.html');
      }
    }

    var copied = 0;
    for (var relativePath in filesToCopy) {
      try {
        final data = await rootBundle.load('assets/html/$relativePath');
        final localFile = File('${_localHtmlPath!}/$relativePath');
        await localFile.parent.create(recursive: true);
        await localFile.writeAsBytes(data.buffer.asUint8List());
        copied++;
      } catch (_) {}
    }
    print('[UpdateService] Copied $copied bundled files');
  }

  Future<void> _saveBundledManifest(Map<String, dynamic> remoteManifest) async {
    final manifest = <String, dynamic>{};
    for (var entry in remoteManifest.entries) {
      final localFile = File('${_localHtmlPath!}/${entry.key}');
      if (await localFile.exists()) {
        manifest[entry.key] = entry.value;
      }
    }
    final manifestFile = File('${_localHtmlPath!}/manifest.json');
    await manifestFile.writeAsString(json.encode(manifest));
    print('[UpdateService] Saved bundled manifest for ${manifest.length} files');
  }

  Future<void> _downloadFiles(
      List<String> files, Map<String, dynamic> manifest) async {
    final baseDir = Directory(_localHtmlPath!);
    if (!await baseDir.exists()) await baseDir.create(recursive: true);

    var downloaded = 0;
    var failed = 0;

    for (var relativePath in files) {
      final info = manifest[relativePath];
      final fullGitPath = info['path'] as String;
      final rawUrl =
          'https://raw.githubusercontent.com/${UpdateConfig.owner}/${UpdateConfig.repo}/${UpdateConfig.branch}/$fullGitPath';
      try {
        final response = await http
            .get(Uri.parse(rawUrl))
            .timeout(const Duration(seconds: 15));
        if (response.statusCode == 200) {
          final localFile = File('${_localHtmlPath!}/$relativePath');
          await localFile.parent.create(recursive: true);
          await localFile.writeAsBytes(response.bodyBytes);
          downloaded++;
        } else {
          failed++;
          print('[UpdateService] HTTP ${response.statusCode} for $relativePath');
        }
      } catch (e) {
        failed++;
        print('[UpdateService] Failed to download $relativePath: $e');
      }
    }

    print('[UpdateService] Downloaded: $downloaded, Failed: $failed');

    final manifestFile = File('${_localHtmlPath!}/manifest.json');
    final existingManifest = await _loadLocalManifest();
    for (var relativePath in files) {
      if (manifest.containsKey(relativePath)) {
        existingManifest[relativePath] = manifest[relativePath];
      }
    }
    await manifestFile.writeAsString(json.encode(existingManifest));
  }

  Future<void> clearLocalContent() async {
    final dir = Directory(_localHtmlPath!);
    if (await dir.exists()) await dir.delete(recursive: true);
    _hasLocalContent = false;
    print('[UpdateService] Local content cleared');
  }
}

class UpdateResult {
  final bool success;
  final String message;
  final int updatedCount;
  final bool needsReload;

  UpdateResult({
    required this.success,
    required this.message,
    this.updatedCount = 0,
    this.needsReload = false,
  });
}
