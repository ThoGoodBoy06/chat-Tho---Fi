import 'package:universal_html/html.dart' as html;

/// Keep the native picker synchronous so Safari preserves the user gesture.
class WebFilePicker {
  static void Function()? _closePrevious;

  static html.FileUploadInputElement createInput({
    required String accept,
    bool multiple = false,
    bool capture = false,
  }) {
    final input = html.FileUploadInputElement()..accept = accept;
    if (multiple && !capture) input.setAttribute('multiple', '');
    if (capture) input.setAttribute('capture', 'environment');
    return input;
  }

  /// Process one file at a time; a failed upload must not skip later photos.
  static Future<void> dispatchFiles(
    List<html.File> files,
    Future<void> Function(html.File) onFileSelected,
    void Function(String)? onError,
  ) async {
    for (final file in files) {
      try {
        await onFileSelected(file);
      } catch (error) {
        onError?.call('Không thể gửi ${file.name}: $error');
      }
    }
  }

  static void open({
    required String accept,
    bool multiple = false,
    bool capture = false,
    required Future<void> Function(html.File) onFileSelected,
    void Function(String)? onError,
  }) {
    _closePrevious?.call();
    final input = createInput(accept: accept, multiple: multiple, capture: capture);
    input.style.display = 'none';
    html.document.body?.children.add(input);
    var finished = false;
    late void Function(html.Event) onChange;
    late void Function(html.Event) onCancel;
    void cleanup() {
      if (finished) return;
      finished = true;
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove();
      _closePrevious = null;
    }
    onChange = (_) {
      // Snapshot before removing the input, including files provided by iCloud.
      final files = List<html.File>.of(input.files ?? <html.File>[]);
      cleanup();
      dispatchFiles(files, onFileSelected, onError);
    };
    onCancel = (_) => cleanup();
    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    _closePrevious = cleanup;
    try {
      input.click();
    } catch (error) {
      cleanup();
      onError?.call('Không thể mở bộ chọn ảnh: $error');
    }
  }
}
