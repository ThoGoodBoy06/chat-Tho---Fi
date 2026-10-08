import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/main.dart';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:flutter_frontend/screens/login_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/services/network_status.dart';
import 'package:flutter_frontend/services/socket_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('returning online revalidates session and refreshes selected history without sending drafts', (tester) async {
    final saved = MessageModel(id: 'saved', conversationId: 'room', senderId: 'partner', content: 'Tin đã lưu', createdAt: DateTime.utc(2026));
    final fresh = MessageModel(id: 'fresh', conversationId: 'room', senderId: 'partner', content: 'Tin mới', createdAt: DateTime.utc(2026,1,2));
    SharedPreferences.setMockInitialValues({'authToken':'session','cached_session_token':'session',
      'cached_session_user':jsonEncode({'id':'me','username':'me','fullName':'Me'}),
      'cached_conversations_me':jsonEncode([{'id':'room','name':'Partner'}]),
      'cached_msgs_room':jsonEncode([saved.toJson()])});
    NetworkStatus.online.value = false;
    var auth=0, sends=0;
    ApiService.setClientForTesting(MockClient((request) async {
      if(request.method=='POST' && request.url.path.endsWith('/messages')) sends++;
      if(request.url.path.endsWith('/auth/me')) { auth++; return http.Response(jsonEncode({'data':{'id':'me','username':'me','fullName':'Me'}}),200); }
      if(request.url.path.endsWith('/conversations')) return http.Response(jsonEncode({'data':[{'id':'room','name':'Partner'}]}),200);
      if(request.url.path.endsWith('/messages')) return http.Response(jsonEncode({'data':[saved.toJson(),fresh.toJson()]}),200,headers:{'content-type':'application/json; charset=utf-8'});
      return http.Response(jsonEncode({'data':[]}),200);
    }));
    final provider=ChatProvider();
    await tester.pumpWidget(MultiProvider(providers:[ChangeNotifierProvider.value(value:provider),ChangeNotifierProvider(create:(_)=>ThemeProvider())],child:const ChatThoFiApp()));
    for(var i=0;i<10;i++) { await tester.pump(const Duration(milliseconds:100)); }
    await provider.selectConversation(provider.conversations.single);
    await provider.sendMessage('Bản nháp offline');
    NetworkStatus.online.value=true;
    for(var i=0;i<20;i++) { await tester.pump(const Duration(milliseconds:100)); }
    expect(auth,1);
    expect(provider.messages.any((m)=>m.id=='fresh'),isTrue);
    expect(sends,0);
    expect(find.text('Không có mạng · Chỉ xem dữ liệu đã lưu'),findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    SocketService.disconnect();
    provider.dispose();
    await tester.pump();
  });
  testWidgets('offline startup restores cached account/history, blocks sending and can log out', (tester) async {
    final message = MessageModel(id: 'saved', conversationId: 'room', senderId: 'partner', content: 'Tin đã lưu', createdAt: DateTime.utc(2026));
    SharedPreferences.setMockInitialValues({
      'authToken': 'session', 'cached_session_token': 'session',
      'cached_session_user': jsonEncode({'id':'me', 'username':'me', 'fullName':'Me'}),
      'cached_conversations_me': jsonEncode([{'id':'room', 'name':'Partner'}]),
      'cached_msgs_room': jsonEncode([message.toJson()]),
    });
    NetworkStatus.online.value = false;
    var sends = 0, auth = 0;
    ApiService.setClientForTesting(MockClient((request) async {
      if (request.url.path.contains('/auth/me')) auth++;
      if (request.method == 'POST' && request.url.path.endsWith('/messages')) sends++;
      return http.Response(jsonEncode({'data': []}), 200);
    }));
    final provider = ChatProvider();
    await tester.pumpWidget(MultiProvider(providers: [ChangeNotifierProvider.value(value: provider),
      ChangeNotifierProvider(create: (_) => ThemeProvider())], child: const ChatThoFiApp()));
    for (var i=0;i<10;i++) { await tester.pump(const Duration(milliseconds: 100)); }
    expect(find.byType(ChatScreen), findsOneWidget);
    expect(provider.currentUser?.id, 'me');
    expect(auth, 0);
    expect(find.text('Không có mạng · Chỉ xem dữ liệu đã lưu'), findsOneWidget);
    await provider.selectConversation(provider.conversations.single);
    await tester.pump();
    expect(provider.messages.single.content, 'Tin đã lưu');
    provider.replyingToMessage = message;
    await provider.sendMessage('Không được gửi');
    expect(sends, 0);
    expect(provider.messages.length, 1);
    expect(provider.replyingToMessage, same(message));
    tester.widget<ChatScreen>(find.byType(ChatScreen)).onLogout();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(await ApiService.getOfflineUser(), isNull);
    expect(await ApiService.getToken(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    NetworkStatus.online.value = true;
    await tester.pump();
  });

  test('offline account is bound to the saved token and removed on account change', () async {
    SharedPreferences.setMockInitialValues({'authToken':'new', 'cached_session_token':'old',
      'cached_session_user':jsonEncode({'id':'old-user'})});
    expect(await ApiService.getOfflineUser(), isNull);
    await ApiService.saveToken('next');
    expect((await SharedPreferences.getInstance()).getString('cached_session_user'), isNull);
  });

  test('server rejection clears cached session instead of restoring it offline', () async {
    SharedPreferences.setMockInitialValues({'authToken':'session', 'cached_session_token':'session',
      'cached_session_user':jsonEncode({'id':'me'})});
    ApiService.setClientForTesting(MockClient((_) async => http.Response('{}',401)));
    expect(await ApiService.getMe(), isEmpty);
    expect(await ApiService.getOfflineUser(), isNull);
    expect(await ApiService.getToken(), isNull);
  });
}
