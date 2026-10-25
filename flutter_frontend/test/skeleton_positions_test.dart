import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:flutter_frontend/screens/other_user_profile_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget host(ChatProvider provider, Widget child) => MultiProvider(providers: [
  ChangeNotifierProvider.value(value: provider), ChangeNotifierProvider(create: (_) => ThemeProvider()),
], child: MaterialApp(theme: ThemeData(fontFamily:'Inter', splashFactory: NoSplash.splashFactory), home: child));

void main() {
  setUpAll(() async {
    final loader = FontLoader('Inter')..addFont(rootBundle.load('assets/fonts/Inter-Regular.ttf'));
    await loader.load();
  });
  setUp(() => SharedPreferences.setMockInitialValues({'authToken':'test-token'}));

  for (final width in [320.0, 390.0, 1280.0]) {
    testWidgets('profile skeleton photo matches the final centered photo at $width', (tester) async {
      tester.view.physicalSize = Size(width, 900); tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize); addTearDown(tester.view.resetDevicePixelRatio);
      final response = Completer<http.Response>();
      ApiService.setClientForTesting(MockClient((_) => response.future));
      final provider = ChatProvider();
      await tester.pumpWidget(host(provider, const OtherUserProfileScreen(userId:'partner')));
      await tester.pump();
      final before = tester.getRect(find.byKey(const ValueKey('profile_skeleton_avatar')));
      expect(before.size, const Size(92,92));
      expect(before.center.dx, width / 2);
      response.complete(http.Response(jsonEncode({'success':true,'data':{
        'id':'partner','fullName':'Partner','username':'partner', 'bio':'A short bio',
      }}), 200));
      await tester.pump(); await tester.pump();
      expect(tester.getRect(find.byKey(const ValueKey('profile_avatar'))), before);
      expect(find.byKey(const ValueKey('profile_skeleton_avatar')), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink()); provider.dispose();
    });
  }

  testWidgets('conversation photo skeleton has the same position as the actual list avatar', (tester) async {
    tester.view.physicalSize = const Size(390,844); tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize); addTearDown(tester.view.resetDevicePixelRatio);
    final pending = Completer<http.Response>();
    ApiService.setClientForTesting(MockClient((request) => request.url.path.endsWith('/conversations') ? pending.future : Future.value(http.Response('{"data":[]}',200))));
    final provider = ChatProvider()..currentUser = UserModel(id:'me',username:'me',fullName:'Me')
      ..isLoadingConversations = true;
    await tester.pumpWidget(host(provider, ChatScreen(onLogout:(){})));
    await tester.pump();
    final before = tester.getRect(find.byKey(const ValueKey('conversation_skeleton_avatar_0')));
    pending.complete(http.Response('{"data":[]}',200));
    await tester.pump();
    provider.isLoadingConversations = false;
    provider.conversations = [ConversationModel(id:'room',name:'Partner',unreadCount:1,
      avatar:'https://example.com/avatar.jpg')];
    provider.setShowUnreadOnly(true);
    await tester.pump();
    expect(tester.getRect(find.byKey(const ValueKey('conversation_avatar_room'))), before);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink()); provider.dispose(); await tester.pump();
  });
}
