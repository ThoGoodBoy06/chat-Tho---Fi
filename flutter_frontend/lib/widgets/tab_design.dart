import 'package:flutter/material.dart';

/// Shared hierarchy for the five workspaces; actions retain their own semantics.
class TabHeading extends StatelessWidget {
  const TabHeading(
      {super.key,
      required this.title,
      this.showBrand = false,
      this.actions = const [],
      this.brandActions = const []});
  final String title;
  final bool showBrand;
  final List<Widget> actions, brandActions;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 12, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (showBrand) SizedBox(
              height: 42,
              child: Row(children: [
                Image.asset('assets/tho_fi_logo_transparent.png',
                    scale: 1, width: 25, height: 25),
                const SizedBox(width: 8),
                const Expanded(
                    child: Text('Chat Tho-Fi',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: Color(0xFF0068FF),
                            fontSize: 17,
                            fontWeight: FontWeight.w700))),
                ...brandActions,
              ])),
          if (showBrand && title.isNotEmpty) const SizedBox(height: 10),
          if (title.isNotEmpty)
            Row(children: [
              Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontSize: 27,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.8))),
              if (!showBrand) ...brandActions,
              ...actions,
            ]),
        ]),
      );
}

class TabSearch extends StatelessWidget {
  const TabSearch(
      {super.key,
      required this.controller,
      required this.hint,
      required this.onChanged});
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final border = OutlineInputBorder(
        borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none);
    return Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
        child: TextField(
          controller: controller,
          onChanged: onChanged,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            isDense: true,
            prefixIcon: const Icon(Icons.search_rounded, size: 21),
            suffixIcon: controller.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Xóa tìm kiếm',
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () {
                      controller.clear();
                      onChanged('');
                    }),
            filled: true,
            fillColor: dark ? const Color(0xFF1E293B) : const Color(0xFFF2F5FA),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: border,
            enabledBorder: border,
            focusedBorder: border.copyWith(
                borderSide: BorderSide(
                    color: Theme.of(context).colorScheme.primary, width: 1.5)),
          ),
        ));
  }
}

class AiWelcome extends StatelessWidget {
  const AiWelcome({super.key, required this.onPrompt});
  final ValueChanged<String> onPrompt;
  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    const prompts = [
      (
        'Viết một lời chúc',
        'Dành cho một người đặc biệt',
        Icons.edit_outlined,
        'Giúp tôi viết một lời chúc sinh nhật ấm áp cho bạn thân.'
      ),
      (
        'Giải thích dễ hiểu',
        'Biến điều phức tạp thành đơn giản',
        Icons.lightbulb_outline_rounded,
        'Giải thích trí tuệ nhân tạo bằng ví dụ dễ hiểu trong cuộc sống.'
      ),
      (
        'Lên ý tưởng mới',
        'Cho công việc và cuộc sống mỗi ngày',
        Icons.auto_awesome_outlined,
        'Gợi ý cho tôi một vài hoạt động sáng tạo vào cuối tuần.'
      ),
    ];
    return ListView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
        children: [
          Center(
              child: Image.asset('assets/tho_fi_logo_transparent.png',
                  scale: 1, width: 80, height: 80)),
          const SizedBox(height: 24),
          const Text('Hôm nay mình giúp gì cho bạn?',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  height: 1.25)),
          const SizedBox(height: 12),
          Text('Cùng tìm câu trả lời và khơi nguồn ý tưởng.',
              textAlign: TextAlign.center,
              style: TextStyle(color: muted, fontSize: 13, height: 1.5)),
          const SizedBox(height: 30),
          for (final prompt in prompts)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Material(
                  color:
                      dark ? const Color(0xFF1E293B) : const Color(0xFFF4F7FC),
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => onPrompt(prompt.$4),
                    child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(children: [
                          Icon(prompt.$3,
                              color: Theme.of(context).colorScheme.primary,
                              size: 23),
                          const SizedBox(width: 14),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(prompt.$1,
                                    style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text(prompt.$2,
                                    style: TextStyle(
                                        color: muted,
                                        fontSize: 12,
                                        height: 1.4)),
                              ])),
                          Icon(Icons.chevron_right_rounded,
                              color: muted, size: 19)
                        ])),
                  )),
            ),
        ]);
  }
}
