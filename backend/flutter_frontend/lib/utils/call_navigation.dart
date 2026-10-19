import 'package:flutter/widgets.dart';

/// Never pop whatever route happens to be on top after an async callback.
void dismissCallRoute(BuildContext context) {
  if (!context.mounted) return;
  final route = ModalRoute.of(context);
  if (route != null && route.isActive) route.navigator?.removeRoute(route);
}
