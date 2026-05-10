import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'admin/admin_bridge.dart';
import 'update_service.dart';

class _GitHubCertOverrides extends HttpOverrides {
  static const _trustedHosts = [
    'raw.githubusercontent.com',
    'api.github.com',
    'github.com',
  ];

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (cert, host, port) =>
          _trustedHosts.contains(host);
  }
}

Future main() async {
  WidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = _GitHubCertOverrides();
  await UpdateService.instance.initialize();
  runApp(MyApp());
}

class MyApp extends StatefulWidget {
  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  InAppWebViewController? webViewController;
  final UpdateService _updateService = UpdateService.instance;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  late final AdminBridge _adminBridge =
      AdminBridge(navigatorKey: _navigatorKey);
  Timer? _updateTimer;
  bool _initialSyncDone = false;

  /// Stable key so Flutter reuses the same native InAppWebView across
  /// rebuilds (keyboard show/hide, text-selection menu, etc.) instead
  /// of destroying it and reloading the page mid-edit.
  final GlobalKey _webViewKey = GlobalKey();

  /// Memoized widget so build() always returns the SAME instance.
  Widget? _cachedLocalWebView;
  Widget? _cachedAssetWebView;

  static const _updateInterval = Duration(minutes: 5);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initialSyncDone = _updateService.hasLocalContent;
    _checkForUpdates();
    _updateTimer = Timer.periodic(_updateInterval, (_) => _checkForUpdates());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkForUpdates();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _updateTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkForUpdates() async {
    if (!_updateService.isConfigured) return;

    if (AdminBridge.isSessionUnlocked) {
      debugPrint('[Main] Skipping update check: admin session is active');
      return;
    }

    final result = await _updateService.checkAndUpdate();
    debugPrint('[Main] Update result: ${result.message}');

    if (!_initialSyncDone && _updateService.hasLocalContent && mounted) {
      _initialSyncDone = true;
      final indexPath = _updateService.getIndexPath();
      debugPrint('[Main] Initial sync complete, loading $indexPath');
      webViewController?.loadUrl(
        urlRequest: URLRequest(url: WebUri(indexPath)),
      );
    } else if (result.needsReload && _initialSyncDone && mounted) {
      debugPrint('[Main] Reloading WebView after update');
      webViewController?.reload();
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
      navigatorKey: _navigatorKey,
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
      // Kills the Translate / Copy / Share popup that breaks active edits
      // by causing the underlying native WebView to be torn down.
      disableContextMenu: true,
    );

    if (useLocalContent) {
      return _cachedLocalWebView ??= InAppWebView(
        key: _webViewKey,
        onWebViewCreated: (controller) {
          webViewController = controller;
          _adminBridge.register(controller);
        },
        onConsoleMessage: _onConsoleMessage,
        onLoadStart: _onLoadStart,
        onLoadStop: _onLoadStop,
        initialUrlRequest: URLRequest(url: WebUri(indexPath)),
        initialSettings: settings,
      );
    }

    return _cachedAssetWebView ??= InAppWebView(
      key: _webViewKey,
      onWebViewCreated: (controller) {
        webViewController = controller;
        _adminBridge.register(controller);
      },
      onConsoleMessage: _onConsoleMessage,
      onLoadStart: _onLoadStart,
      onLoadStop: _onLoadStop,
      initialFile: "assets/html/indexIntro.html",
      initialSettings: settings,
    );
  }

  void _onConsoleMessage(
      InAppWebViewController controller, ConsoleMessage msg) {
    debugPrint('[webview ${msg.messageLevel}] ${msg.message}');
  }

  void _onLoadStart(InAppWebViewController controller, WebUri? url) {
    debugPrint('[Main] WebView LOAD START: $url'
        ' adminActive=${AdminBridge.isSessionUnlocked}');
  }

  void _onLoadStop(InAppWebViewController controller, WebUri? url) {
    debugPrint('[Main] WebView LOAD STOP : $url');
  }
}
