import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../services/api_service.dart';
import '../services/network_status.dart';
import '../utils/avatar_image.dart';

ImageProvider profileCoverImage(String? url) {
  if (url == null || url.isEmpty) {
    return const ExactAssetImage('assets/profile-cover-bay.webp');
  }
  return ResizeImage(NetworkImage(ApiService.formatImageUrl(url)), width: 1200);
}

/// Starts as soon as cached account data is displayed, without waiting for API
/// refreshes, message preloads or the first visit to the profile tab.
class AccountImageWarmup extends StatelessWidget {
  const AccountImageWarmup({super.key});
  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ChatProvider>();
    final user = provider.currentUser;
    final images = <ImageProvider>[];
    if (user != null) {
      if (user.avatar?.isNotEmpty == true) {
        final image = NetworkImage(ApiService.formatImageUrl(user.avatar!));
        images.add(resizeAvatar(image, size: 192));
      }
      images.add(profileCoverImage(user.coverImage));
      if (user.avatar?.isNotEmpty == true) {
        images.add(resizeAvatar(
            NetworkImage(ApiService.formatImageUrl(user.avatar!)),
            size: 384));
      }
      for (final conversation in provider.conversations.take(12)) {
        if (conversation.avatar?.isNotEmpty == true) {
          images.add(resizeAvatar(
              NetworkImage(ApiService.formatImageUrl(conversation.avatar!)),
              size: 192));
        }
      }
    }
    return ValueListenableBuilder<bool>(
      valueListenable: NetworkStatus.online,
      builder: (_, online, __) =>
          ImageWarmup(key: ValueKey(user?.id), images: images, enabled: online),
    );
  }
}

/// Two workers share the same ImageCache keys as the visible widgets. Rebuilds
/// do not download duplicates; changed/versioned URLs are warmed automatically.
class ImageWarmup extends StatefulWidget {
  const ImageWarmup(
      {super.key, required this.images, this.enabled = true, this.load});
  final List<ImageProvider> images;
  final bool enabled;
  @visibleForTesting
  final Future<void> Function(ImageProvider, BuildContext)? load;
  @override
  State<ImageWarmup> createState() => _ImageWarmupState();
}

class _ImageWarmupState extends State<ImageWarmup> {
  final _done = <ImageProvider>{};
  final _running = <ImageProvider>{};
  final _failed = <ImageProvider>{};
  bool _scheduled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _schedule();
  }

  @override
  void didUpdateWidget(ImageWarmup oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.enabled && widget.enabled) _failed.clear();
    _schedule();
  }

  void _schedule() {
    if (_scheduled || !widget.enabled) return;
    _scheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scheduled = false;
      if (mounted) _drain();
    });
  }

  void _drain() {
    if (!mounted || !widget.enabled) return;
    for (final image in widget.images.toSet()) {
      if (_running.length >= 2) break;
      if (_done.contains(image) ||
          _running.contains(image) ||
          _failed.contains(image)) continue;
      _running.add(image);
      unawaited(_warm(image));
    }
  }

  Future<void> _warm(ImageProvider image) async {
    var success = true;
    try {
      if (widget.load != null) {
        await widget.load!(image, context);
      } else {
        await precacheImage(image, context, onError: (_, __) {
          success = false;
        });
      }
    } catch (_) {
      success = false;
    }
    _running.remove(image);
    if (!mounted) return;
    (success ? _done : _failed).add(image);
    _drain();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
