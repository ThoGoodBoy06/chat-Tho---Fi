import 'app_avatar.dart';
import 'package:flutter/material.dart';

/// One responsive composition for ringing, connecting, connected and ended calls.
/// Media and signaling stay with the call owner; rebuilding this view never ends it.
class CallSurface extends StatelessWidget {
  const CallSurface({super.key, required this.name, this.avatar, required this.video,
    required this.status, required this.actions, this.duration, this.notice,
    this.videoView, this.localVideoView, this.onRepairAudio, this.connected = false,
    this.ended = false, this.incoming = false});
  final String name, status;
  final String? avatar, notice, duration;
  final bool video, connected, ended, incoming;
  final List<Widget> actions;
  final Widget? videoView, localVideoView;
  final VoidCallback? onRepairAudio;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    return Material(
      color: const Color(0xFF101923),
      child: Stack(fit: StackFit.expand, children: [
        if (videoView != null && !ended) videoView!,
        // Flat scrims keep controls legible over either a camera or the backdrop.
        if (videoView != null && !ended)
          const IgnorePointer(child: DecoratedBox(decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [Color(0xB3101923), Color(0x00101923), Color(0xE6101923)],
              stops: [0, .45, 1])))),
        SafeArea(child: LayoutBuilder(builder: (context, constraints) {
          final compact = constraints.maxHeight < 560;
          return Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(padding: EdgeInsets.fromLTRB(24, compact ? 12 : 24, 24, compact ? 12 : 28),
              child: Column(children: [
                Expanded(child: Align(alignment: videoView != null && connected && !ended ? Alignment.topCenter : Alignment.center,
                  child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    if (!(videoView != null && connected && !ended)) ...[
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: .93, end: 1),
                        duration: Duration(milliseconds: reduceMotion ? 0 : 260),
                        curve: Curves.easeOutCubic,
                        builder: (_, scale, child) => Transform.scale(scale: scale, child: child),
                        child: Container(padding: const EdgeInsets.all(9),
                          decoration: BoxDecoration(shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFF3B4F63))),
                          child: AppAvatar(radius: compact ? 40 : 56,
                            backgroundColor: const Color(0xFF334F6B),
                            foregroundImage: avatar != null && avatar!.isNotEmpty ? NetworkImage(avatar!) : null,
                            child: Text(name.isEmpty ? '?' : name.characters.first.toUpperCase(),
                              style: TextStyle(fontSize: compact ? 34 : 44, color: Colors.white, fontWeight: FontWeight.w500)))),
                      ),
                      SizedBox(height: compact ? 18 : 26),
                    ],
                    Text(name, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 30, height: 1.15, fontWeight: FontWeight.w600, letterSpacing: -.8)),
                    const SizedBox(height: 12),
                    AnimatedSwitcher(duration: Duration(milliseconds: reduceMotion ? 0 : 160),
                      child: Text(status, key: ValueKey(status), textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFFB2C3D3), fontSize: 15, height: 1.5))),
                    if (duration != null) Padding(padding: const EdgeInsets.only(top: 10),
                      child: Text(duration!, style: const TextStyle(color: Color(0xFF88E3C3), fontSize: 18, letterSpacing: 1.5))),
                    if (notice != null) Padding(padding: const EdgeInsets.only(top: 20),
                      child: Text(notice!, textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFFFFD4AA), fontSize: 13, height: 1.5))),
                    if (onRepairAudio != null) Padding(padding: const EdgeInsets.only(top: 12),
                      child: TextButton.icon(onPressed: onRepairAudio,
                        icon: const Icon(Icons.hearing_rounded, size: 18),
                        label: const Text('Thử lại âm thanh'),
                        style: TextButton.styleFrom(foregroundColor: const Color(0xFFBBD9FF), minimumSize: const Size(48, 48)))),
                  ])))),
                if (localVideoView != null && !ended)
                  Align(alignment: Alignment.centerRight, child: Container(
                    width: compact ? 76 : 92, height: compact ? 100 : 122,
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(color: const Color(0xFF233140), borderRadius: BorderRadius.circular(18)),
                    clipBehavior: Clip.antiAlias, child: localVideoView)),
                Row(mainAxisAlignment: incoming ? MainAxisAlignment.spaceAround : MainAxisAlignment.spaceEvenly,
                  crossAxisAlignment: CrossAxisAlignment.start, children: actions),
              ]))));
        })),
      ]),
    );
  }
}

class CallControl extends StatelessWidget {
  const CallControl({super.key, required this.icon, required this.label, required this.onPressed,
    this.active = false, this.color, this.busy = false});
  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool active, busy;
  final Color? color;
  @override
  Widget build(BuildContext context) => Flexible(child: Padding(
    padding: const EdgeInsets.symmetric(horizontal: 3),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Semantics(button: true, label: label, enabled: !busy && onPressed != null,
        onTap: busy ? null : onPressed, excludeSemantics: true,
        child: AnimatedContainer(duration: Duration(milliseconds: MediaQuery.of(context).disableAnimations ? 0 : 140),
        decoration: BoxDecoration(shape: BoxShape.circle,
          color: color ?? (active ? const Color(0xFFEAF2F9) : const Color(0xFF2C3B4A))),
        child: IconButton(onPressed: busy ? null : onPressed,
          constraints: const BoxConstraints.tightFor(width: 60, height: 60),
          icon: busy ? const SizedBox(width: 23, height: 23, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Icon(icon, size: 26, color: active && color == null ? const Color(0xFF172433) : Colors.white)))),
      const SizedBox(height: 9),
      Text(label, textAlign: TextAlign.center, maxLines: 2,
        style: const TextStyle(color: Color(0xFFC4D0DC), fontSize: 11, height: 1.3)),
    ])));
}
