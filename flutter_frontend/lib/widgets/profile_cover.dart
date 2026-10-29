import 'package:flutter/material.dart';
import 'skeleton_box.dart';

/// Keep the same banner geometry for every photo, including tall uploads.
class ProfileCover extends StatelessWidget {
  const ProfileCover(
      {super.key,
      required this.image,
      required this.fallback,
      required this.avatar,
      required this.editControl});
  final ImageProvider image;
  final Widget fallback, avatar, editControl;

  @override
  Widget build(BuildContext context) =>
      LayoutBuilder(builder: (context, constraints) {
        final height =
            (constraints.maxWidth / 2).clamp(160.0, 240.0).toDouble();
        return SizedBox(
            width: constraints.maxWidth,
            height: height,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.bottomCenter,
              children: [
                Image(
                    image: image,
                    width: double.infinity,
                    height: height,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                    frameBuilder: (_, child, frame, synchronous) =>
                        synchronous || frame != null
                            ? child
                            : const SkeletonBox(borderRadius: 0),
                    errorBuilder: (_, __, ___) => fallback),
                Positioned(bottom: 12, right: 12, child: editControl),
                Positioned(bottom: -44, child: avatar),
              ],
            ));
      });
}
