import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback onFinish;

  const SplashScreen({Key? key, required this.onFinish}) : super(key: key);

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _logoDropController;
  late Animation<double> _logoDropAnimation;
  late Animation<double> _logoScaleAnimation;

  late AnimationController _textSlideController;
  late Animation<double> _textSlideAnimation;
  late Animation<double> _textOpacityAnimation;

  @override
  void initState() {
    super.initState();

    // 1. Logo Falling Drop & Physics Bounce Controller (Duration: 1200ms)
    _logoDropController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    // Physical Drop from top (-350px -> 0px) with Bounce Out
    _logoDropAnimation = Tween<double>(begin: -350.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _logoDropController,
        curve: Curves.bounceOut,
      ),
    );

    // Elastic Scale (0.3 -> 1.0)
    _logoScaleAnimation = Tween<double>(begin: 0.3, end: 1.0).animate(
      CurvedAnimation(
        parent: _logoDropController,
        curve: const Interval(0.0, 0.7, curve: Curves.easeOutCubic),
      ),
    );

    // 2. Text Slide Up Controller (Duration: 800ms)
    _textSlideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    // Text slides up from below (+60px -> 0px)
    _textSlideAnimation = Tween<double>(begin: 60.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _textSlideController,
        curve: Curves.easeOutBack,
      ),
    );

    _textOpacityAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _textSlideController,
        curve: Curves.easeIn,
      ),
    );

    // Trigger sequential animations
    _startAnimationSequence();
  }

  void _startAnimationSequence() async {
    // Start Logo Drop physics
    _logoDropController.forward();

    // Delay 600ms then start Text sliding up
    await Future.delayed(const Duration(milliseconds: 650));
    if (mounted) {
      _textSlideController.forward();
    }

    // Wait total 2.4 seconds then complete splash
    await Future.delayed(const Duration(milliseconds: 1750));
    if (mounted) {
      widget.onFinish();
    }
  }

  @override
  void dispose() {
    _logoDropController.dispose();
    _textSlideController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        color: Colors.white,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Main Content Column
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 3),

                // Animated Logo with Physics Bounce Drop (No Card, No Background Container)
                AnimatedBuilder(
                  animation: _logoDropController,
                  builder: (context, child) {
                    return Transform.translate(
                      offset: Offset(0, _logoDropAnimation.value),
                      child: Transform.scale(
                        scale: _logoScaleAnimation.value,
                        child: child,
                      ),
                    );
                  },
                  child: Image.asset(
                    'assets/tho_fi_logo_transparent.png',
                    width: 140,
                    height: 140,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    errorBuilder: (_, __, ___) => Image.asset(
                      'assets/tho_fi_logo.png',
                      width: 140,
                      height: 140,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Animated Text ("Chat Tho-Fi") Sliding Up smoothly
                AnimatedBuilder(
                  animation: _textSlideController,
                  builder: (context, child) {
                    return Transform.translate(
                      offset: Offset(0, _textSlideAnimation.value),
                      child: Opacity(
                        opacity: _textOpacityAnimation.value,
                        child: child,
                      ),
                    );
                  },
                  child: Column(
                    children: [
                      Text(
                        'Chat Tho-Fi',
                        style: GoogleFonts.outfit(
                          fontSize: 34,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0068FF),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Kết nối mọi lúc • Chia sẻ mọi nơi',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF64748B),
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ),

                const Spacer(flex: 4),

                // Bottom Branding Footer
                Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Column(
                    children: [
                      const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          color: Color(0xFF0068FF),
                          strokeWidth: 2.2,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Tho-Fi Ecosystem',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// Custom Painter for Zalo-style cyber mesh at bottom right
class _TechMeshPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    final dotPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final points = [
      Offset(size.width * 0.2, size.height * 0.8),
      Offset(size.width * 0.5, size.height * 0.9),
      Offset(size.width * 0.8, size.height * 0.7),
      Offset(size.width * 0.4, size.height * 0.5),
      Offset(size.width * 0.7, size.height * 0.4),
      Offset(size.width * 0.9, size.height * 0.2),
    ];

    for (int i = 0; i < points.length; i++) {
      canvas.drawCircle(points[i], 3, dotPaint);
      for (int j = i + 1; j < points.length; j++) {
        if ((points[i] - points[j]).distance < size.width * 0.5) {
          canvas.drawLine(points[i], points[j], paint);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
