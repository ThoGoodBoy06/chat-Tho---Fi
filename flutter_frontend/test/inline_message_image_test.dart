import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/utils/inline_image_cache.dart';
import 'package:flutter_frontend/widgets/inline_message_image.dart';

class CountingImageCache extends InlineImageCache {
  CountingImageCache() : super(maximumBytes: 1);
  int decodes = 0;

  @override
  Uint8List decode({required String messageId, required String source}) {
    decodes++;
    return super.decode(messageId: messageId, source: source);
  }
}

class DeferredLoadingPhysics extends ScrollPhysics {
  const DeferredLoadingPhysics(this.defer, {super.parent});
  final ValueNotifier<bool> defer;
  @override
  DeferredLoadingPhysics applyTo(ScrollPhysics? ancestor) => DeferredLoadingPhysics(defer, parent: buildParent(ancestor));
  @override
  bool recommendDeferredLoading(double velocity, ScrollMetrics metrics, BuildContext context) => defer.value;
}

void main() {
  testWidgets('fast scrolling defers base64 work then loads and cancels pending retries', (tester) async {
    final cache = CountingImageCache();
    final defer = ValueNotifier(true);
    const source = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    Widget content() => MaterialApp(home: SizedBox(
      width: 300, height: 400,
      child: ListView(physics: DeferredLoadingPhysics(defer), children: [
        InlineMessageImage(messageId: 'fast', source: source, cache: cache),
      ]),
    ));
    await tester.pumpWidget(content());
    await tester.pump(const Duration(milliseconds: 120));
    expect(cache.decodes, 0);
    final reservedSize = tester.getSize(find.byType(InlineMessageImage));
    defer.value = false;
    await tester.pump(const Duration(milliseconds: 120));
    await tester.pump(const Duration(milliseconds: 100));
    expect(cache.decodes, 1);
    expect(tester.getSize(find.byType(InlineMessageImage)), reservedSize,
        reason: 'Finishing image decoding must not change the scroll geometry.');
    await tester.pumpWidget(const SizedBox.shrink());
    defer.value = true;
    await tester.pumpWidget(content());
    expect(cache.decodes, 1);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 200));
    expect(cache.decodes, 1, reason: 'Disposed images must cancel deferred work.');
    defer.dispose();
  });
  testWidgets('oversized inline image decodes once through parent rebuilds', (tester) async {
    final cache = CountingImageCache();
    const source = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    Widget content() => Directionality(
      textDirection: TextDirection.ltr,
      child: InlineMessageImage(messageId: 'a', source: source, cache: cache),
    );
    await tester.pumpWidget(content());
    await tester.pumpWidget(content());
    await tester.pumpWidget(content());
    expect(cache.decodes, 1);
    expect(cache.length, 0);
  });

  testWidgets('source changes retry decode and malformed data has a fallback', (tester) async {
    final cache = CountingImageCache();
    Widget content(String source) => Directionality(
      textDirection: TextDirection.ltr,
      child: InlineMessageImage(
        messageId: 'a', source: source, cache: cache,
        errorBuilder: (_, __, ___) => const Text('image unavailable'),
      ),
    );
    await tester.pumpWidget(content('data:image/png;base64,%%%'));
    await tester.pumpWidget(content('data:image/png;base64,%%%'));
    expect(find.text('image unavailable'), findsOneWidget);
    expect(cache.decodes, 1);
    await tester.pumpWidget(content('data:image/png;base64,???'));
    expect(cache.decodes, 2);
  });
}
