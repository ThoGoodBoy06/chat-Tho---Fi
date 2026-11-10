import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/theme/app_theme.dart';
import 'package:flutter_frontend/theme/app_typography.dart';

void main() {
  setUpAll(() async {
    final loader = FontLoader('Roboto')
      ..addFont(rootBundle.load('assets/fonts/Roboto-Regular.ttf'));
    await loader.load();
  });
  for (final width in [320.0, 390.0]) {
    for (final dark in [false, true]) {
      testWidgets('composer has one pill at $width dark=$dark', (tester) async {
        tester.view.physicalSize = Size(width, 844);
        tester.view.devicePixelRatio = 1;
        tester.view.padding = const FakeViewPadding(bottom: 34);
        tester.view.viewPadding = const FakeViewPadding(bottom: 34);
        addTearDown(tester.view.reset);
        SharedPreferences.setMockInitialValues(
            {'authToken': 'isolated-test', 'is_dark_mode': dark});
        ApiService.setClientForTesting(MockClient(
            (_) async => http.Response(jsonEncode({'data': []}), 200)));
        final provider = ChatProvider()
          ..currentUser = UserModel(id: 'me', username: 'me', fullName: 'Me');
        final room = ConversationModel(id: 'room', name: 'Partner');
        provider.conversations = [room];
        provider.selectedConversation = room;
        await tester.pumpWidget(MultiProvider(
          providers: [
            ChangeNotifierProvider<ChatProvider>.value(value: provider),
            ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ],
          child: MaterialApp(
            theme: AppTheme.create(dark ? Brightness.dark : Brightness.light),
            home: ChatScreen(onLogout: () {}),
          ),
        ));
        Future<void> settle() async {
          for (var i = 0; i < 8; i++) {
            await tester.pump(const Duration(milliseconds: 100));
          }
        }

        await settle();
        final composer = find.byWidgetPredicate(
            (w) => w is TextField && w.decoration?.hintText == 'Aa');
        void expectSinglePill() {
          final editable = tester.widget<EditableText>(find.descendant(
              of: composer, matching: find.byType(EditableText)));
          expect(editable.style.fontFamily, AppTypography.message.fontFamily);
          expect(editable.style.fontSize, AppTypography.message.fontSize);
          expect(editable.style.fontWeight, AppTypography.message.fontWeight);
          expect(editable.style.height, AppTypography.message.height);
          final decorator = tester.widget<InputDecorator>(find.descendant(
              of: composer, matching: find.byType(InputDecorator)));
          final decoration = decorator.decoration;
          expect(decoration.filled, isFalse);
          for (final border in [
            decoration.border,
            decoration.enabledBorder,
            decoration.focusedBorder,
            decoration.disabledBorder,
            decoration.errorBorder,
            decoration.focusedErrorBorder,
          ]) {
            expect(border, InputBorder.none);
          }
          expect(tester.takeException(), isNull);
        }

        expectSinglePill();
        expect(tester.getRect(composer).bottom, lessThanOrEqualTo(810));
        await tester.tap(composer);
        tester.view.viewInsets = const FakeViewPadding(bottom: 300);
        tester.view.padding = const FakeViewPadding();
        await tester.enterText(
            composer, 'Xin chào\nĐây là tin nhắn nhiều dòng\nDòng thứ ba');
        await settle();
        expectSinglePill();
        expect(tester.getRect(composer).bottom, lessThanOrEqualTo(544));
        expect(tester.widget<TextField>(composer).controller!.text,
            contains('Dòng thứ ba'));
        await tester.tap(find.byTooltip('Mở menu tiện ích'));
        await settle();
        expectSinglePill();
        expect(tester.getRect(composer).width, greaterThan(40));
        expect(find.byTooltip('Gửi ảnh'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
        provider.dispose();
        await tester.pump();
      });
    }
  }
}
