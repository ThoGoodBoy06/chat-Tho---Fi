import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/screens/login_screen.dart';
import 'package:flutter_frontend/theme/app_theme.dart';

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('mobile login and registration fit with keyboard: $brightness',
        (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(MaterialApp(
          theme: AppTheme.create(brightness),
          home: LoginScreen(onLoginSuccess: () {})));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text('Chưa có tài khoản? Đăng ký'));
      await tester.tap(find.text('Chưa có tài khoản? Đăng ký'));
      await tester.pumpAndSettle();
      expect(find.text('Họ và tên'), findsOneWidget);
      expect(tester.takeException(), isNull);
      tester.view.viewInsets = const FakeViewPadding(bottom: 280);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byType(ElevatedButton));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.byTooltip('Hiện mật khẩu'));
      await tester.tap(find.byTooltip('Hiện mật khẩu'));
      await tester.pump();
      expect(find.byTooltip('Ẩn mật khẩu'), findsOneWidget);
    });
  }
}
