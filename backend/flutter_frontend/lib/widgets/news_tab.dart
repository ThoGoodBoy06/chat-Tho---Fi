import 'tab_design.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../screens/news_article_screen.dart';
import '../services/news_service.dart';
import '../services/api_service.dart';
import 'skeleton_box.dart';

class NewsTab extends StatefulWidget {
  const NewsTab({super.key, this.service, this.onOpenArticle});
  final NewsService? service;
  final ValueChanged<String>? onOpenArticle;
  @override
  State<NewsTab> createState() => _NewsTabState();
}

class _NewsTabState extends State<NewsTab> with WidgetsBindingObserver {
  static const _categories = {
    'Vietnam': 'Việt Nam',
    'World': 'Thế giới',
    'Tech_AI': 'Công nghệ'
  };
  NewsService get _service => widget.service ?? NewsService.shared;
  NewsFeed? _feed;
  String _category = 'Vietnam';
  bool _loading = true;
  String? _error;
  Timer? _refreshTimer;
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      if (_foreground && !_loading) _load(force: true);
    });
    _load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground && !_loading) _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool force = false}) async {
    if (force)
      setState(() {
        _loading = true;
        _error = null;
      });
    final cached = await _service.cached();
    if (!mounted) return;
    if (cached != null) setState(() => _feed = cached);
    try {
      final feed = await _service.refresh(force: force);
      if (mounted)
        setState(() {
          _feed = feed;
          _loading = false;
          _error = null;
        });
    } catch (_) {
      if (mounted)
        setState(() {
          _loading = false;
          _error = _feed == null
              ? 'Không tải được tin tức. Kiểm tra kết nối rồi thử lại.'
              : 'Chưa cập nhật được. Đang hiển thị tin đã lưu.';
        });
    }
  }

  Future<void> _open(NewsArticle article) async {
    if (widget.onOpenArticle != null) {
      widget.onOpenArticle!(article.link);
      return;
    }
    await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => NewsArticleScreen(article: article)));
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final articles =
        _feed?.articles.where((a) => a.category == _category).toList() ?? [];
    final initialLoading = _feed == null && _loading;
    return ColoredBox(
      color: dark ? const Color(0xFF0F172A) : Colors.white,
      child: Center(
          child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 840),
              child: Column(children: [
                TabHeading(title: 'Tin tức', actions: [
                  IconButton(
                      onPressed: _loading ? null : () => _load(force: true),
                      tooltip: 'Làm mới tin tức',
                      icon: const Icon(Icons.refresh_rounded,
                          color: Color(0xFF0068FF))),
                ]),
                Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: _categories.entries
                          .map((entry) => Expanded(
                                  child: Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 4),
                                child: TextButton(
                                  onPressed: () =>
                                      setState(() => _category = entry.key),
                                  style: TextButton.styleFrom(
                                    minimumSize: const Size(0, 44),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4),
                                    foregroundColor: _category == entry.key
                                        ? Colors.white
                                        : muted,
                                    backgroundColor: _category == entry.key
                                        ? const Color(0xFF0068FF)
                                        : dark
                                            ? const Color(0xFF1E293B)
                                            : const Color(0xFFF2F5FA),
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(12)),
                                  ),
                                  child: Text(entry.value,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                ),
                              )))
                          .toList(),
                    )),
                Padding(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 10),
                    child: Row(children: [
                      Expanded(
                          child: Text(
                              _error ??
                                  (_feed?.stale == true
                                      ? 'Đang hiển thị tin đã lưu từ các báo.'
                                      : _feed?.updatedAt != null
                                          ? 'Cập nhật ${DateFormat('HH:mm · dd/MM').format(_feed!.updatedAt!.toLocal())}'
                                          : 'Tin mới từ các báo'),
                              style: TextStyle(fontSize: 12, color: muted))),
                    ])),
                SizedBox(
                    height: 2,
                    child: _loading && _feed != null
                        ? const LinearProgressIndicator(minHeight: 2)
                        : null),
                const Divider(height: 1),
                Expanded(
                  child: initialLoading
                      ? ListView.builder(
                          itemCount: 5,
                          itemBuilder: (_, i) => i == 0
                              ? const NewsLeadArticle()
                              : const NewsArticleRow())
                      : RefreshIndicator(
                          onRefresh: () => _load(force: true),
                          child: articles.isEmpty
                              ? LayoutBuilder(
                                  builder: (context, constraints) => ListView(
                                        physics:
                                            const AlwaysScrollableScrollPhysics(),
                                        children: [
                                          SizedBox(
                                              height: constraints.maxHeight,
                                              child: Center(
                                                  child: Padding(
                                                padding:
                                                    const EdgeInsets.all(24),
                                                child: Column(
                                                    mainAxisSize:
                                                        MainAxisSize.min,
                                                    children: [
                                                      Icon(
                                                          Icons
                                                              .newspaper_rounded,
                                                          size: 40,
                                                          color: muted),
                                                      const SizedBox(
                                                          height: 12),
                                                      Text(
                                                          _error ??
                                                              'Chưa tải được tin ${_categories[_category]}.',
                                                          textAlign:
                                                              TextAlign.center),
                                                      const SizedBox(height: 8),
                                                      TextButton(
                                                          onPressed: _loading
                                                              ? null
                                                              : () => _load(
                                                                  force: true),
                                                          child: const Text(
                                                              'Thử lại')),
                                                    ]),
                                              ))),
                                        ],
                                      ))
                              : ListView.builder(
                                  key: PageStorageKey('news_$_category'),
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  itemCount: articles.length,
                                  addAutomaticKeepAlives: false,
                                  itemBuilder: (_, i) => i == 0
                                      ? NewsLeadArticle(
                                          article: articles[i],
                                          onTap: () => _open(articles[i]))
                                      : NewsArticleRow(
                                          key: ValueKey(articles[i].id),
                                          article: articles[i],
                                          onTap: () => _open(articles[i])),
                                ),
                        ),
                ),
              ]))),
    );
  }
}

