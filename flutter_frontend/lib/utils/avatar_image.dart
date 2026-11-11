import 'package:flutter/painting.dart';

/// Bound decode memory without stretching portrait/landscape photos to a square.
/// Normalizes size into canonical buckets (192 / 384) so avatars across Chat List,
/// Chat Header, Message Bubbles, Contacts, and Profile Screen share a single ImageCache entry.
ResizeImage resizeAvatar(ImageProvider image, {required int size}) {
  final int canonicalSize = size <= 256 ? 192 : 384;
  return ResizeImage(
    image,
    width: canonicalSize,
    height: canonicalSize,
    policy: ResizeImagePolicy.fit,
  );
}
