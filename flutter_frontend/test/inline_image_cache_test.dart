import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/utils/inline_image_cache.dart';

String imageData(List<int> bytes) => 'data:image/png;base64,' + base64Encode(bytes);

void main() {
  test('rebuilds reuse bytes and changed source invalidates them', () {
    final cache = InlineImageCache();
    final source = imageData([1, 2, 3]);
    final bytes = cache.decode(messageId: 'a', source: source);
    expect(identical(bytes, cache.decode(messageId: 'a', source: source)), isTrue);
    final changed = cache.decode(messageId: 'a', source: imageData([4, 5, 6]));
    expect(changed, [4, 5, 6]);
    expect(identical(bytes, changed), isFalse);
    expect(cache.length, 1);
  });

  test('least recently used entries are evicted at the entry limit', () {
    final cache = InlineImageCache(maximumEntries: 2);
    final source = imageData([1, 2, 3]);
    final a = cache.decode(messageId: 'a', source: source);
    final b = cache.decode(messageId: 'b', source: source);
    cache.decode(messageId: 'a', source: source);
    cache.decode(messageId: 'c', source: source);
    expect(cache.length, 2);
    expect(identical(a, cache.decode(messageId: 'a', source: source)), isTrue);
    expect(identical(b, cache.decode(messageId: 'b', source: source)), isFalse);
  });

  test('source and byte retention are bounded and clear releases entries', () {
    final source = imageData([1, 2, 3]);
    final entryCost = source.length * 2 + 3;
    final cache = InlineImageCache(maximumBytes: entryCost);
    cache.decode(messageId: 'a', source: source);
    cache.decode(messageId: 'b', source: source);
    expect(cache.length, 1);
    expect(cache.retainedBytes, entryCost);
    cache.clear();
    expect(cache.length, 0);
    expect(cache.retainedBytes, 0);
  });

  test('oversized images display without being retained', () {
    final cache = InlineImageCache(maximumBytes: 1);
    expect(cache.decode(messageId: 'a', source: imageData([1, 2, 3])), [1, 2, 3]);
    expect(cache.length, 0);
    expect(cache.retainedBytes, 0);
  });

  test('invalid data fails without consuming cache capacity', () {
    final cache = InlineImageCache();
    expect(() => cache.decode(messageId: 'a', source: 'data:image/png;base64,%%%'),
        throwsFormatException);
    expect(cache.retainedBytes, 0);
    expect(cache.length, 0);
  });
}
