import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'update_service.dart';

/// Serves page HTML to the JS search, which cannot read it for itself.
///
/// The pages are loaded from file:// (either the downloaded content in the app
/// documents directory or the bundled copy), and Chromium blocks cross-file
/// XMLHttpRequest regardless of the WebView's file-access settings — those were
/// deprecated and are ignored for apps targeting SDK 30+. Without this, a
/// search can only see the page the user is already on: the global search on
/// the index page finds nothing at all, and the search inside a section reports
/// hits only for the page being read.
///
/// Used by `fetchPageText()` in `assets/html/js/myScript.js`, which passes the
/// page path resolved against `location.href` and falls back to a plain request
/// when no bridge is present (i.e. on the website).
class ContentReader {
  static const String handlerName = 'readContentFile';

  /// Marks where the bundled copy starts inside an asset file:// path, e.g.
  /// `file:///android_asset/flutter_assets/assets/html/Kedoshim/1.html`.
  static const String _assetRoot = 'assets/html/';

  void register(InAppWebViewController controller) {
    controller.addJavaScriptHandler(
      handlerName: handlerName,
      callback: (args) async {
        final requested = args.isNotEmpty ? args[0] as String? : null;
        if (requested == null || requested.isEmpty) return null;
        return _read(requested);
      },
    );
  }

  Future<String?> _read(String requestedPath) async {
    try {
      final path = Uri.decodeFull(requestedPath);

      // The path comes from the page, so never let it walk out of the content
      // root into the rest of the sandbox.
      if (path.contains('..')) {
        debugPrint('[ContentReader] rejected traversal: $path');
        return null;
      }

      final localRoot = UpdateService.instance.localHtmlPath;
      if (UpdateService.instance.hasLocalContent &&
          localRoot != null &&
          path.startsWith(localRoot)) {
        final file = File(path);
        if (await file.exists()) return await file.readAsString();
        debugPrint('[ContentReader] missing downloaded file: $path');
        return null;
      }

      // Running off the bundled copy: turn the file:// path back into the
      // asset key rootBundle expects.
      final assetStart = path.indexOf(_assetRoot);
      if (assetStart != -1) {
        return await rootBundle.loadString(path.substring(assetStart));
      }

      debugPrint('[ContentReader] path outside content root: $path');
      return null;
    } catch (e) {
      debugPrint('[ContentReader] read failed for $requestedPath: $e');
      return null;
    }
  }
}
