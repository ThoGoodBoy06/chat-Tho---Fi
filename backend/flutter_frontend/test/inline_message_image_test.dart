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

void main() {
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
