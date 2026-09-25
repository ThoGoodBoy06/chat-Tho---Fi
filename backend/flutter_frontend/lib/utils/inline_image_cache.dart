import 'dart:collection';
import 'dart:convert';
import 'dart:typed_data';

/// Keeps MemoryImage byte identity stable through typing and socket rebuilds.
/// Both encoded source and decoded bytes count toward the retention budget.
class InlineImageCache {
  InlineImageCache({
    this.maximumBytes = 16 * 1024 * 1024,
    this.maximumEntries = 24,
  }) : assert(maximumBytes >= 0), assert(maximumEntries >= 0);

  final int maximumBytes;
  final int maximumEntries;
  final _entries = LinkedHashMap<String, _InlineImageEntry>();
  int _retainedBytes = 0;

  int get retainedBytes => _retainedBytes;
  int get length => _entries.length;

  Uint8List decode({required String messageId, required String source}) {
    final previous = _entries.remove(messageId);
    if (previous != null) {
      _retainedBytes -= previous.retainedBytes;
      if (previous.source == source) {
        _entries[messageId] = previous;
        _retainedBytes += previous.retainedBytes;
        return previous.bytes;
      }
    }

    final separator = source.indexOf(',');
    if (separator < 0 || !source.startsWith('data:image') ||
        !source.substring(0, separator).endsWith(';base64')) {
      throw const FormatException('Expected a base64 image data URI');
    }
    final bytes = base64Decode(source.substring(separator + 1));
    final retainedBytes = source.length * 2 + bytes.lengthInBytes;
    if (maximumEntries == 0 || retainedBytes > maximumBytes) return bytes;

    while (_entries.isNotEmpty &&
        (_entries.length >= maximumEntries ||
         _retainedBytes + retainedBytes > maximumBytes)) {
      final oldest = _entries.remove(_entries.keys.first)!;
      _retainedBytes -= oldest.retainedBytes;
    }
    _entries[messageId] = _InlineImageEntry(source, bytes, retainedBytes);
    _retainedBytes += retainedBytes;
    return bytes;
  }

  void clear() {
    _entries.clear();
    _retainedBytes = 0;
  }
}

class _InlineImageEntry {
  const _InlineImageEntry(this.source, this.bytes, this.retainedBytes);

  final String source;
  final Uint8List bytes;
  final int retainedBytes;
}
