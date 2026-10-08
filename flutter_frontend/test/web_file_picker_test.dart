import 'dart:async';
import 'package:flutter_frontend/utils/web_file_picker.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:universal_html/html.dart' as html;

class _File implements html.File {
  @override
  final String name;
  _File(this.name);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test('photo library enables multiple selection without forcing the camera', () {
    final input = WebFilePicker.createInput(accept: 'image/*', multiple: true);
    expect(input.multiple, isTrue);
    expect(input.accept, 'image/*');
    expect(input.getAttribute('capture'), isNull);
  });

  test('camera and other existing pickers remain single file', () {
    final camera = WebFilePicker.createInput(accept: 'image/*', capture: true, multiple: true);
    expect(camera.multiple, isFalse);
    expect(camera.getAttribute('capture'), 'environment');
    expect(WebFilePicker.createInput(accept: '*/*').multiple, isFalse);
  });

  test('all selected photos are sent in order, one upload at a time', () async {
    final files = [_File('a.jpg'), _File('b.jpg'), _File('c.jpg')];
    final gate = Completer<void>();
    final seen = <String>[];
    final sending = WebFilePicker.dispatchFiles(files, (file) async {
      seen.add(file.name);
      if (file.name == 'a.jpg') await gate.future;
    }, null);
    await Future<void>.delayed(Duration.zero);
    expect(seen, ['a.jpg']);
    gate.complete();
    await sending;
    expect(seen, ['a.jpg', 'b.jpg', 'c.jpg']);
  });

  test('one failed photo does not discard later photos; cancellation sends none', () async {
    final seen = <String>[];
    final errors = <String>[];
    Future<void> upload(html.File file) async {
      seen.add(file.name);
      if (file.name == 'a.jpg') throw StateError('upload failed');
    }
    await WebFilePicker.dispatchFiles([_File('a.jpg'), _File('b.jpg')], upload, errors.add);
    expect(seen, ['a.jpg', 'b.jpg']);
    expect(errors.single, contains('a.jpg'));
    await WebFilePicker.dispatchFiles([], upload, errors.add);
    expect(seen.length, 2);
  });
}
