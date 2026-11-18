import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class GifPickerSheet extends StatefulWidget {
  final ValueChanged<String> onGifSelected;

  const GifPickerSheet({
    Key? key,
    required this.onGifSelected,
  }) : super(key: key);

  static void show(BuildContext context, {required ValueChanged<String> onGifSelected}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => GifPickerSheet(onGifSelected: onGifSelected),
    );
  }

  @override
  State<GifPickerSheet> createState() => _GifPickerSheetState();
}

class _GifPickerSheetState extends State<GifPickerSheet> {
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _gifs = [];
  List<dynamic> _categories = [];
  String _selectedCategory = 'all';
  bool _isLoading = true;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _fetchGifs();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchGifs({String query = '', String category = 'all'}) async {
    setState(() => _isLoading = true);
    final res = await ApiService.getGifs(query: query, category: category);
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _gifs = (res['data'] as List?) ?? [];
      if (_categories.isEmpty) {
        _categories = (res['categories'] as List?) ?? [];
      }
    });
  }

  void _onSearchChanged(String val) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 280), () {
      if (mounted) {
        _fetchGifs(query: val, category: _selectedCategory);
      }
    });
  }

  void _onCategorySelected(String catId) {
    if (_selectedCategory == catId) return;
    setState(() {
      _selectedCategory = catId;
    });
    _fetchGifs(query: _searchController.text, category: catId);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textCol = isDark ? Colors.white : const Color(0xFF0F172A);
    final subTextCol = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final searchBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);
    final primaryColor = Theme.of(context).primaryColor;

    final screenHeight = MediaQuery.of(context).size.height;
    final modalHeight = (screenHeight * 0.56).clamp(380.0, 520.0);

    return Container(
      height: modalHeight,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.18),
            blurRadius: 18,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 8, bottom: 4),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.white24 : Colors.black12,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header: Title & Close
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Icon(Icons.gif_box_rounded, color: primaryColor, size: 22),
                const SizedBox(width: 8),
                Text(
                  'Kho ảnh GIF & Sticker',
                  style: TextStyle(
                    color: textCol,
                    fontSize: 15.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: subTextCol, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                ),
              ],
            ),
          ),

          // Compact Search Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Container(
              height: 36,
              decoration: BoxDecoration(
                color: searchBg,
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, color: subTextCol, size: 18),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      style: TextStyle(color: textCol, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Tìm kiếm Bubu, Dudu, mèo cute, cười...',
                        hintStyle: TextStyle(color: subTextCol, fontSize: 12.5),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (_searchController.text.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _searchController.clear();
                        _fetchGifs(query: '', category: _selectedCategory);
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Icon(Icons.clear_rounded, color: subTextCol, size: 16),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Compact Category Chips Bar
          if (_categories.isNotEmpty)
            SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (ctx, i) {
                  final cat = _categories[i];
                  final catId = cat['id']?.toString() ?? '';
                  final isSelected = _selectedCategory == catId;
                  return InkWell(
                    onTap: () => _onCategorySelected(catId),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isSelected ? primaryColor : searchBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        cat['name']?.toString() ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? Colors.white : textCol,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

          const SizedBox(height: 6),

          // 3-Column Compact Sticker Grid
          Expanded(
            child: _isLoading
                ? const Center(
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : _gifs.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.search_off_rounded, size: 36, color: subTextCol),
                            const SizedBox(height: 6),
                            Text(
                              'Không tìm thấy ảnh GIF phù hợp',
                              style: TextStyle(color: subTextCol, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 2, 12, 14),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 3,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                          childAspectRatio: 1.0,
                        ),
                        itemCount: _gifs.length,
                        itemBuilder: (ctx, i) {
                          final item = _gifs[i];
                          final rawPreview = item['previewUrl']?.toString() ?? item['url']?.toString() ?? '';
                          final rawFull = item['url']?.toString() ?? rawPreview;
                          final previewUrl = ApiService.formatImageUrl(rawPreview);
                          final fullUrl = ApiService.formatImageUrl(rawFull);
                          final title = item['title']?.toString() ?? 'GIF';

                          return InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () {
                              Navigator.pop(context);
                              widget.onGifSelected(fullUrl);
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF334155).withOpacity(0.5) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isDark ? Colors.white10 : Colors.black.withOpacity(0.04),
                                ),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  Image.network(
                                    previewUrl,
                                    fit: BoxFit.contain,
                                    errorBuilder: (_, __, ___) => Center(
                                      child: Icon(Icons.broken_image_rounded, size: 20, color: subTextCol),
                                    ),
                                    loadingBuilder: (_, child, prog) {
                                      if (prog == null) return child;
                                      return Center(
                                        child: SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            value: prog.expectedTotalBytes != null
                                                ? prog.cumulativeBytesLoaded / prog.expectedTotalBytes!
                                                : null,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                  // Subtle hover/tap tooltip
                                  Positioned(
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.bottomCenter,
                                          end: Alignment.topCenter,
                                          colors: [
                                            Colors.black.withOpacity(0.55),
                                            Colors.transparent,
                                          ],
                                        ),
                                      ),
                                      child: Text(
                                        title,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        textAlign: TextAlign.center,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
