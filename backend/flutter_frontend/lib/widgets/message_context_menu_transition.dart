import 'package:flutter/material.dart';

/// Animate a cached menu subtree, without filtering or scaling the chat behind it.
class MessageContextMenuTransition extends StatelessWidget {
  final Animation<double> animation;
  final Alignment alignment;
  final Widget child;

  const MessageContextMenuTransition({
    super.key,
    required this.animation,
    required this.alignment,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.of(context).disableAnimations) return child;
    return AnimatedBuilder(
      animation: animation,
      child: RepaintBoundary(child: child),
      builder: (context, cachedChild) {
        final closing = animation.status == AnimationStatus.reverse;
        final progress = (closing ? Curves.easeInCubic : Curves.easeOutCubic)
            .transform(animation.value);
        return Opacity(
          opacity: progress,
          child: Transform.translate(
            offset: Offset(0, 8 * (1 - progress)),
            child: Transform.scale(
              alignment: alignment,
              scale: 0.97 + 0.03 * progress,
              child: cachedChild,
            ),
          ),
        );
      },
    );
  }
}
