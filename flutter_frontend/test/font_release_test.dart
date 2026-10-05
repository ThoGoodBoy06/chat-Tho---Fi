import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('release font assets are readable by Flutter and match the font manifest', () async {
    final assets = Directory('build/web/assets');
    final bytes = File('${assets.path}/AssetManifest.bin').readAsBytesSync();
    final manifest = const StandardMessageCodec().decodeMessage(ByteData.sublistView(bytes)) as Map;
    final webBytes = base64Decode(jsonDecode(File('${assets.path}/AssetManifest.bin.json').readAsStringSync()) as String);
    expect(webBytes, bytes);
    final fonts = jsonDecode(File('${assets.path}/FontManifest.json').readAsStringSync()) as List;
    final inter = fonts.singleWhere((f) => f['family'] == 'Inter');
    expect((inter['fonts'] as List).length, 8);
    final loader = FontLoader('Inter');
    for (final font in inter['fonts']) {
      final path = font['asset'] as String;
      expect((manifest[path] as List).first['asset'], path);
      final fontBytes = File('${assets.path}/$path').readAsBytesSync();
      loader.addFont(Future.value(ByteData.sublistView(fontBytes)));
    }
    await loader.load();
  });
}
