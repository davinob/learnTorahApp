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
  bool _updateAvailable = false;

  @override
  void initState() {
    super.initState();
    _checkForUpdates();
  }

  Future<void> _checkForUpdates() async {
    if (!_updateService.isConfigured) return;

    final result = await _updateService.checkAndUpdate();
    print('[Main] Update result: ${result.message}');
    if (result.needsReload && mounted) {
      setState(() {
        _updateAvailable = true;
      });
    }
  }

  void _reloadWithUpdates() {
    if (webViewController != null && _updateService.hasLocalContent) {
      final path = _updateService.getIndexPath();
      if (path.startsWith('file://')) {
        webViewController!.loadUrl(
          urlRequest: URLRequest(url: WebUri(path)),
        );
      } else {
        webViewController!.loadFile(assetFilePath: path);
      }
      setState(() {
        _updateAvailable = false;
      });
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
            child: Stack(
              children: [
                _buildWebView(),
                if (_updateAvailable) _buildUpdateBanner(),
              ],
            ),
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

  Widget _buildUpdateBanner() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        color: const Color(0xFF31567F),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            const Expanded(
              child: Text(
                'Content updated! Tap to reload.',
                style: TextStyle(color: Colors.white, fontSize: 14),
              ),
            ),
            TextButton(
              onPressed: _reloadWithUpdates,
              child: const Text(
                'Reload',
                style: TextStyle(
                  color: Color(0xFF00E3FF),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white70, size: 20),
              onPressed: () => setState(() => _updateAvailable = false),
            ),
          ],
        ),
      ),
    );
  }
}
