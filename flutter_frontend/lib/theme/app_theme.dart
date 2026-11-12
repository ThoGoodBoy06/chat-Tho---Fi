import 'app_typography.dart';
import 'package:flutter/material.dart';

/// Shared mobile controls: clear focus, comfortable touch targets and calm surfaces.
class AppTheme {
  static ThemeData create(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
            seedColor: const Color(0xFF0068FF), brightness: brightness)
        .copyWith(
      primary: dark ? const Color(0xFF80B4FF) : const Color(0xFF0068FF),
      surface: dark ? const Color(0xFF1E293B) : Colors.white,
    );
    final shape =
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
    final theme = ThemeData(
      splashFactory: InkSparkle.splashFactory,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: ZoomPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.linux: ZoomPageTransitionsBuilder(),
        },
      ),
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      primaryColor: const Color(0xFF0068FF),
      fontFamily: AppTypography.family,
      fontFamilyFallback: AppTypography.emojiFallback,
      scaffoldBackgroundColor:
          dark ? const Color(0xFF0F172A) : const Color(0xFFF7F9FC),
      appBarTheme: AppBarTheme(
          backgroundColor: scheme.surface,
          foregroundColor: scheme.onSurface,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false),
      elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
              minimumSize: const Size(48, 52),
              elevation: 0,
              backgroundColor: scheme.primary,
              foregroundColor: scheme.onPrimary,
              shape: shape,
              textStyle: const TextStyle(
                  fontFamily: AppTypography.family,
                  fontSize: 15,
                  fontWeight: FontWeight.w700))),
      filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
              minimumSize: const Size(48, 52), shape: shape)),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
              minimumSize: const Size(48, 48), shape: shape)),
      textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
              minimumSize: const Size(48, 48), shape: shape)),
      iconButtonTheme: IconButtonThemeData(
          style: IconButton.styleFrom(minimumSize: const Size(48, 48))),
      navigationBarTheme: NavigationBarThemeData(
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          backgroundColor: scheme.surface,
          indicatorColor: scheme.primary.withOpacity(0.16),
          indicatorShape: const StadiumBorder(),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
              size: 24,
              color: states.contains(WidgetState.selected)
                  ? scheme.primary
                  : scheme.onSurfaceVariant)),
          labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
              fontFamily: AppTypography.family,
              fontSize: 11,
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w700
                  : FontWeight.w500,
              color: states.contains(WidgetState.selected)
                  ? scheme.primary
                  : scheme.onSurfaceVariant))),
      badgeTheme: const BadgeThemeData(
          backgroundColor: Color(0xFFEF4444),
          textColor: Colors.white,
          textStyle: TextStyle(
              fontFamily: AppTypography.family,
              fontSize: 11,
              fontWeight: FontWeight.w700)),
      inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: dark ? const Color(0xFF0F172A) : const Color(0xFFF3F6FA),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: scheme.outlineVariant)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: scheme.primary, width: 2))),
      snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
    );
    return theme.copyWith(
      textTheme: AppTypography.normalize(theme.textTheme),
      primaryTextTheme: AppTypography.normalize(theme.primaryTextTheme),
    );
  }
}
