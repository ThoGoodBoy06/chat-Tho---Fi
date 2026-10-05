import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/widgets/message_context_menu_transition.dart';

void main() {
  testWidgets('reduced motion keeps menu visible and actionable immediately', (tester) async {
    var tapped = false;
    await tester.pumpWidget(MaterialApp(home: MediaQuery(
      data: const MediaQueryData(disableAnimations: true),
      child: MessageContextMenuTransition(
        animation: const AlwaysStoppedAnimation(0),
        alignment: Alignment.centerLeft,
        child: GestureDetector(onTap: () => tapped = true, child: const Text('Reply')),
      ),
    )));
    await tester.tap(find.text('Reply'));
    expect(tapped, isTrue);
    expect(tester.takeException(), isNull);
  });
}
