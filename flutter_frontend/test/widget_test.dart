import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/main.dart';

void main() {
  testWidgets('App loads smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ChatThoFiApp());
    expect(find.byType(ChatThoFiApp), findsOneWidget);
  });
}
