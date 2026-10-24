import 'package:flutter/painting.dart';

/// Bound decode memory without stretching portrait/landscape photos to a square.
/// The avatar's BoxFit.cover performs the circular crop after decoding.
ResizeImage resizeAvatar(ImageProvider image, {required int size}) => ResizeImage(
  image, width: size, height: size, policy: ResizeImagePolicy.fit,
);
