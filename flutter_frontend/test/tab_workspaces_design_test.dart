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
import 'package:flutter_frontend/theme/app_theme.dart';
import 'package:flutter_frontend/services/api_service.dart';

class _DesignProvider extends ChatProvider {
  @override
  Future<void> fetchConversations(
      {bool showLoading = true, bool preload = true}) async {}
}

void main() {
  setUpAll(() async {
    final loader = FontLoader('Inter')
      ..addFont(rootBundle.load('assets/fonts/Inter-Regular.ttf'));
    await loader.load();
  });
  for (final width in [320.0, 390.0]) {
    for (final dark in [false, true]) {
      testWidgets('five tabs, search and prompts at $width dark=$dark',
          (tester) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        SharedPreferences.setMockInitialValues(
            {'authToken': 'isolated-test', 'is_dark_mode': dark});
        ApiService.setClientForTesting(
            MockClient((req) async => http.Response.bytes(
                utf8.encode(jsonEncode(req.url.path.contains('history')
                    ? {'success': true, 'messages': []}
                    : {
                        'success': true,
                        'data': req.url.path.contains('friends')
                            ? [
                                {
                                  'id': 'friend',
                                  'fullName': 'Nguyễn Minh Khang',
                                  'username': 'khang',
                                  'isOnline': true
                                }
                              ]
                            : []
                      })),
                200,
                headers: {'content-type': 'application/json; charset=utf-8'})));
        final provider = _DesignProvider()
          ..currentUser =
              UserModel(id: 'me', username: 'tho', fullName: 'Thanh Tho');
        provider.conversations = [
          ConversationModel(
              id: 'room', name: 'Minh Khang', lastMessage: 'Xin chào'),
          ConversationModel(
              id: 'other', name: 'Ngân', lastMessage: 'Hẹn gặp lại')
        ];
        await tester.pumpWidget(MultiProvider(
            providers: [
              ChangeNotifierProvider<ChatProvider>.value(value: provider),
              ChangeNotifierProvider(create: (_) => ThemeProvider())
            ],
            child: MaterialApp(
                theme:
                    AppTheme.create(dark ? Brightness.dark : Brightness.light),
                home: ChatScreen(onLogout: () {}))));
        Future<void> settle() async {
          for (var i = 0; i < 10; i++) {
            await tester.pump(const Duration(milliseconds: 100));
          }
        }

        await settle();
        await tester.enterText(find.byType(TextField).first, 'Minh');
        await settle();
        expect(find.text('Minh Khang'), findsOneWidget);
        expect(find.text('Ngân'), findsNothing);
        await tester.tap(find.byTooltip('Xóa tìm kiếm'));
        await settle();
        expect(find.text('Ngân'), findsOneWidget);
        expect(tester.takeException(), isNull);
        for (var index = 1; index < 5; index++) {
          tester
              .widget<NavigationBar>(find.byType(NavigationBar))
              .onDestinationSelected!(index);
          await settle();
          expect(tester.takeException(), isNull, reason: 'tab $index');
          if (index == 1) {
            expect(find.text('Đang hoạt động'), findsOneWidget);
            expect(find.text('Bạn bè'), findsOneWidget);
            expect(find.byTooltip('Gọi Nguyễn Minh Khang'), findsOneWidget);
          }
          if (index == 3) {
            await tester.ensureVisible(find.text('Viết một lời chúc'));
            await tester.tap(find.text('Viết một lời chúc'));
            await settle();
            expect(
                tester
                    .widget<TextField>(find.byType(TextField).last)
                    .controller!
                    .text,
                contains('sinh nhật'));
            tester.testTextInput.hide();
          }
          if (index == 4) {
            expect(find.text('Sửa ảnh bìa'), findsOneWidget);
            expect(find.text('Thanh Tho'), findsOneWidget);
            expect(find.text('Chỉnh sửa hồ sơ'), findsOneWidget);
            expect(find.byWidgetPredicate((w) => w is Image && w.image is ExactAssetImage &&
              (w.image as ExactAssetImage).assetName == 'assets/profile-cover-bay.webp'), findsOneWidget);
            await tester.ensureVisible(find.text('Giao diện'));
            await tester.tap(find.text('Giao diện'));
            await settle();
            expect(find.text('Chế độ tối'), findsOneWidget);
            expect(tester.takeException(), isNull);
          }
        }
        await tester.pumpWidget(const SizedBox.shrink());
        provider.dispose();
        await tester.pump();
      });
    }
  }
}
