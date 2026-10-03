import 'dart:async';
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
  Timer? _deferredDecode;

  @override
  void didUpdateWidget(covariant InlineMessageImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.messageId != oldWidget.messageId ||
        widget.source != oldWidget.source || widget.cache != oldWidget.cache) {
      _deferredDecode?.cancel();
      _deferredDecode = null;
      _bytes = null;
      _error = null;
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
  void dispose() {
    _deferredDecode?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_bytes == null && _error == null) {
      if (Scrollable.recommendDeferredLoadingForContext(context)) {
        _deferredDecode ??= Timer(const Duration(milliseconds: 120), () {
          _deferredDecode = null;
          if (mounted) setState(() {});
        });
        return const SizedBox(width: 240, height: 180);
      }
      _deferredDecode?.cancel();
      _deferredDecode = null;
      _decodeSync();
    }
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
