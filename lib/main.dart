import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'update_service.dart';

Future main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await UpdateService.instance.initialize();
  runApp(MyApp());
}

class MyApp extends StatefulWidget {
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  InAppWebViewController? webViewController;
  final UpdateService _updateService = UpdateService.instance;
  String? _pendingLocalStorageRestore;
  String? _pendingReturnUrl;
  Timer? _updateTimer;

  static const _updateInterval = Duration(minutes: 15);

  @override
  void initState() {
    super.initState();
    _checkForUpdates();
    _updateTimer = Timer.periodic(_updateInterval, (_) => _checkForUpdates());
  }

  @override
  void dispose() {
    _updateTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkForUpdates() async {
    if (!_updateService.isConfigured) return;

    final result = await _updateService.checkAndUpdate();
    print('[Main] Update result: ${result.message}');
    if (result.needsReload && mounted) {
      _reloadWithUpdates();
    }
  }

  Future<void> _reloadWithUpdates() async {
    if (webViewController == null || !_updateService.hasLocalContent) return;

    final currentUrl = await webViewController!.getUrl();
    final currentUrlStr = currentUrl?.toString() ?? '';
    final basePath = _updateService.getLocalBasePath();

    final savedState = await webViewController!.evaluateJavascript(source: '''
      (function() {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          data[key] = localStorage.getItem(key);
        }
        return JSON.stringify(data);
      })();
    ''');

    _pendingLocalStorageRestore = (savedState != null && savedState != 'null') ? savedState : null;

    if (currentUrlStr.contains(basePath) && !currentUrlStr.endsWith('indexIntro.html') && !currentUrlStr.endsWith('index.html')) {
      final relativePath = currentUrlStr.substring(currentUrlStr.indexOf(basePath) + basePath.length);
      _pendingReturnUrl = 'file://$basePath$relativePath';
    } else {
      final lastVisited = await webViewController!.evaluateJavascript(
        source: 'localStorage.getItem("lastVisited")',
      );
      if (lastVisited != null && lastVisited != 'null' && lastVisited.toString().isNotEmpty) {
        final cleanPath = lastVisited.toString().replaceAll('"', '').replaceAll("'", '');
        if (cleanPath.isNotEmpty && !cleanPath.endsWith('indexIntro.html')) {
          _pendingReturnUrl = 'file://$basePath/$cleanPath';
        } else {
          _pendingReturnUrl = null;
        }
      } else {
        _pendingReturnUrl = null;
      }
    }

    await webViewController!.clearCache();

    final reloadUrl = _pendingReturnUrl ?? _updateService.getIndexPath();
    if (reloadUrl.startsWith('file://')) {
      await webViewController!.loadUrl(
        urlRequest: URLRequest(url: WebUri(reloadUrl)),
      );
    } else {
      await webViewController!.loadFile(assetFilePath: reloadUrl);
    }
    _pendingReturnUrl = null;
  }

  Future<void> _onPageFinished(InAppWebViewController controller) async {
    if (_pendingLocalStorageRestore != null) {
      final escaped = _pendingLocalStorageRestore!
          .replaceAll('\\', '\\\\')
          .replaceAll("'", "\\'");
      _pendingLocalStorageRestore = null;
      await controller.evaluateJavascript(source: '''
        (function() {
          try {
            var data = JSON.parse('$escaped');
            for (var key in data) {
              localStorage.setItem(key, data[key]);
            }
            if (typeof initClassesBasedOnCookies === 'function') {
              initClassesBasedOnCookies();
            }
          } catch(e) { console.error('Restore localStorage error:', e); }
        })();
      ''');
    }
  }

  void _goToIndex() {
    final mainIndex = _updateService.getMainIndexPath();
    if (mainIndex.startsWith('file://')) {
      webViewController?.loadUrl(
        urlRequest: URLRequest(url: WebUri(mainIndex)),
      );
    } else {
      webViewController?.loadFile(assetFilePath: mainIndex);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, result) {
            if (!didPop) _goToIndex();
          },
          child: SafeArea(
            child: _buildWebView(),
          ),
        ),
      ),
    );
  }

  Widget _buildWebView() {
    final indexPath = _updateService.getIndexPath();
    final useLocalContent = indexPath.startsWith('file://');

    final settings = InAppWebViewSettings(
      supportZoom: false,
      javaScriptEnabled: true,
      allowFileAccessFromFileURLs: true,
      allowUniversalAccessFromFileURLs: true,
      cacheEnabled: false,
      textZoom: Platform.isAndroid ? 170 : 100,
    );

    if (useLocalContent) {
      return InAppWebView(
        onWebViewCreated: (controller) => webViewController = controller,
        onLoadStop: (controller, url) => _onPageFinished(controller),
        initialUrlRequest: URLRequest(url: WebUri(indexPath)),
        initialSettings: settings,
      );
    }

    return InAppWebView(
      onWebViewCreated: (controller) => webViewController = controller,
      onLoadStop: (controller, url) => _onPageFinished(controller),
      initialFile: "assets/html/indexIntro.html",
      initialSettings: settings,
    );
  }
}
