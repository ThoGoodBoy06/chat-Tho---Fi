import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('desktop rebuilds and incoming messages preserve history reading position', (tester) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'authToken': 'test-token'});
    ApiService.setClientForTesting(MockClient((_) async => http.Response(jsonEncode({'data': []}), 200)));
    final provider = ChatProvider()
      ..currentUser = UserModel(id: 'me', username: 'me', fullName: 'Me');
    final conversation = ConversationModel(id: 'room', name: 'Conversation');
    provider.conversations = [conversation];
    provider.selectedConversation = conversation;
    provider.selectedConversationId = conversation.id;
    provider.messages = List.generate(80, (index) => MessageModel(
      id: '$index', conversationId: 'room', senderId: index.isEven ? 'me' : 'partner',
      content: 'Message $index', createdAt: DateTime.utc(2026, 1, 1, 0, index),
    ));
    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: provider),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(home: ChatScreen(onLogout: () {})),
    ));
    for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 100)); }
    final listFinder = find.byWidgetPredicate((widget) => widget is ListView && widget.controller != null);
    final controller = tester.widget<ListView>(listFinder).controller!;
    expect(controller.position.extentAfter, lessThan(5), reason: 'Opening chat should show the latest messages.');
    controller.jumpTo(0);
    await tester.pump();
    provider.setShowUnreadOnly(true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(controller.offset, 0, reason: 'Updating the desktop sidebar must not reopen/scroll the active chat.');
    provider.addRealtimeMessage(MessageModel(
      id: 'new', conversationId: 'room', senderId: 'partner', content: 'New incoming message',
      createdAt: DateTime.utc(2026, 1, 1, 2),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(controller.offset, 0, reason: 'Incoming messages must not pull the reader out of history.');
    expect(controller.position.extentAfter, greaterThan(160));
    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    await tester.pump();
  });
}
