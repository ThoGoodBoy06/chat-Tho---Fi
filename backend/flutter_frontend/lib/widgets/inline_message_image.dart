import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../utils/inline_image_cache.dart';

class InlineMessageImage extends StatefulWidget {
  const InlineMessageImage({
    super.key,
    required this.messageId,
    required this.source,
    required this.cache,
    this.cacheWidth,
    this.fit,
    this.errorBuilder,
  });

  final String messageId;
  final String source;
  final InlineImageCache cache;
  final int? cacheWidth;
  final BoxFit? fit;
  final ImageErrorWidgetBuilder? errorBuilder;

  @override
  State<InlineMessageImage> createState() => _InlineMessageImageState();
}

class _InlineMessageImageState extends State<InlineMessageImage> {
  Uint8List? _bytes;
  Object? _error;
  int _decodeRevision = 0;

  @override
  void initState() {
    super.initState();
    _decodeSync();
  }

  @override
  void didUpdateWidget(covariant InlineMessageImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.messageId != oldWidget.messageId ||
        widget.source != oldWidget.source || widget.cache != oldWidget.cache) {
      _decodeSync();
    }
  }

  void _decodeSync() {
    try {
      final bytes = widget.cache.decode(
        messageId: widget.messageId,
        source: widget.source,
      );
      _bytes = bytes;
      _error = null;
    } catch (error) {
      _bytes = null;
      _error = error;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_bytes == null) {
      if (_error != null) {
        return widget.errorBuilder?.call(context, _error!, StackTrace.empty) ??
            const Icon(Icons.broken_image, color: Colors.grey);
      }
      return const SizedBox.expand();
    }
    return Image.memory(
      _bytes!,
      cacheWidth: widget.cacheWidth,
      fit: widget.fit,
      errorBuilder: widget.errorBuilder,
    );
  }
}
