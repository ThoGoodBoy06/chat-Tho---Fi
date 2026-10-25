import 'package:flutter/material.dart';
import 'skeleton_box.dart';

/// Rectangular media keeps its final bounds through loading, decoding and errors.
class LoadingPhoto extends StatelessWidget {
  const LoadingPhoto({super.key, required this.image, required this.width,
    required this.height, this.fit = BoxFit.cover, this.fallback});
  final ImageProvider image;
  final double width, height;
  final BoxFit fit;
  final Widget? fallback;
  @override
  Widget build(BuildContext context) => SizedBox(width: width, height: height,
    child: Image(image: image, width: width, height: height, fit: fit,
      frameBuilder: (_, child, frame, synchronous) => synchronous || frame != null ? child
        : SkeletonBox(width: width, height: height, borderRadius: 0),
      errorBuilder: (_, __, ___) => fallback ?? const SizedBox.expand(),
    ));
}
