import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/screens/chat_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:flutter_frontend/main.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/providers/theme_provider.dart';
import 'package:flutter_frontend/screens/login_screen.dart';
import 'package:flutter_frontend/screens/splash_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('real app logout clears session and returns to login', (tester) async {
    SharedPreferences.setMockInitialValues({});
    GoogleFonts.config.allowRuntimeFetching = false;
    ApiService.setClientForTesting(MockClient((_) async => http.Response(jsonEncode({'data': []}), 200)));
    final provider = ChatProvider();
    await tester.pumpWidget(MultiProvider(
      providers: [ChangeNotifierProvider.value(value: provider),
        ChangeNotifierProvider(create: (_) => ThemeProvider())],
      child: const ChatThoFiApp(),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(LoginScreen), findsOneWidget);
    await ApiService.saveToken('session-test');
    provider.currentUser = UserModel(id: 'real-user', username: 'real-user', fullName: 'Real user');
    provider.notifyListeners();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(ChatScreen), findsOneWidget);
    tester.widget<ChatScreen>(find.byType(ChatScreen)).onLogout();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(await ApiService.getToken(), isNull);
    expect(provider.currentUser, isNull);
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(ChatScreen), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    provider.dispose();
    await tester.pump();
  });
  testWidgets('signed-out startup reaches login without a fixed splash delay', (tester) async {
    SharedPreferences.setMockInitialValues({});
    GoogleFonts.config.allowRuntimeFetching = false;
    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const ChatThoFiApp(),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(SplashScreen), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}
