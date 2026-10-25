import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/services/news_service.dart';
import 'package:flutter_frontend/widgets/news_tab.dart';
import 'package:flutter_frontend/widgets/skeleton_box.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> fixture() => {'success': true, 'updatedAt': '2026-10-25T04:00:00Z', 'data': [
  for (final category in ['Vietnam', 'World', 'Tech_AI']) {
    'id': category, 'title': 'Bài báo $category', 'category': category,
    'source': 'Báo thử', 'link': 'https://example.com/$category',
    'content': 'Tóm tắt từ nguồn tin', 'createdAt': '2026-10-25T03:00:00Z',
  }
]};

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final width in [320.0, 390.0, 1280.0]) {
    testWidgets('loading slots match article geometry and categories open original links at $width', (tester) async {
      tester.view.physicalSize = Size(width, 844); tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize); addTearDown(tester.view.resetDevicePixelRatio);
      final pending = Completer<Map<String, dynamic>>();
      final service = NewsService(fetch: () => pending.future);
      String? opened;
      await tester.pumpWidget(MaterialApp(theme: ThemeData(splashFactory: NoSplash.splashFactory), home: Scaffold(body: NewsTab(service: service,
        onOpenArticle: (url) => opened = url))));
      await tester.pump();
      expect(find.byType(SkeletonBox), findsWidgets);
      final rowRect = tester.getRect(find.byType(NewsArticleRow).first);
      pending.complete(fixture());
      await tester.pump(); await tester.pump();
      expect(find.text('Bài báo Vietnam'), findsOneWidget);
      expect(tester.getRect(find.byType(NewsArticleRow).first), rowRect);
      expect(find.byType(SkeletonBox), findsNothing);
      await tester.tap(find.text('Thế giới')); await tester.pump();
      expect(find.text('Bài báo World'), findsOneWidget);
      expect(find.text('Bài báo Vietnam'), findsNothing);
      await tester.tap(find.text('Công nghệ')); await tester.pump();
      await tester.tap(find.text('Bài báo Tech_AI')); await tester.pump();
      expect(opened, 'https://example.com/Tech_AI');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }

  testWidgets('failed first load offers retry instead of a perpetual skeleton', (tester) async {
    var fail = true;
    final service = NewsService(fetch: () async {
      if (fail) throw Exception('offline'); return fixture();
    });
    await tester.pumpWidget(MaterialApp(theme: ThemeData(splashFactory: NoSplash.splashFactory), home: Scaffold(body: NewsTab(service: service))));
    await tester.pump(); await tester.pump();
    expect(find.byType(SkeletonBox), findsNothing);
    expect(find.text('Thử lại'), findsOneWidget);
    fail = false;
    await tester.tap(find.text('Thử lại')); await tester.pump(); await tester.pump();
    expect(find.text('Bài báo Vietnam'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  test('public cache survives offline refresh and malformed entries are discarded', () async {
    var requests = 0;
    final service = NewsService(fetch: () async { requests++; return fixture(); });
    await Future.wait([service.refresh(), service.refresh()]);
    expect(requests, 1);
    await service.refresh(); expect(requests, 1);
    final offline = NewsService(fetch: () async => throw Exception('offline'));
    expect((await offline.cached())!.articles.length, 3);
    await expectLater(offline.refresh(), throwsException);
    expect((await offline.cached())!.articles.length, 3);
    expect(NewsArticle.fromJson({'title':'bad','link':'javascript:alert(1)'}), isNull);
  });
}
