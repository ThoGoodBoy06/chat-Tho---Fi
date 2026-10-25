import 'api_service.dart';

class NewsBlock {
  const NewsBlock(
      {required this.type,
      this.text = '',
      this.imageId,
      this.alt = '',
      this.aspectRatio = 1.5});
  final String type, text, alt;
  final String? imageId;
  final double aspectRatio;

  static NewsBlock? fromJson(dynamic value) {
    if (value is! Map) return null;
    final type = value['type']?.toString() ?? '';
    if (type == 'image') {
      final id = value['imageId']?.toString() ?? '';
      if (!RegExp(r'^[a-f0-9]{24}$').hasMatch(id)) return null;
      final ratio = value['aspectRatio'];
      return NewsBlock(
          type: type,
          imageId: id,
          alt: value['alt']?.toString() ?? '',
          aspectRatio: ratio is num && ratio.isFinite
              ? ratio.toDouble().clamp(0.4, 3.0)
              : 1.5);
    }
    if (!['paragraph', 'heading', 'lead', 'caption', 'quote'].contains(type))
      return null;
    final text = value['text']?.toString().trim() ?? '';
    return text.isEmpty ? null : NewsBlock(type: type, text: text);
  }
}

class NewsArticleDetail {
  NewsArticleDetail(
      {required this.available, required this.blocks, this.message});
  final bool available;
  final List<NewsBlock> blocks;
  final String? message;
  factory NewsArticleDetail.fromJson(Map<String, dynamic> json) =>
      NewsArticleDetail(
        available: json['available'] == true,
        blocks: (json['blocks'] as List? ?? [])
            .map(NewsBlock.fromJson)
            .whereType<NewsBlock>()
            .toList(),
        message: json['message']?.toString(),
      );
}

class NewsArticleService {
  NewsArticleService({Future<Map<String, dynamic>> Function(String)? fetch})
      : _fetch = fetch ?? ApiService.getNewsArticle;
  static final shared = NewsArticleService();
  final Future<Map<String, dynamic>> Function(String) _fetch;
  final Map<String, NewsArticleDetail> _cache = {};
  final Map<String, Future<NewsArticleDetail>> _pending = {};
  Future<NewsArticleDetail> get(String id, {bool force = false}) {
    if (_pending[id] != null) return _pending[id]!;
    final cached = _cache.remove(id);
    if (!force && cached != null && cached.available) {
      _cache[id] = cached;
      return Future.value(cached);
    }
    final future = _load(id);
    _pending[id] = future;
    return future.whenComplete(() {
      if (identical(_pending[id], future)) _pending.remove(id);
    });
  }

  Future<NewsArticleDetail> _load(String id) async {
    final detail = NewsArticleDetail.fromJson(await _fetch(id));
    while (_cache.length >= 8) {
      _cache.remove(_cache.keys.first);
    }
    if (detail.available) _cache[id] = detail;
    return detail;
  }
}
