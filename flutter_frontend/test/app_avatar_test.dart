import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/widgets/app_avatar.dart';
import 'package:flutter_frontend/widgets/skeleton_box.dart';
import 'package:flutter_test/flutter_test.dart';

class DelayedPhoto extends ImageProvider<DelayedPhoto> {
  final image = Completer<ImageInfo>();
  @override
  Future<DelayedPhoto> obtainKey(ImageConfiguration configuration) => SynchronousFuture(this);
  @override
  ImageStreamCompleter loadImage(DelayedPhoto key, ImageDecoderCallback decode) => OneFrameImageStreamCompleter(image.future);
}

void main() {
  for (final radius in [8.0, 26.0, 44.0]) {
    testWidgets('circular placeholder and photo occupy the same slot at radius $radius', (tester) async {
      final photo = DelayedPhoto();
      await tester.pumpWidget(MaterialApp(home: Scaffold(body: Center(child:
        AppAvatar(radius: radius, backgroundImage: photo)))));
      expect(find.byType(SkeletonBox), findsOneWidget);
      final rect = tester.getRect(find.byType(AppAvatar));
      expect(tester.getRect(find.byType(SkeletonBox)), rect);
      expect(rect.size, Size.square(radius * 2));
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawColor(Colors.blue, BlendMode.src);
      final image = await recorder.endRecording().toImage(16, 32);
      photo.image.complete(ImageInfo(image: image));
      await tester.pump(); await tester.pump();
      expect(find.byType(SkeletonBox), findsNothing);
      expect(tester.getRect(find.byType(AppAvatar)), rect);
      expect(tester.widget<Image>(find.byType(Image)).fit, BoxFit.cover);
      await tester.pumpWidget(const SizedBox.shrink());
      PaintingBinding.instance.imageCache.clear();
    });
  }

  testWidgets('missing photo is a permanent initials fallback, not a loading skeleton', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: AppAvatar(child: Text('KH'))));
    expect(find.text('KH'), findsOneWidget);
    expect(find.byType(SkeletonBox), findsNothing);
  });

  testWidgets('failed photo ends loading without moving the avatar', (tester) async {
    final photo = DelayedPhoto();
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: Center(child:
      AppAvatar(radius: 26, foregroundImage: photo, child: const Text('K'))))));
    final rect = tester.getRect(find.byType(AppAvatar));
    photo.image.completeError(Exception('unavailable'));
    await tester.pump(); await tester.pump();
    expect(find.byType(SkeletonBox), findsNothing);
    expect(find.text('K'), findsOneWidget);
    expect(tester.getRect(find.byType(AppAvatar)), rect);
    await tester.pumpWidget(const SizedBox.shrink());
    PaintingBinding.instance.imageCache.clear();
  });

  testWidgets('reduced motion keeps placeholders still', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: MediaQuery(
      data: MediaQueryData(disableAnimations: true), child: SkeletonBox(width: 52, height: 52, circle: true))));
    final opacity = tester.widget<FadeTransition>(find.byType(FadeTransition).last).opacity.value;
    await tester.pump(const Duration(seconds: 2));
    expect(tester.widget<FadeTransition>(find.byType(FadeTransition).last).opacity.value, opacity);
  });
}
