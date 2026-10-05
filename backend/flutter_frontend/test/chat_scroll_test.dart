import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/widgets/inline_message_image.dart';
import 'package:flutter_frontend/widgets/message_context_menu_transition.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  for (final width in [390.0, 1280.0]) {
    testWidgets('message menu opens and dismisses without moving history at width $width', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({'authToken': 'test-token'});
      ApiService.setClientForTesting(MockClient((_) async => http.Response(jsonEncode({'data': []}), 200)));
      final provider = ChatProvider()..currentUser = UserModel(id: 'me', username: 'me', fullName: 'Me');
      final conversation = ConversationModel(id: 'room', name: 'Partner');
      provider.conversations = [conversation];
      provider.selectedConversation = conversation;
      provider.messages = [MessageModel(id: 'menu-message', conversationId: 'room', senderId: 'partner',
        content: 'Hold this message', createdAt: DateTime.utc(2026, 1, 1))];
      await tester.pumpWidget(MultiProvider(
        providers: [ChangeNotifierProvider.value(value: provider), ChangeNotifierProvider(create: (_) => ThemeProvider())],
        child: MaterialApp(home: ChatScreen(onLogout: () {})),
      ));
      for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 100)); }
      final list = find.byWidgetPredicate((w) => w is ListView && w.controller != null);
      final controller = tester.widget<ListView>(list).controller!;
      final offset = controller.offset;
      await tester.longPress(find.text('Hold this message'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 90));
      expect(find.byType(MessageContextMenuTransition), findsOneWidget);
      expect(find.byType(BackdropFilter), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Trả lời'), findsOneWidget);
      expect(find.text('Sao chép'), findsOneWidget);
      expect(find.text('Gỡ ở phía tôi'), findsOneWidget);
      expect(controller.offset, offset);
      await tester.tapAt(const Offset(5, 5));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.byType(MessageContextMenuTransition), findsNothing);
      expect(find.byType(BackdropFilter), findsNothing);
      expect(controller.offset, offset);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      provider.dispose();
      await tester.pump();
    });
    testWidgets('read avatar follows the latest read message at width $width', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      SharedPreferences.setMockInitialValues({'authToken': 'test-token'});
      ApiService.setClientForTesting(MockClient((_) async => http.Response(jsonEncode({'data': []}), 200)));
      final provider = ChatProvider()..currentUser = UserModel(id: 'me', username: 'me', fullName: 'Me');
      final conversation = ConversationModel(id: 'room', name: 'Partner');
      provider.conversations = [conversation];
      provider.selectedConversation = conversation;
      provider.messages = List.generate(3, (i) => MessageModel(id: 'm$i', conversationId: 'room',
        senderId: 'me', content: 'Message $i', createdAt: DateTime.utc(2026, 1, 1, 0, i), isDelivered: true));
      await tester.pumpWidget(MultiProvider(
        providers: [ChangeNotifierProvider.value(value: provider), ChangeNotifierProvider(create: (_) => ThemeProvider())],
        child: MaterialApp(home: ChatScreen(onLogout: () {})),
      ));
      for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 100)); }
      expect(find.byKey(const ValueKey('read_avatar_m2')), findsNothing);
      provider.applyReadReceipt({'conversationId': 'room', 'readBy': 'partner', 'lastReadMessageId': 'm1'});
      await tester.pump();
      expect(find.byKey(const ValueKey('read_avatar_m1')), findsOneWidget,
        reason: 'The avatar stays beneath the latest read message when a newer message is only delivered.');
      expect(find.byKey(const ValueKey('read_avatar_m2')), findsNothing);
      provider.applyReadReceipt({'conversationId': 'room', 'readBy': 'partner', 'lastReadMessageId': 'm2'});
      await tester.pump();
      expect(find.byKey(const ValueKey('read_avatar_m1')), findsNothing);
      expect(find.byKey(const ValueKey('read_avatar_m2')), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      provider.dispose();
      await tester.pump();
    });
  }
  testWidgets('mobile image history keeps cell state and scrolls toward latest without looping', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'authToken': 'test-token'});
    ApiService.setClientForTesting(MockClient((_) async => http.Response(jsonEncode({'data': []}), 200)));
    final provider = ChatProvider()..currentUser = UserModel(id: 'me', username: 'me', fullName: 'Me');
    final conversation = ConversationModel(id: 'room', name: 'Images');
    provider.conversations = [conversation];
    provider.selectedConversation = conversation;
    provider.selectedConversationId = 'room';
    const image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    provider.messages = List.generate(40, (i) => MessageModel(
      id: '$i', conversationId: 'room', senderId: 'partner', type: 'image',
      content: image, createdAt: DateTime.utc(2026, 1, 1, 0, i),
    ));
    await tester.pumpWidget(MultiProvider(
      providers: [ChangeNotifierProvider.value(value: provider), ChangeNotifierProvider(create: (_) => ThemeProvider())],
      child: MaterialApp(home: ChatScreen(onLogout: () {})),
    ));
    for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 100)); }
    final list = find.byWidgetPredicate((widget) => widget is ListView && widget.controller != null);
    final controller = tester.widget<ListView>(list).controller!;
    controller.jumpTo(1400);
    await tester.pump();
    final states = <String, State>{
      for (final element in find.byType(InlineMessageImage).evaluate())
        (element.widget as InlineMessageImage).messageId: (element as StatefulElement).state,
    };
    provider.addRealtimeMessage(MessageModel(id: 'new-image', conversationId: 'room',
      senderId: 'partner', type: 'image', content: image, createdAt: DateTime.utc(2026, 1, 1, 2)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(controller.offset, 1400);
    var retained = 0;
    for (final element in find.byType(InlineMessageImage).evaluate()) {
      final id = (element.widget as InlineMessageImage).messageId;
      if (states.containsKey(id)) {
        expect((element as StatefulElement).state, same(states[id]));
        retained++;
      }
    }
    expect(retained, greaterThan(0));
    for (var i = 0; i < 3; i++) {
      final previousOffset = controller.offset;
      await tester.drag(list, const Offset(0, -180));
      for (var frame = 0; frame < 10; frame++) { await tester.pump(const Duration(milliseconds: 100)); }
      expect(controller.offset, lessThan(previousOffset), reason: 'Each gesture toward latest must advance, not repeat the same range.');
    }
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    await tester.pump();
  });

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
    expect(controller.offset, lessThan(5), reason: 'Opening chat should show the latest messages.');
    controller.jumpTo(800);
    final readingOffset = controller.offset;
    await tester.pump();
    provider.setShowUnreadOnly(true);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(controller.offset, readingOffset, reason: 'Updating the desktop sidebar must not reopen/scroll the active chat.');
    provider.addRealtimeMessage(MessageModel(
      id: 'new', conversationId: 'room', senderId: 'partner', content: 'New incoming message',
      createdAt: DateTime.utc(2026, 1, 1, 2),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
    expect(controller.offset, readingOffset, reason: 'Incoming messages must not pull the reader out of history.');
    expect(controller.offset, greaterThan(160));
    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    await tester.pump();
  });

  testWidgets('mobile chat remains responsive through slide, typing and sidebar updates', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({'authToken': 'test-token'});
    ApiService.setClientForTesting(MockClient((_) async => http.Response(jsonEncode({'data': []}), 200)));
    final provider = ChatProvider()..currentUser = UserModel(id: 'me', username: 'me', fullName: 'Me');
    final conversation = ConversationModel(id: 'room', name: 'Conversation');
    provider.conversations = [conversation];
    provider.selectedConversation = conversation;
    provider.selectedConversationId = conversation.id;
    provider.messages = List.generate(40, (index) => MessageModel(
      id: '$index', conversationId: 'room', senderId: 'partner',
      content: 'Message $index', createdAt: DateTime.utc(2026, 1, 1, 0, index),
    ));
    await tester.pumpWidget(MultiProvider(
      providers: [ChangeNotifierProvider.value(value: provider), ChangeNotifierProvider(create: (_) => ThemeProvider())],
      child: MaterialApp(home: ChatScreen(onLogout: () {})),
    ));
    for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 100)); }
    final listFinder = find.byWidgetPredicate((widget) => widget is ListView && widget.controller != null);
    final controller = tester.widget<ListView>(listFinder).controller!;
    expect(controller.offset, lessThan(5));
    controller.jumpTo(500);
    await tester.pump();
    await tester.enterText(find.byType(TextField).last, 'Typing a message');
    await tester.pump();
    expect(controller.offset, 500, reason: 'Typing should preserve history reading position.');
    provider.setShowUnreadOnly(true);
    await tester.pump();
    expect(find.text('Chưa đọc'), findsWidgets, reason: 'Sidebar must react to provider changes without animating the whole screen again.');
    expect(controller.offset, 500);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    await tester.pump();
  });
}
