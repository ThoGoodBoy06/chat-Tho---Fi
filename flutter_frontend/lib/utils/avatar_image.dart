import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

/// Bound decode memory without stretching portrait/landscape photos to a square.
/// On Flutter Web CanvasKit, ResizeImage forces a synchronous GPU readPixels() +
/// CPU PNG encode/re-decode stall on the main thread; our backend already serves
/// resized WebP avatars (<=384px), so return the provider directly on web.
ImageProvider resizeAvatar(ImageProvider image, {required int size}) {
  if (kIsWeb) return image;
  final int canonicalSize = size <= 256 ? 192 : 384;
  return ResizeImage(
    image,
    width: canonicalSize,
    height: canonicalSize,
    policy: ResizeImagePolicy.fit,
  );
}
