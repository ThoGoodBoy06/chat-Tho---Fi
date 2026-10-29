import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_frontend/widgets/app_avatar.dart';
import 'package:flutter_frontend/widgets/profile_cover.dart';

void main() {
  for (final cover in [
    (
      'square',
      const ExactAssetImage('assets/tho_fi_logo_transparent.png'),
      1.0
    ),
    ('wide', const ExactAssetImage('assets/profile-cover-bay.webp'), 2.0),
  ]) {
    testWidgets('${cover.$1} photo stays within the standard banner',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
          home: Scaffold(
              body: SingleChildScrollView(
        child: SizedBox(
            width: 320,
            child: ProfileCover(
                image: cover.$2,
                fallback: const SizedBox(height: 160),
                avatar: const SizedBox(width: 96, height: 96),
                editControl: const Icon(Icons.camera_alt_outlined))),
      ))));
      await tester.runAsync(() =>
          precacheImage(cover.$2, tester.element(find.byType(ProfileCover))));
      await tester.pumpAndSettle();
      final photo = find.byType(Image).first;
      final bounds = tester.getSize(photo);
      expect(bounds.width, 320);
      expect(bounds.height, 160);
      expect(tester.widget<Image>(photo).fit, BoxFit.cover);
      expect(tester.widget<Image>(photo).alignment, Alignment.topCenter);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets(
      'loaded avatar has no initial overlay; empty avatar retains initials',
      (tester) async {
    const photo = ExactAssetImage('assets/tho_fi_logo_transparent.png');
    await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
            body: AppAvatar(
                radius: 46, backgroundImage: photo, child: Text('T')))));
    final source = tester.widget<Image>(find.byType(Image)).image;
    await tester.runAsync(
        () => precacheImage(source, tester.element(find.byType(AppAvatar))));
    await tester.pumpAndSettle();
    expect(find.text('T'), findsNothing);
    expect(find.byType(Image), findsOneWidget);
    await tester.pumpWidget(const MaterialApp(
        home: Scaffold(body: AppAvatar(radius: 46, child: Text('T')))));
    expect(find.text('T'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
