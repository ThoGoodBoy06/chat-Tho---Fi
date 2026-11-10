import 'dart:math' as math;
import 'package:flutter/material.dart';

class AuthIllustratedHeader extends StatelessWidget {
  const AuthIllustratedHeader(
      {super.key, required this.register, this.revision = 0});
  final bool register;
  final int revision;
  static const loginArt = ExactAssetImage('assets/auth-login-art.webp');
  static const registerArt = ExactAssetImage('assets/auth-register-art.webp');

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final reduced = MediaQuery.of(context).disableAnimations;
    final duration = Duration(milliseconds: reduced ? 0 : 300);
    final text = register
        ? 'Một tài khoản mới, ngàn câu chuyện chờ bạn.'
        : 'Chuyện của bạn, luôn có người nghe.';
    final color = dark ? const Color(0xFFF0F5FF) : const Color(0xFF0E193B);
    return ClipPath(
        clipper: const _HeaderCurve(),
        child: DecoratedBox(
          decoration: BoxDecoration(
              gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: dark
                      ? const [Color(0xFF172D4D), Color(0xFF34335E)]
                      : const [Color(0xFFE1F2FF), Color(0xFFE3D8FF)])),
          child: Padding(
              padding: const EdgeInsets.only(top: 20),
              child: Column(children: [
                Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Image.asset('assets/tho_fi_logo_transparent.png',
                              scale: 1,
                              width: 54,
                              height: 54,
                              semanticLabel: 'Logo Chat Tho-Fi'),
                          const SizedBox(width: 12),
                          Flexible(
                              child: Text('Chat Tho-Fi',
                                  style: TextStyle(
                                      color: color,
                                      fontSize: 21,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.5))),
                        ])),
                const SizedBox(height: 12),
                LayoutBuilder(builder: (context, bounds) {
                  final textWidth = bounds.maxWidth * 0.51;
                  final style = TextStyle(
                      color: color,
                      fontSize: bounds.maxWidth < 350 ? 21 : 23,
                      height: 1.24,
                      letterSpacing: -0.5,
                      fontWeight: FontWeight.w800);
                  // Reserve enough room for either title so the tab strip never jumps.
                  double measure(String value) {
                    final painter = TextPainter(
                        text: TextSpan(text: value, style: style),
                        textDirection: Directionality.of(context),
                        textScaler: MediaQuery.textScalerOf(context))
                      ..layout(maxWidth: textWidth);
                    return painter.height;
                  }

                  final height = math.max(
                      196.0,
                      math.max(
                              measure(
                                  'Một tài khoản mới, ngàn câu chuyện chờ bạn.'),
                              measure('Chuyện của bạn, luôn có người nghe.')) +
                          36);
                  return SizedBox(
                      height: height,
                      child: Stack(clipBehavior: Clip.none, children: [
                        Positioned(
                            right: -8,
                            bottom: 15,
                            width: bounds.maxWidth * 0.59,
                            height: height + 5,
                            child: RepaintBoundary(
                                child: AnimatedSwitcher(
                              key: const ValueKey('auth-art-switcher'),
                              duration: duration,
                              switchInCurve: Curves.easeOutCubic,
                              switchOutCurve: Curves.easeInCubic,
                              transitionBuilder: (child, animation) {
                                final direction =
                                    child is Image && child.image == registerArt
                                        ? 1.0
                                        : -1.0;
                                return FadeTransition(
                                    opacity: animation,
                                    child: SlideTransition(
                                        position: Tween<Offset>(
                                                begin: Offset(
                                                    0.10 * direction, 0.025),
                                                end: Offset.zero)
                                            .animate(animation),
                                        child: ScaleTransition(
                                            scale: Tween<double>(
                                                    begin: 0.97, end: 1)
                                                .animate(animation),
                                            child: child)));
                              },
                              child: Image(
                                  key: ValueKey(revision),
                                  image: register ? registerArt : loginArt,
                                  fit: BoxFit.contain,
                                  excludeFromSemantics: true,
                                  filterQuality: FilterQuality.medium),
                            ))),
                        Positioned(
                            left: 24,
                            top: 12,
                            width: textWidth,
                            child: AnimatedSwitcher(
                                duration: duration,
                                switchInCurve: Curves.easeOutCubic,
                                layoutBuilder: (current, previous) => Stack(
                                        alignment: Alignment.topLeft,
                                        children: [
                                          for (final old in previous)
                                            ExcludeSemantics(child: old),
                                          if (current != null) current,
                                        ]),
                                child: Text(text,
                                    key: ValueKey(revision), style: style))),
                      ]));
                }),
              ])),
        ));
  }
}

class _HeaderCurve extends CustomClipper<Path> {
  const _HeaderCurve();
  @override
  Path getClip(Size size) => Path()
    ..lineTo(0, size.height - 26)
    ..quadraticBezierTo(
        size.width / 2, size.height + 26, size.width, size.height - 26)
    ..lineTo(size.width, 0)
    ..close();
  @override
  bool shouldReclip(_HeaderCurve oldClipper) => false;
}
