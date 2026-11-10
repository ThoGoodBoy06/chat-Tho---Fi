import 'dart:ui' show PointerDeviceKind;
import 'package:flutter/rendering.dart';
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
  void expectSharedFont(WidgetTester tester, String workspace) {
    var checked = 0;
    for (final element in find.byType(RichText).evaluate()) {
      final paragraph = element.renderObject;
      if (paragraph is! RenderParagraph) continue;
      final root = paragraph.text;
      if (root.toPlainText().trim().isEmpty) continue;
      void inspect(InlineSpan span, TextStyle inherited) {
        final resolved = inherited.merge(span.style);
        if (span is TextSpan) {
          final text = span.text ?? '';
          final family = resolved.fontFamily ?? '';
          if (text.trim().isNotEmpty &&
              !family.contains('Icons') &&
              !family.contains('Emoji')) {
            expect(family, 'Roboto', reason: '$workspace: $text');
            checked++;
          }
          for (final child in span.children ?? <InlineSpan>[]) {
            inspect(child, resolved);
          }
        }
      }

      inspect(root, const TextStyle());
    }
    expect(checked, greaterThan(8), reason: workspace);
  }

  setUpAll(() async {
    final loader = FontLoader('Roboto')
      ..addFont(rootBundle.load('assets/fonts/Roboto-Regular.ttf'));
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
        expectSharedFont(tester, 'Tin nhắn');
        void expectTextRole(String text, double size, FontWeight weight,
            {Finder? within}) {
          final target = within == null ? find.text(text) : find.descendant(
              of: within, matching: find.text(text));
          final label = tester.widget<Text>(target.first);
          expect(label.style?.fontFamily, 'Roboto', reason: text);
          expect(label.style?.fontSize, size, reason: text);
          expect(label.style?.fontWeight, weight, reason: text);
          expect(label.style?.letterSpacing, 0, reason: text);
        }
        expectTextRole('Tin nhắn', 27, FontWeight.w700);
        expectTextRole('Minh Khang', 15, FontWeight.w600);
        final bar = find.byType(NavigationBar);
        final bounds = tester.getRect(bar);
        const tabNames = [
          'Tin nhắn',
          'Danh bạ',
          'Tin tức',
          'Trợ lý AI',
          'Cá nhân'
        ];
        int paintedLabelCount(String label) => find
            .byWidgetPredicate(
                (w) => w is RichText && w.text.toPlainText() == label)
            .evaluate()
            .length;
        final labelsBeforeHover = {
          for (final label in tabNames) label: paintedLabelCount(label)
        };
        final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
        await mouse.addPointer(location: Offset.zero);
        for (var i = 0; i < 5; i++) {
          await mouse.moveTo(Offset(
              bounds.left + bounds.width * (i + 0.5) / 5, bounds.top + 24));
          await tester.pump(const Duration(milliseconds: 900));
          for (final label in tabNames) {
            expect(paintedLabelCount(label), labelsBeforeHover[label],
                reason: 'No floating tab label: $label');
          }
        }
        await mouse.removePointer();
        await tester.longPressAt(
            Offset(bounds.left + bounds.width / 10, bounds.top + 24));
        await tester.pump(const Duration(milliseconds: 900));
        for (final label in tabNames) {
          expect(paintedLabelCount(label), labelsBeforeHover[label]);
        }

        expect(tester.takeException(), isNull);
        for (var index = 1; index < 5; index++) {
          tester
              .widget<NavigationBar>(find.byType(NavigationBar))
              .onDestinationSelected!(index);
          await settle();
          expect(tester.takeException(), isNull, reason: 'tab $index');
          expectSharedFont(tester, 'tab $index');
          if (index == 1) {
            expectTextRole('Danh bạ', 27, FontWeight.w700);
            expectTextRole('Nguyễn Minh Khang', 15, FontWeight.w600,
                within: find.byType(ListTile));
            expect(find.text('Đang hoạt động'), findsOneWidget);
            expect(find.text('Bạn bè'), findsOneWidget);
            expect(find.byTooltip('Gọi Nguyễn Minh Khang'), findsOneWidget);
          }
          if (index == 3) {
            expectTextRole('Trợ lý AI', 27, FontWeight.w700);
            expectTextRole('Viết một lời chúc', 15, FontWeight.w600);
            await tester.ensureVisible(find.text('Viết một lời chúc'));
            await tester.tap(find.text('Viết một lời chúc'));
            await settle();
            final aiInput = tester.widget<EditableText>(find.byType(EditableText).last);
            expect(aiInput.style.fontFamily, 'Roboto');
            expect(aiInput.style.fontSize, 15);
            expect(aiInput.style.fontWeight, FontWeight.w400);
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
            expect(
                find.byWidgetPredicate((w) =>
                    w is Image &&
                    w.image is ExactAssetImage &&
                    (w.image as ExactAssetImage).assetName ==
                        'assets/profile-cover-bay.webp'),
                findsOneWidget);
            await tester.ensureVisible(find.text('Giao diện'));
            await tester.tap(find.text('Giao diện'));
            await settle();
            expect(find.text('Chế độ tối'), findsOneWidget);
            expectSharedFont(tester, 'Cài đặt giao diện');
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
