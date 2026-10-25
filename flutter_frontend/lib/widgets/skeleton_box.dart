import 'package:flutter/material.dart';

/// Reserves the final content's geometry; only opacity changes while loading.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox(
      {super.key,
      this.width,
      this.height,
      this.circle = false,
      this.borderRadius = 6,
      this.color});
  final double? width;
  final double? height;
  final bool circle;
  final double borderRadius;
  final Color? color;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 1000));
  late final Animation<double> _opacity = Tween(begin: 0.5, end: 1.0)
      .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion || !TickerMode.of(context)) {
      _controller.stop();
      _controller.value = 1;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
        child: FadeTransition(
            opacity: _opacity,
            child: SizedBox(
              width: widget.width,
              height: widget.height,
              child: DecoratedBox(
                  decoration: BoxDecoration(
                color: widget.color ??
                    (Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF334155)
                        : const Color(0xFFE2E8F0)),
                shape: widget.circle ? BoxShape.circle : BoxShape.rectangle,
                borderRadius: widget.circle
                    ? null
                    : BorderRadius.circular(widget.borderRadius),
              )),
            )),
      );
}
