import 'dart:io';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

class Utils {
  static Future<void> initData() async {
    final Directory docDir = await getApplicationDocumentsDirectory();
    final String localPath = docDir.path;
    var myAssets = await rootBundle.loadString('AssetManifest.json');
    Map<String, dynamic> map = jsonDecode(myAssets);
    for (String path in map.keys) {
      print(path);
      String dirToCreate =
          localPath + '/' + path.substring(0, path.lastIndexOf('/'));
      print("Dir to create: $dirToCreate");
      if (!await File(dirToCreate).exists()) {
        await Directory(dirToCreate).create(recursive: true);
      }
      File file = File('$localPath/$path');
      final imageBytes = await rootBundle.load('$path');
      final buffer = imageBytes.buffer;
      await file.writeAsBytes(buffer.asUint8List(
          imageBytes.offsetInBytes, imageBytes.lengthInBytes));
    }
  }
}
