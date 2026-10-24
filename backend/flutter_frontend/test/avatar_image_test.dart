import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/utils/avatar_image.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  for (final size in [const ui.Size(240, 120), const ui.Size(120, 240), const ui.Size(120, 120)]) {
    test('avatar decode preserves ${size.width}x${size.height} proportions', () async {
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      canvas.drawColor(const ui.Color(0xFF007AFF), ui.BlendMode.src);
      final picture = recorder.endRecording();
      final original = await picture.toImage(size.width.toInt(), size.height.toInt());
      final bytes = await original.toByteData(format: ui.ImageByteFormat.png);
      final provider = resizeAvatar(MemoryImage(bytes!.buffer.asUint8List()), size: 104);
      final stream = provider.resolve(ImageConfiguration.empty);
      final result = Completer<ImageInfo>();
      final listener = ImageStreamListener((info, _) => result.complete(info), onError: result.completeError);
      stream.addListener(listener);
      final decoded = await result.future;
      expect(decoded.image.width / decoded.image.height, size.width / size.height);
      expect(decoded.image.width, lessThanOrEqualTo(104));
      expect(decoded.image.height, lessThanOrEqualTo(104));
      stream.removeListener(listener);
      decoded.dispose(); original.dispose(); picture.dispose();
    });
  }
}
