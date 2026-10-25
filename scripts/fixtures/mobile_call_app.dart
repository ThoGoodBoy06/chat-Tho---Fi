import 'package:flutter_frontend/widgets/news_tab.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:provider/provider.dart';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:flutter_frontend/screens/settings_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();
  final id = Uri.base.queryParameters['user'] ?? 'b';
  final peer = id == 'a' ? 'b' : 'a';
  await ApiService.saveToken('test-$id');
  final provider = ChatProvider();
  await provider.setCurrentUser({'id': id, 'username': id, 'fullName': 'User $id'});
  final conv = ConversationModel(id:'room', name:'User $peer', targetUserId:peer);
  provider.conversations = [conv];
  provider.selectedConversation = conv;
  runApp(MultiProvider(providers:[
    ChangeNotifierProvider<ChatProvider>.value(value: provider),
    ChangeNotifierProvider<ThemeProvider>(create: (_) => ThemeProvider()),
  ],child:MaterialApp(theme:ThemeData(fontFamily:'Inter'),home:Uri.base.queryParameters['settings']=='1'
    ? SettingsScreen(onLogout:(){}) : Uri.base.queryParameters['news']=='1'
    ? const Scaffold(body: NewsTab()) : ChatScreen(onLogout:(){}))));
}
