import 'package:flutter/material.dart';
import '../utils/avatar_image.dart';
import 'skeleton_box.dart';

/// A circular placeholder occupies precisely the same slot as the loaded photo.
class AppAvatar extends StatelessWidget {
  const AppAvatar(
      {super.key,
      this.radius = 20,
      this.backgroundColor,
      this.backgroundImage,
      this.foregroundImage,
      this.onForegroundImageError,
      this.overlayChild = false,
      this.child});
  final double radius;
  final Color? backgroundColor;
  final ImageProvider? backgroundImage;
  final ImageProvider? foregroundImage;
  final ImageErrorListener? onForegroundImageError;
  final bool overlayChild;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final size = radius * 2;
    final provider = foregroundImage ?? backgroundImage;
    final fallback = ColoredBox(
      color: backgroundColor ?? Theme.of(context).colorScheme.primary,
      child: Center(
          child: child ??
              Icon(Icons.person_rounded, color: Colors.white, size: radius)),
    );
    final photo = provider == null
        ? fallback
        : Image(
            image: provider is ResizeImage
                ? provider
                : resizeAvatar(provider,
                    size: (size * MediaQuery.devicePixelRatioOf(context))
                        .ceil()
                        .clamp(16, 512)
                        .toInt()),
            width: size,
            height: size,
            fit: BoxFit.cover,
            gaplessPlayback: false,
            frameBuilder: (_, image, frame, synchronous) =>
                synchronous || frame != null
                    ? image
                    : SkeletonBox(width: size, height: size, circle: true),
            errorBuilder: (_, error, stack) {
              onForegroundImageError?.call(error, stack);
              return fallback;
            },
          );
    return SizedBox.square(
        dimension: size,
        child: ClipOval(
          child: provider != null && overlayChild && child != null
              ? Stack(
                  fit: StackFit.expand, children: [photo, Center(child: child)])
              : photo,
        ));
  }
}
