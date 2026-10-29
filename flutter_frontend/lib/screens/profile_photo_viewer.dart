import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A separate route keeps zooming and full-size images out of the profile layout.
class ProfilePhotoViewer extends StatefulWidget {
  const ProfilePhotoViewer(
      {super.key, required this.image, required this.title});
  final ImageProvider image;
  final String title;

  @override
  State<ProfilePhotoViewer> createState() => _ProfilePhotoViewerState();
}

class _ProfilePhotoViewerState extends State<ProfilePhotoViewer> {
  int _attempt = 0;

  @override
  Widget build(BuildContext context) => Focus(
        autofocus: true,
        onKeyEvent: (_, event) {
          if (event is KeyDownEvent &&
              event.logicalKey == LogicalKeyboardKey.escape) {
            Navigator.of(context).pop();
            return KeyEventResult.handled;
          }
          return KeyEventResult.ignored;
        },
        child: Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
              backgroundColor: Colors.black,
              foregroundColor: Colors.white,
              title: Text(widget.title, style: const TextStyle(fontSize: 17)),
              leading: IconButton(
                  tooltip: 'Đóng ảnh',
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop())),
          body: SafeArea(
              child: LayoutBuilder(
                  builder: (context, bounds) => InteractiveViewer(
                        minScale: 1,
                        maxScale: 5,
                        child: SizedBox(
                          width: bounds.maxWidth,
                          height: bounds.maxHeight,
                          child: Image(
                            key: ValueKey(_attempt),
                            image: widget.image,
                            fit: BoxFit.contain,
                            semanticLabel: widget.title,
                            frameBuilder: (_, child, frame, synchronous) =>
                                synchronous || frame != null
                                    ? child
                                    : const Center(
                                        child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2)),
                            errorBuilder: (_, __, ___) => Center(
                                child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                  const Icon(Icons.broken_image_outlined,
                                      color: Colors.white70, size: 36),
                                  const SizedBox(height: 12),
                                  const Text('Chưa tải được ảnh',
                                      style: TextStyle(color: Colors.white)),
                                  TextButton(
                                      onPressed: () async {
                                        await widget.image.evict();
                                        if (mounted) setState(() => _attempt++);
                                      },
                                      child: const Text('Thử lại',
                                          style:
                                              TextStyle(color: Colors.white))),
                                ])),
                          ),
                        ),
                      ))),
        ),
      );
}
