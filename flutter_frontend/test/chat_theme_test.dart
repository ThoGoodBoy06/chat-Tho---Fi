import 'dart:async';
import 'dart:convert';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/services/network_status.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('late conversation refresh cannot overwrite a newly saved theme', () async {
    SharedPreferences.setMockInitialValues({});NetworkStatus.online.value=true;
    final refresh=Completer<http.Response>();
    ApiService.setClientForTesting(MockClient((request) async {
      if(request.method=='PATCH')return http.Response('{"success":true}',200);
      return refresh.future;
    }));
    final provider=ChatProvider()..currentUser=UserModel(id:'me',username:'me',fullName:'Me');
    final conv=ConversationModel(id:'room',name:'Partner',theme:'classic');
    provider.conversations=[conv];provider.selectedConversation=conv;
    final loading=provider.fetchConversations(showLoading:false,preload:false);
    await Future<void>.delayed(Duration.zero);
    expect(await provider.updateConversationTheme('room','ocean'),isTrue);
    refresh.complete(http.Response(jsonEncode({'data':[{'id':'room','name':'Updated title','theme':'classic'}]}),200));
    await loading;
    expect(provider.conversations.single.theme,'ocean');
    expect(provider.conversations.single.name,'Updated title');
    final cached=jsonDecode((await SharedPreferences.getInstance()).getString('cached_conversations_me')!) as List;
    expect(cached.first['theme'],'ocean');
    provider.dispose();
  });
  for (final success in [true,false]) {
    test('theme ${success ? "persists" : "rolls back"} after server response; only one write', () async {
      SharedPreferences.setMockInitialValues({'cached_conversations_me':jsonEncode([{'id':'room','name':'Partner','theme':'classic'}])});
      NetworkStatus.online.value=true;
      final response=Completer<http.Response>();var writes=0;
      ApiService.setClientForTesting(MockClient((_) {writes++;return response.future;}));
      final provider=ChatProvider()..currentUser=UserModel(id:'me',username:'me',fullName:'Me');
      final conv=ConversationModel(id:'room',name:'Partner',theme:'classic');
      provider.conversations=[conv];provider.selectedConversation=conv;
      final request=provider.updateConversationTheme('room','ocean');
      await Future<void>.delayed(Duration.zero);
      expect(provider.selectedConversation!.theme,'ocean');
      expect(await provider.updateConversationTheme('room','sunset'),isFalse);
      response.complete(http.Response(jsonEncode({'success':success}),success?200:500));
      expect(await request,success);
      expect(writes,1);
      expect(provider.selectedConversation!.theme,success?'ocean':'classic');
      final cached=jsonDecode((await SharedPreferences.getInstance()).getString('cached_conversations_me')!) as List;
      expect(cached.first['theme'],success?'ocean':'classic');
      expect(cached.first['name'],'Partner');
      provider.dispose();
    });
  }
  test('offline theme cannot pretend to be saved',() async {
    SharedPreferences.setMockInitialValues({});NetworkStatus.online.value=false;
    final provider=ChatProvider()..selectedConversation=ConversationModel(id:'room',name:'Partner',theme:'classic');
    expect(await provider.updateConversationTheme('room','love'),isFalse);
    expect(provider.selectedConversation!.theme,'classic');
    provider.dispose();NetworkStatus.online.value=true;
  });
}