/// Loading and loaded rows share all spacing and fixed media/text slots.
class NewsArticleRow extends StatelessWidget {
  const NewsArticleRow({super.key, this.article, this.onTap});
  final NewsArticle? article;
  final VoidCallback? onTap;

  Widget _lines(int count, double height, {double lastWidth = 0.7}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(
            count,
            (i) => SizedBox(
                  height: height,
                  child: Align(
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: i == count - 1 ? lastWidth : 1,
                        child:
                            SkeletonBox(height: height * 0.6, borderRadius: 4),
                      )),
                )),
      );

  @override
  Widget build(BuildContext context) {
    final loading = article == null;
    final titleLines = MediaQuery.sizeOf(context).width >= 700 ? 2 : 3;
    final scaler = MediaQuery.textScalerOf(context);
    final muted = Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF94A3B8)
        : const Color(0xFF64748B);
    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
              height: scaler.scale(17),
              child: loading
                  ? _lines(1, scaler.scale(17), lastWidth: 0.6)
                  : Text(
                      '${article!.source} · ${DateFormat('HH:mm dd/MM').format(article!.publishedAt.toLocal())}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          TextStyle(color: muted, fontSize: 11, height: 1.5))),
          const SizedBox(height: 7),
          SizedBox(
              height: scaler.scale(16) * 1.35 * titleLines,
              child: loading
                  ? _lines(titleLines, scaler.scale(16) * 1.35)
                  : Text(article!.title,
                      maxLines: titleLines,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          height: 1.35))),
          const SizedBox(height: 7),
          SizedBox(
              height: scaler.scale(13) * 1.4 * 2,
              child: loading
                  ? _lines(2, scaler.scale(13) * 1.4)
                  : Text(article!.summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style:
                          TextStyle(fontSize: 13, color: muted, height: 1.4))),
        ])),
        const SizedBox(width: 14),
        SizedBox(
            width: 88,
            height: 88,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: loading
                  ? const SkeletonBox(width: 88, height: 88, borderRadius: 12)
                  : article!.imageUrl == null
                      ? _missingImage(muted)
                      : Image.network(
                          '${ApiService.baseUrl}/news/image/${Uri.encodeComponent(article!.id)}',
                          width: 88,
                          height: 88,
                          fit: BoxFit.cover,
                          cacheWidth: 264,
                          frameBuilder: (_, child, frame, synchronous) =>
                              synchronous || frame != null
                                  ? child
                                  : const SkeletonBox(
                                      width: 88, height: 88, borderRadius: 12),
                          errorBuilder: (_, __, ___) => _missingImage(muted)),
            )),
      ]),
    );
    return Column(children: [
      Material(
          color: Colors.transparent,
          child: InkWell(
              onTap: onTap,
              child: Semantics(
                  button: !loading,
                  label: loading
                      ? 'Đang tải tin tức'
                      : 'Đọc bài báo: ${article!.title}',
                  child: content))),
      const Divider(height: 1, indent: 20, endIndent: 20),
    ]);
  }

  Widget _missingImage(Color color) => ColoredBox(
      color: color.withOpacity(0.08),
      child: Icon(Icons.newspaper_rounded, size: 28, color: color));
}

/// The leading story reserves the same image bounds before and after decoding.
class NewsLeadArticle extends StatelessWidget {
  const NewsLeadArticle({super.key, this.article, this.onTap});
  final NewsArticle? article;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: AspectRatio(
                    aspectRatio: 1.65,
                    child: article == null
                        ? const SkeletonBox(borderRadius: 18)
                        : article!.imageUrl == null
                            ? ColoredBox(
                                color: muted.withOpacity(0.08),
                                child: Icon(Icons.newspaper_rounded,
                                    color: muted, size: 40))
                            : Image.network(
                                '${ApiService.baseUrl}/news/image/${Uri.encodeComponent(article!.id)}',
                                fit: BoxFit.cover,
                                cacheWidth: 1200,
                                frameBuilder: (_, child, frame, synchronous) =>
                                    synchronous || frame != null
                                        ? child
                                        : const SkeletonBox(borderRadius: 18),
                                errorBuilder: (_, __, ___) => ColoredBox(
                                    color: muted.withOpacity(0.08),
                                    child: Icon(Icons.newspaper_rounded,
                                        color: muted, size: 40))),
                  )),
              const SizedBox(height: 14),
              article == null
                  ? const SkeletonBox(width: 160, height: 14)
                  : Text(
                      '${article!.source} · ${DateFormat('HH:mm dd/MM').format(article!.publishedAt.toLocal())}',
                      style: TextStyle(color: muted, fontSize: 11)),
              const SizedBox(height: 8),
              article == null
                  ? const SkeletonBox(height: 54)
                  : Text(article!.title,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 21,
                          fontWeight: FontWeight.w800,
                          height: 1.3,
                          letterSpacing: -0.4)),
              const SizedBox(height: 8),
              article == null
                  ? const SkeletonBox(height: 36)
                  : Text(article!.summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style:
                          TextStyle(fontSize: 13, height: 1.5, color: muted)),
            ]),
          ),
        ));
  }
}
