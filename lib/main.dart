import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

Future main() async {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(new MyApp());
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => new _MyAppState();
}

class _MyAppState extends State<MyApp> {
  InAppWebViewController? webViewController;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
        home: Scaffold(
      body: WillPopScope(
        onWillPop: () async {
          webViewController!.loadFile(assetFilePath: "assets/html/index.html");

          return false;
        },
        child: SafeArea(
          child: InAppWebView(
            onWebViewCreated: (controller) => webViewController = controller,
            initialFile: "assets/html/indexIntro.html",
            initialOptions: InAppWebViewGroupOptions(
                crossPlatform: InAppWebViewOptions(
                  supportZoom: false,
                  javaScriptEnabled: true,
                ),
                android: AndroidInAppWebViewOptions(textZoom: 260)),
          ),
        ),
      ),
    ));
  }
}
