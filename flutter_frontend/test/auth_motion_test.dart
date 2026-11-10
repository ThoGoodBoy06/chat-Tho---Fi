import 'package:flutter_frontend/widgets/auth_illustrated_header.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/screens/login_screen.dart';
import 'package:flutter_frontend/theme/app_theme.dart';

void main() {
  for (final reduced in [false, true]) {
    testWidgets(
        'header images change without shifting the form reduced=$reduced',
        (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(MaterialApp(
          theme: AppTheme.create(Brightness.light),
          home: MediaQuery(
              data: MediaQueryData(
                  size: const Size(390, 844), disableAnimations: reduced),
              child: LoginScreen(onLoginSuccess: () {}))));
      await tester.pumpAndSettle();
      final switcher = find.byKey(const ValueKey('auth-art-switcher'));
      final before =
          tester.getTopLeft(find.byKey(const ValueKey('auth-tab-slider'))).dy;
      expect(
          tester
              .widget<Image>(
                  find.descendant(of: switcher, matching: find.byType(Image)))
              .image,
          AuthIllustratedHeader.loginArt);
      await tester.tap(find.widgetWithText(TextButton, 'Đăng ký').first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.widget<AnimatedSwitcher>(switcher).duration,
          reduced ? Duration.zero : const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
      expect(
          tester
              .widget<Image>(
                  find.descendant(of: switcher, matching: find.byType(Image)))
              .image,
          AuthIllustratedHeader.registerArt);
      expect(
          tester.getTopLeft(find.byKey(const ValueKey('auth-tab-slider'))).dy,
          before);
      for (var i = 0; i < 6; i++) {
        await tester.tap(find
            .widgetWithText(TextButton, i.isEven ? 'Đăng nhập' : 'Đăng ký')
            .first);
        await tester.pump(const Duration(milliseconds: 50));
      }
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }

  setUpAll(() async {
    final font = FontLoader('Roboto')
      ..addFont(rootBundle.load('assets/fonts/Roboto-Regular.ttf'));
    await font.load();
  });
  for (final reduced in [false, true]) {
    testWidgets(
        'tab transitions keep drafts, focus and password visibility safe reduced=$reduced',
        (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(MaterialApp(
          theme: AppTheme.create(Brightness.light),
          home: MediaQuery(
              data: MediaQueryData(
                  size: const Size(390, 844), disableAnimations: reduced),
              child: LoginScreen(onLoginSuccess: () {}))));
      await tester.pumpAndSettle();
      expect(
          Theme.of(tester.element(find.byType(LoginScreen)))
              .textTheme
              .bodyMedium!
              .fontFamily,
          'Roboto');
      await tester.enterText(find.byType(TextField).first, 'demo-user');
      await tester.enterText(find.byType(TextField).last, 'password123');
      await tester.ensureVisible(find.byTooltip('Hiện mật khẩu'));
      await tester.tap(find.byTooltip('Hiện mật khẩu'));
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(find.byType(TextField).last).obscureText,
          false);
      await tester.ensureVisible(find.text('Chưa có tài khoản? Đăng ký'));
      await tester.tap(find.text('Chưa có tài khoản? Đăng ký'));
      await tester.pump();
      final slider = tester
          .widget<AnimatedAlign>(find.byKey(const ValueKey('auth-tab-slider')));
      expect(slider.alignment, Alignment.centerRight);
      expect(slider.duration,
          reduced ? Duration.zero : const Duration(milliseconds: 240));
      await tester.pumpAndSettle();
      expect(find.text('Họ và tên'), findsOneWidget);
      expect(tester.widget<TextField>(find.byType(TextField).last).obscureText,
          true);
      expect(
          tester
              .widget<TextField>(find.byType(TextField).last)
              .controller!
              .text,
          'password123');
      await tester.ensureVisible(find.byType(ElevatedButton));
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();
      expect(find.text('Vui lòng nhập đầy đủ thông tin'), findsOneWidget);
      await tester.ensureVisible(find.text('Đã có tài khoản? Đăng nhập'));
      await tester.tap(find.text('Đã có tài khoản? Đăng nhập'));
      await tester.pumpAndSettle();
      expect(
          tester
              .widget<TextField>(find.byType(TextField).first)
              .controller!
              .text,
          'demo-user');
      expect(find.text('Vui lòng nhập đầy đủ thông tin'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('submit button visibly responds to a held press', (tester) async {
    await tester.pumpWidget(MaterialApp(
        theme: AppTheme.create(Brightness.light),
        home: LoginScreen(onLoginSuccess: () {})));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(ElevatedButton));
    final gesture = await tester
        .startGesture(tester.getCenter(find.byType(ElevatedButton)));
    await tester.pump(const Duration(milliseconds: 60));
    expect(
        tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale, 0.975);
    await gesture.cancel();
    await tester.pumpAndSettle();
    expect(tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale, 1);
    expect(tester.takeException(), isNull);
  });
}
