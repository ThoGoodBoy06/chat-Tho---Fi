import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/widgets/account_image_warmup.dart';
import 'package:flutter_frontend/utils/avatar_image.dart';

void main() {
  const first = NetworkImage('https://example.com/avatar?v=1');
  const cover = NetworkImage('https://example.com/cover?v=1');
  const third = NetworkImage('https://example.com/friend');
  const updated = NetworkImage('https://example.com/avatar?v=2');

  testWidgets(
      'starts before tab navigation; bounds concurrent loads and deduplicates rebuilds',
      (tester) async {
    final started = <ImageProvider>[];
    final waits = <ImageProvider, Completer<void>>{};
    Future<void> load(ImageProvider image, BuildContext _) {
      started.add(image);
      return (waits[image] = Completer<void>()).future;
    }

    Future<void> show(List<ImageProvider> images) async {
      await tester.pumpWidget(
          MaterialApp(home: ImageWarmup(images: images, load: load)));
      await tester.pump();
    }

    await show([first, cover, first, third]);
    expect(started, [first, cover]);
    await show([first, cover, third]);
    expect(started, [first, cover]);
    waits[first]!.complete();
    await tester.pump();
    expect(started, [first, cover, third]);
    waits[cover]!.complete();
    waits[third]!.complete();
    await tester.pump();
    await show([first, cover, third, updated]);
    expect(started, [first, cover, third, updated]);
    waits[updated]!.complete();
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'offline does not start loads; failures retry on reconnect and never block the queue',
      (tester) async {
    final started = <ImageProvider>[];
    Future<void> load(ImageProvider image, BuildContext _) async {
      started.add(image);
      if (image == first) throw StateError('offline image');
    }

    Future<void> show(bool online) async {
      await tester.pumpWidget(MaterialApp(
          home: ImageWarmup(
              images: const [first, cover, third],
              enabled: online,
              load: load)));
      await tester.pump();
    }

    await show(false);
    expect(started, isEmpty);
    await show(true);
    expect(started, [first, cover, third]);
    await show(true);
    expect(started.length, 3);
    await show(false);
    await show(true);
    expect(started, [first, cover, third, first]);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'dispose and account replacement do not continue stale queued downloads',
      (tester) async {
    final started = <ImageProvider>[];
    final wait = Completer<void>();
    Future<void> load(ImageProvider image, BuildContext _) {
      started.add(image);
      return wait.future;
    }

    await tester.pumpWidget(MaterialApp(
        home: ImageWarmup(images: const [first, cover, third], load: load)));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    wait.complete();
    await tester.pump();
    expect(started, [first, cover]);
    expect(tester.takeException(), isNull);
  });

  test('warm images share the exact displayed profile cache keys', () async {
    const configuration = ImageConfiguration(devicePixelRatio: 3);
    const avatar = NetworkImage('https://example.com/me');
    expect(await resizeAvatar(avatar, size: 384).obtainKey(configuration),
        await resizeAvatar(avatar, size: 92 * 3).obtainKey(configuration));
    expect(await resizeAvatar(avatar, size: 192).obtainKey(configuration),
        await resizeAvatar(avatar, size: 52 * 3).obtainKey(configuration));
    expect(await profileCoverImage(cover.url).obtainKey(configuration),
        await ResizeImage(cover, width: 1200).obtainKey(configuration));
  });
}
