import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/news_service.dart';
import '../services/news_article_service.dart';
import '../widgets/skeleton_box.dart';

class NewsArticleScreen extends StatefulWidget {
  const NewsArticleScreen({super.key, required this.article, this.service});
  final NewsArticle article;
  final NewsArticleService? service;
  @override
  State<NewsArticleScreen> createState() => _NewsArticleScreenState();
}

class _NewsArticleScreenState extends State<NewsArticleScreen> {
  NewsArticleDetail? _detail;
  String? _error;
  bool _loading = true;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool force = false}) async {
    if (force)
      setState(() {
        _loading = true;
        _error = null;
      });
    try {
      final detail = await (widget.service ?? NewsArticleService.shared)
          .get(widget.article.id, force: force);
      if (mounted)
        setState(() {
          _detail = detail;
          _loading = false;
          _error = null;
        });
    } catch (_) {
      if (mounted)
        setState(() {
          _loading = false;
          _error = 'Chưa tải được bài báo. Kiểm tra kết nối rồi thử lại.';
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final article = widget.article;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = dark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final blocks = _detail?.blocks ?? [];
    return Scaffold(
      backgroundColor: dark ? const Color(0xFF0F172A) : Colors.white,
      appBar: AppBar(
        backgroundColor: dark ? const Color(0xFF0F172A) : Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
            onPressed: () => Navigator.of(context).pop(),
            tooltip: 'Quay lại tin tức',
            icon: const Icon(Icons.arrow_back_rounded)),
        title: Text(article.source,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
              onPressed: _loading ? null : () => _load(force: true),
              tooltip: 'Tải lại bài báo',
              icon: const Icon(Icons.refresh_rounded))
        ],
      ),
      body: SafeArea(
          top: false,
          child: Center(
              child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 780),
            child: ListView.builder(
              key: PageStorageKey('article_${article.id}'),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
              itemCount: 1 +
                  (_loading ? 1 : blocks.length) +
                  (!_loading && (_error != null || _detail?.available != true)
                      ? 1
                      : 0),
              itemBuilder: (context, index) {
                if (index == 0)
                  return Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(article.title,
                                style: const TextStyle(
                                    fontSize: 26,
                                    height: 1.25,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 12),
                            Text(
                                '${article.source} · ${DateFormat('HH:mm · dd/MM/yyyy').format(article.publishedAt.toLocal())}',
                                style: TextStyle(
                                    fontSize: 12, color: muted, height: 1.5)),
                          ]));
                if (_loading) return const _ArticleSkeleton();
                if (index > blocks.length)
                  return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(article.summary,
                            style: const TextStyle(fontSize: 17, height: 1.7)),
                        const SizedBox(height: 20),
                        Text(
                            _error ??
                                _detail?.message ??
                                'Nguồn báo chưa cung cấp nội dung đầy đủ.',
                            style: TextStyle(color: muted, height: 1.5)),
                        const SizedBox(height: 8),
                        TextButton.icon(
                            onPressed: () => _load(force: true),
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('Thử lại')),
                      ]);
                final block = blocks[index - 1];
                if (block.type == 'image')
                  return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child:
                          _ArticlePhoto(articleId: article.id, block: block));
                return Padding(
                    padding: EdgeInsets.only(
                        bottom: block.type == 'caption' ? 20 : 16),
                    child: SelectableText(block.text,
                        style: TextStyle(
                          fontSize: block.type == 'heading'
                              ? 21
                              : block.type == 'caption'
                                  ? 13
                                  : 17,
                          height: block.type == 'caption' ? 1.5 : 1.75,
                          color: block.type == 'caption' ? muted : null,
                          fontStyle:
                              block.type == 'quote' || block.type == 'caption'
                                  ? FontStyle.italic
                                  : FontStyle.normal,
                          fontWeight:
                              block.type == 'heading' || block.type == 'lead'
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                        )));
              },
            ),
          ))),
    );
  }
}

class _ArticlePhoto extends StatelessWidget {
  const _ArticlePhoto({required this.articleId, required this.block});
  final String articleId;
  final NewsBlock block;
  String get url => '${ApiService.baseUrl}/news/${Uri.encodeComponent(articleId)}/images/${block.imageId}';
  @override
  Widget build(BuildContext context) => AspectRatio(aspectRatio:block.aspectRatio,
    child:GestureDetector(onTap:()=>Navigator.of(context).push(MaterialPageRoute<void>(
      builder:(context)=>Scaffold(backgroundColor:Colors.black,
        appBar:AppBar(backgroundColor:Colors.black, foregroundColor:Colors.white, title:const Text('Xem ảnh')),
        body:SafeArea(child:Center(child:InteractiveViewer(minScale:1,maxScale:5,
          child:SizedBox(width:MediaQuery.sizeOf(context).width,
            height:MediaQuery.sizeOf(context).height-120,
            child:_ReaderPhoto(url:url, alt:block.alt))))),
      ),
    )),child:ClipRRect(borderRadius:BorderRadius.circular(12), child:_ReaderPhoto(url:url,alt:block.alt))));
}

class _ReaderPhoto extends StatefulWidget {
  const _ReaderPhoto({required this.url, required this.alt});
  final String url, alt;
  @override
  State<_ReaderPhoto> createState()=>_ReaderPhotoState();
}
class _ReaderPhotoState extends State<_ReaderPhoto> {
  int _attempt=0;
  @override
  Widget build(BuildContext context)=>Image.network(widget.url, key:ValueKey(_attempt),
    fit:BoxFit.contain, semanticLabel:widget.alt.isEmpty ? 'Ảnh trong bài báo' : widget.alt,
    cacheWidth:1440,
    frameBuilder:(_,child,frame,synchronous)=>synchronous || frame!=null ? child
      : const SkeletonBox(width:double.infinity,height:double.infinity,borderRadius:12),
    errorBuilder:(_,__,___)=>Center(child:Column(mainAxisSize:MainAxisSize.min,children:[
      const Icon(Icons.image_not_supported_outlined),const SizedBox(height:8),
      const Text('Chưa tải được ảnh'),
      TextButton(onPressed:() async {
        await ResizeImage(NetworkImage(widget.url),width:1440).evict();
        if(mounted)setState(()=>_attempt++);
      },child:const Text('Thử lại ảnh')),
    ])),
  );
}

class _ArticleSkeleton extends StatelessWidget {
  const _ArticleSkeleton();
  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < 3; i++)
          const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: SkeletonBox(height: 16)),
        const SizedBox(height: 12),
        const AspectRatio(
            aspectRatio: 1.5, child: SkeletonBox(borderRadius: 12)),
        const SizedBox(height: 24),
        for (var i = 0; i < 4; i++)
          const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: SkeletonBox(height: 16)),
      ]);
}
