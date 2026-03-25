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

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  InAppWebViewController? webViewController;
  final UpdateService _updateService = UpdateService.instance;
  Timer? _updateTimer;
  bool _initialSyncDone = false;

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

    final result = await _updateService.checkAndUpdate();
    print('[Main] Update result: ${result.message}');

    if (!_initialSyncDone && _updateService.hasLocalContent && mounted) {
      _initialSyncDone = true;
      final indexPath = _updateService.getIndexPath();
      webViewController?.loadUrl(
        urlRequest: URLRequest(url: WebUri(indexPath)),
      );
    } else if (result.needsReload && _initialSyncDone && mounted) {
      print('[Main] Reloading WebView after update');
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
        initialUrlRequest: URLRequest(url: WebUri(indexPath)),
        initialSettings: settings,
      );
    }

    return InAppWebView(
      onWebViewCreated: (controller) => webViewController = controller,
      initialFile: "assets/html/indexIntro.html",
      initialSettings: settings,
    );
  }
}
