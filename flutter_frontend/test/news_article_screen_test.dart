import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_frontend/screens/news_article_screen.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/services/news_article_service.dart';
import 'package:flutter_frontend/services/news_service.dart';
import 'package:flutter_frontend/widgets/news_tab.dart';
import 'package:flutter_frontend/widgets/skeleton_box.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

final _date = DateTime.utc(2026,10,25);

NewsArticle sample()=>NewsArticle(id:'aaaaaaaaaaaaaaaaaaaaaaaa',title:'A real article title',summary:'A short summary',
  category:'Vietnam',source:'Publisher',link:'https://example.com/article',publishedAt:_date);

void main() {
  setUp(()=>SharedPreferences.setMockInitialValues({}));
  for(final width in [320.0,390.0,1280.0]) {
    testWidgets('reader shows paragraphs, source and full images inside the app at $width',(tester) async {
      tester.view.physicalSize=Size(width,900);tester.view.devicePixelRatio=1;
      addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
      final pending=Completer<Map<String,dynamic>>();
      final service=NewsArticleService(fetch:(_)=>pending.future);
      await tester.pumpWidget(MaterialApp(theme:ThemeData(splashFactory:NoSplash.splashFactory),
        home:NewsArticleScreen(article:sample(),service:service)));
      expect(find.byType(SkeletonBox),findsWidgets);
      pending.complete({'available':true,'blocks':[
        {'type':'paragraph','text':'The complete paragraph from the article.'},
        {'type':'image','imageId':'bbbbbbbbbbbbbbbbbbbbbbbb','aspectRatio':1.5,'alt':'Article photograph'},
        {'type':'caption','text':'Photograph credit'},
      ]});
      await tester.pump();await tester.pump();
      expect(find.text('The complete paragraph from the article.'),findsOneWidget);
      final image=tester.widget<Image>(find.byType(Image).first);
      expect(image.fit,BoxFit.contain);
      expect(image.semanticLabel,'Article photograph');
      await tester.tap(find.byType(Image).first);await tester.pumpAndSettle();
      expect(find.text('Xem ảnh'),findsOneWidget);
      expect(find.byType(InteractiveViewer),findsOneWidget);
      await tester.pageBack();await tester.pumpAndSettle();
      expect(find.byType(NewsArticleScreen),findsOneWidget);
      expect(tester.takeException(),isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
  testWidgets('blocked source keeps summary and retry within the app',(tester) async {
    var fail=true;
    final service=NewsArticleService(fetch:(_) async=>fail ? {'available':false,'message':'Publisher unavailable','blocks':[]}
      : {'available':true,'blocks':[{'type':'paragraph','text':'Loaded after retry'}]});
    await tester.pumpWidget(MaterialApp(theme:ThemeData(splashFactory:NoSplash.splashFactory),
      home:NewsArticleScreen(article:sample(),service:service)));
    await tester.pump();await tester.pump();
    expect(find.text('Publisher unavailable'),findsOneWidget);
    expect(find.text('A short summary'),findsOneWidget);
    fail=false;await tester.tap(find.text('Thử lại'));await tester.pump();await tester.pump();
    expect(find.text('Loaded after retry'),findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets('news tap pushes the reader and back preserves the category',(tester) async {
    ApiService.setClientForTesting(MockClient((_) async=>http.Response(jsonEncode({'success':true,'data':{
      'available':true,'blocks':[{'type':'paragraph','text':'In-app article body'}],
    }}),200)));
    final service=NewsService(fetch:() async=>{'data':[{
      'id':sample().id,'title':sample().title,'category':'Tech_AI','content':sample().summary,
      'source':'Publisher','link':sample().link,'createdAt':_date.toIso8601String(),
    }]});
    await tester.pumpWidget(MaterialApp(theme:ThemeData(splashFactory:NoSplash.splashFactory),home:Scaffold(body:NewsTab(service:service))));
    await tester.pump();await tester.pump();
    await tester.tap(find.text('Công nghệ'));await tester.pump();
    await tester.tap(find.text(sample().title));await tester.pumpAndSettle();
    expect(find.byType(NewsArticleScreen),findsOneWidget);
    expect(find.text('In-app article body'),findsOneWidget);
    await tester.tap(find.byTooltip('Quay lại tin tức'));await tester.pumpAndSettle();
    expect(find.byType(NewsArticleScreen),findsNothing);
    expect(find.text(sample().title),findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
