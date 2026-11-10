import 'package:flutter/material.dart';

/// The same bundled typeface and text metrics on every device and workspace.
class AppTypography {
  static const family = 'Roboto';
  static const emojiFallback = ['Noto Color Emoji'];

  static const workspaceTitle = TextStyle(
      fontFamily: family, fontSize: 27, fontWeight: FontWeight.w700,
      height: 1.25, letterSpacing: 0);
  static const listTitle = TextStyle(
      fontFamily: family, fontSize: 15, fontWeight: FontWeight.w600,
      height: 1.35, letterSpacing: 0);
  static const body = TextStyle(
      fontFamily: family, fontSize: 15, fontWeight: FontWeight.w400,
      height: 1.4, letterSpacing: 0);
  static const supporting = TextStyle(
      fontFamily: family, fontSize: 13, fontWeight: FontWeight.w400,
      height: 1.4, letterSpacing: 0);
  static const sectionTitle = TextStyle(
      fontFamily: family, fontSize: 15, fontWeight: FontWeight.w700,
      height: 1.35, letterSpacing: 0);
  static const welcomeTitle = TextStyle(
      fontFamily: family, fontSize: 22, fontWeight: FontWeight.w700,
      height: 1.25, letterSpacing: 0);
  static const message = TextStyle(
      fontFamily: family, fontSize: 16, fontWeight: FontWeight.w600,
      height: 1.3, letterSpacing: -0.15);

  static TextStyle? _normalize(TextStyle? style) => style?.copyWith(
      fontFamily: family, fontFamilyFallback: emojiFallback, letterSpacing: 0);
  static TextTheme normalize(TextTheme theme) => theme.copyWith(
        displayLarge: _normalize(theme.displayLarge),
        displayMedium: _normalize(theme.displayMedium),
        displaySmall: _normalize(theme.displaySmall),
        headlineLarge: _normalize(theme.headlineLarge),
        headlineMedium: _normalize(theme.headlineMedium),
        headlineSmall: _normalize(theme.headlineSmall),
        titleLarge: _normalize(theme.titleLarge),
        titleMedium: _normalize(theme.titleMedium),
        titleSmall: _normalize(theme.titleSmall),
        bodyLarge: _normalize(theme.bodyLarge),
        bodyMedium: _normalize(theme.bodyMedium),
        bodySmall: _normalize(theme.bodySmall),
        labelLarge: _normalize(theme.labelLarge),
        labelMedium: _normalize(theme.labelMedium),
        labelSmall: _normalize(theme.labelSmall),
      );

  static const profileName = TextStyle(
      fontFamily: family,
      fontSize: 21,
      fontWeight: FontWeight.w700,
      height: 1.25,
      letterSpacing: 0);
  static const menuLabel = TextStyle(
      fontFamily: family,
      fontSize: 15,
      fontWeight: FontWeight.w600,
      height: 1.35,
      letterSpacing: 0);
  static const caption = TextStyle(
      fontFamily: family,
      fontSize: 13,
      fontWeight: FontWeight.w400,
      height: 1.35,
      letterSpacing: 0);
}
