import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/utils/call_navigation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('late incoming cleanup preserves the call room above it', (tester) async {
    final navigator = GlobalKey<NavigatorState>();
    late BuildContext incoming;
    await tester.pumpWidget(MaterialApp(navigatorKey: navigator, home: const Scaffold(body: Text('Chat'))));
    unawaited(navigator.currentState!.push(MaterialPageRoute<void>(builder: (context) {
      incoming = context; return const Scaffold(body: Text('Incoming'));
    })));
    await tester.pumpAndSettle();
    unawaited(navigator.currentState!.push(MaterialPageRoute<void>(builder: (_) => const Scaffold(body: Text('Call room')))));
    await tester.pumpAndSettle();
    dismissCallRoute(incoming);
    await tester.pumpAndSettle();
    expect(find.text('Call room'), findsOneWidget);
    dismissCallRoute(incoming); // A duplicate late event must not pop the call room.
    await tester.pumpAndSettle();
    expect(find.text('Call room'), findsOneWidget);
    navigator.currentState!.pop();
    await tester.pumpAndSettle();
    expect(find.text('Chat'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
