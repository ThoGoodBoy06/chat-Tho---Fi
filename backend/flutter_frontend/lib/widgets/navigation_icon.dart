import 'package:flutter/material.dart';

/// Approved Hugeicons Rounded set, bundled locally for offline navigation.
class NavigationIcon extends StatelessWidget {
  const NavigationIcon(this.index, {super.key, this.color, this.size, this.selected = false});
  final int index;
  final Color? color;
  final double? size;
  final bool selected;
  static const assets = [
    'assets/tab-bubble-chat.png',
    'assets/tab-user-group-03.png',
    'assets/tab-news-01.png',
    'assets/tab-ai-chat-02.png',
    'assets/tab-user-circle.png',
  ];

  @override
  Widget build(BuildContext context) {
    final theme = IconTheme.of(context);
    final reduced = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final duration = Duration(milliseconds: reduced ? 0 : 220);
    return AnimatedSlide(duration: duration, curve: Curves.easeOutCubic,
      offset: selected ? const Offset(0, -0.08) : Offset.zero,
      child: AnimatedScale(duration: duration, curve: Curves.easeOutBack,
        scale: selected ? 1.12 : 1,
        child: Image.asset(assets[index], scale: 1, width: size ?? theme.size ?? 24,
      height: size ?? theme.size ?? 24, color: color ?? theme.color,
      colorBlendMode: BlendMode.srcIn, excludeFromSemantics: true,
      filterQuality: FilterQuality.medium)));
  }
}
