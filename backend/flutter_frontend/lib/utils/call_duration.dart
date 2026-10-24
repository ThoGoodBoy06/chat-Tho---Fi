String formatCallDuration(int seconds) {
  final value = seconds < 0 ? 0 : seconds;
  final minutes = ((value ~/ 60) % 60).toString().padLeft(2, '0');
  final remainder = (value % 60).toString().padLeft(2, '0');
  return value >= 3600 ? '${(value ~/ 3600).toString().padLeft(2, '0')}:$minutes:$remainder' : '$minutes:$remainder';
}
