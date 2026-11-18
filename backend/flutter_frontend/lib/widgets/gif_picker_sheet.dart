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
    _debounceTimer = Timer(const Duration(milliseconds: 320), () {
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

    return Container(
      height: screenHeight * 0.72,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 10, bottom: 6),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: isDark ? Colors.white24 : Colors.black12,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header: Title & Close
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: primaryColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.gif_box_rounded, color: primaryColor, size: 22),
                ),
                const SizedBox(width: 10),
                Text(
                  'Kho ảnh GIF & Sticker',
                  style: TextStyle(
                    color: textCol,
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(Icons.close_rounded, color: subTextCol, size: 20),
                  onPressed: () => Navigator.pop(context),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32),
                ),
              ],
            ),
          ),

          // Search Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Container(
              height: 42,
              decoration: BoxDecoration(
                color: searchBg,
                borderRadius: BorderRadius.circular(14),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, color: subTextCol, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: _onSearchChanged,
                      style: TextStyle(color: textCol, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Tìm kiếm ảnh GIF (cười, tim, mèo, nhảy...)',
                        hintStyle: TextStyle(color: subTextCol, fontSize: 13),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (_searchController.text.isNotEmpty)
                    IconButton(
                      icon: Icon(Icons.clear_rounded, color: subTextCol, size: 16),
                      onPressed: () {
                        _searchController.clear();
                        _fetchGifs(query: '', category: _selectedCategory);
                      },
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 24),
                    ),
                ],
              ),
            ),
          ),

          // Category Chips Bar
          if (_categories.isNotEmpty)
            SizedBox(
              height: 38,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, i) {
                  final cat = _categories[i];
                  final catId = cat['id']?.toString() ?? '';
                  final isSelected = _selectedCategory == catId;
                  return ChoiceChip(
                    label: Text(
                      cat['name']?.toString() ?? '',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        color: isSelected ? Colors.white : textCol,
                      ),
                    ),
                    selected: isSelected,
                    selectedColor: primaryColor,
                    backgroundColor: searchBg,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: BorderSide.none,
                    onSelected: (_) => _onCategorySelected(catId),
                  );
                },
              ),
            ),

          const SizedBox(height: 8),

          // GIF Grid
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : _gifs.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.search_off_rounded, size: 48, color: subTextCol),
                            const SizedBox(height: 8),
                            Text(
                              'Không tìm thấy ảnh GIF phù hợp',
                              style: TextStyle(color: subTextCol, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(14, 4, 14, 18),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                          childAspectRatio: 1.25,
                        ),
                        itemCount: _gifs.length,
                        itemBuilder: (ctx, i) {
                          final item = _gifs[i];
                          final url = item['url']?.toString() ?? '';
                          final title = item['title']?.toString() ?? 'GIF';
                          return InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () {
                              Navigator.pop(context);
                              widget.onGifSelected(url);
                            },
                            child: Container(
                              decoration: BoxDecoration(
                                color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  Image.network(
                                    url,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Center(
                                      child: Icon(Icons.broken_image_rounded, color: subTextCol),
                                    ),
                                    loadingBuilder: (_, child, prog) {
                                      if (prog == null) return child;
                                      return Container(
                                        color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                                        child: Center(
                                          child: SizedBox(
                                            width: 22,
                                            height: 22,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              value: prog.expectedTotalBytes != null
                                                  ? prog.cumulativeBytesLoaded / prog.expectedTotalBytes!
                                                  : null,
                                            ),
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                  // Bottom gradient title
                                  Positioned(
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          begin: Alignment.bottomCenter,
                                          end: Alignment.topCenter,
                                          colors: [
                                            Colors.black.withOpacity(0.7),
                                            Colors.transparent,
                                          ],
                                        ),
                                      ),
                                      child: Text(
                                        title,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
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
