import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class NewsArticle {
  const NewsArticle(
      {required this.id,
      required this.title,
      required this.summary,
      required this.category,
      required this.source,
      required this.link,
      required this.publishedAt,
      this.imageUrl});
  final String id, title, summary, category, source, link;
  final String? imageUrl;
  final DateTime publishedAt;

  static NewsArticle? fromJson(dynamic value) {
    if (value is! Map) return null;
    final link = Uri.tryParse(value['link']?.toString() ?? '');
    final date = DateTime.tryParse(value['createdAt']?.toString() ?? '');
    final title = value['title']?.toString().trim() ?? '';
    final category = value['category']?.toString() ?? '';
    if (title.isEmpty ||
        date == null ||
        link?.scheme != 'https' ||
        link!.host.isEmpty ||
        !['Vietnam', 'World', 'Tech_AI'].contains(category)) return null;
    final image = Uri.tryParse(value['imageUrl']?.toString() ?? '');
    return NewsArticle(
        id: value['id']?.toString() ?? link.toString(),
        title: title,
        summary: value['content']?.toString() ?? '',
        category: category,
        source: value['source']?.toString() ?? link.host,
        link: link.toString(),
        imageUrl: image?.scheme == 'https' && image!.host.isNotEmpty
            ? image.toString()
            : null,
        publishedAt: date);
  }
}

class NewsFeed {
  NewsFeed(this.articles, {this.updatedAt, this.stale = false});
  final List<NewsArticle> articles;
  final DateTime? updatedAt;
  final bool stale;
  factory NewsFeed.fromJson(Map<String, dynamic> value,
          {bool offline = false}) =>
      NewsFeed(
        (value['data'] as List? ?? [])
            .map(NewsArticle.fromJson)
            .whereType<NewsArticle>()
            .toList(),
        updatedAt: DateTime.tryParse(value['updatedAt']?.toString() ?? ''),
        stale: offline || value['stale'] == true,
      );
}

/// Public headlines only. No account or message data is stored with this cache.
class NewsService {
  NewsService({Future<Map<String, dynamic>> Function()? fetch})
      : _fetch = fetch ?? ApiService.getNewsFeed;
  static final shared = NewsService();
  static const _cacheKey = 'tho_fi_news_feed_v1';
  final Future<Map<String, dynamic>> Function() _fetch;
  NewsFeed? _memory;
  DateTime? _fetchedAt;
  Future<NewsFeed>? _pending;

  Future<NewsFeed?> cached() async {
    if (_memory != null) return _memory;
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_cacheKey);
      if (raw == null || raw.length > 1024 * 1024) return null;
      final feed = NewsFeed.fromJson(Map<String, dynamic>.from(jsonDecode(raw)),
          offline: true);
      if (feed.articles.isNotEmpty) _memory = feed;
    } catch (_) {}
    return _memory;
  }

  Future<NewsFeed> refresh({bool force = false}) {
    if (_pending != null) return _pending!;
    if (!force &&
        _memory != null &&
        _fetchedAt != null &&
        DateTime.now().difference(_fetchedAt!) < const Duration(minutes: 10)) {
      return Future.value(_memory);
    }
    final future = _load();
    _pending = future;
    return future.whenComplete(() {
      if (identical(_pending, future)) _pending = null;
    });
  }

  Future<NewsFeed> _load() async {
    final json = await _fetch();
    final feed = NewsFeed.fromJson(json);
    if (feed.articles.isEmpty)
      throw Exception('Chưa có tin tức. Vui lòng thử lại.');
    _memory = feed;
    _fetchedAt = DateTime.now();
    try {
      await (await SharedPreferences.getInstance())
          .setString(_cacheKey, jsonEncode(json));
    } catch (_) {}
    return feed;
  }
}
