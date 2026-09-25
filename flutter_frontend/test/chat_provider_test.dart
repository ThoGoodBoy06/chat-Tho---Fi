import 'dart:async';
import 'dart:convert';

import 'package:flutter_frontend/models/models.dart';
import 'package:flutter_frontend/providers/chat_provider.dart';
import 'package:flutter_frontend/services/api_service.dart';
import 'package:flutter_frontend/services/socket_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _PendingResponse {
  final started = Completer<void>();
  final response = Completer<http.Response>();

  void complete(List<Map<String, dynamic>> data, {int status = 200}) {
    response.complete(http.Response(jsonEncode({'data': data}), status));
  }
}

class _ApiHarness {
  final _pending = <String, List<_PendingResponse>>{};
  final requests = <String, int>{};
  final unexpected = <String>[];

  _PendingResponse enqueue(String path) {
    final pending = _PendingResponse();
    (_pending[path] ??= []).add(pending);
    return pending;
  }

  Future<http.Response> handle(http.Request request) async {
    if (request.method == 'POST') {
      return http.Response('{}', 200);
    }
    final path = request.url.path;
    requests[path] = (requests[path] ?? 0) + 1;
    final queue = _pending[path];
    if (queue == null || queue.isEmpty) {
      unexpected.add('${request.method} $path');
      return http.Response('{}', 500);
    }
    final pending = queue.removeAt(0);
    pending.started.complete();
    return pending.response.future;
  }
}

UserModel _user(String id) => UserModel(id: id, username: id, fullName: id);

ConversationModel _conversation(String id) => ConversationModel(id: id, name: id);

Map<String, dynamic> _message(String id, String conversationId, {int second = 0}) => {
      'id': id,
      'conversationId': conversationId,
      'senderId': 'partner',
      'content': 'Message $id',
      'createdAt': DateTime.utc(2026, 1, 1, 0, 0, second).toIso8601String(),
    };

List<String> _messageIds(ChatProvider provider) =>
    provider.messages.map((message) => message.id).toList();

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _ApiHarness api;
  late ChatProvider provider;
  var disposed = false;

  setUp(() {
    SharedPreferences.setMockInitialValues({'authToken': 'test-token'});
    api = _ApiHarness();
    ApiService.setClientForTesting(MockClient(api.handle));
    // Socket connection is unrelated to these HTTP state transitions.
    provider = ChatProvider()..currentUser = _user('alice');
    disposed = false;
  });

  tearDown(() {
    if (!disposed) provider.dispose();
    SocketService.disconnect();
    expect(api.unexpected, isEmpty, reason: 'All test HTTP traffic must be mocked.');
  });

  test('a slow previous conversation cannot replace the current conversation', () async {
    final a = api.enqueue('/api/chat/a/messages');
    final b = api.enqueue('/api/chat/b/messages');
    final loadingA = provider.selectConversation(_conversation('a'));
    await a.started.future;
    final loadingB = provider.selectConversation(_conversation('b'));
    await b.started.future;

    b.complete([_message('b-1', 'b')]);
    await loadingB;
    a.complete([_message('a-1', 'a')]);
    await loadingA;

    expect(provider.selectedConversationId, 'b');
    expect(_messageIds(provider), ['b-1']);
    expect(provider.isLoadingMessages, isFalse);
  });

  test('rapidly reopening a loading conversation reuses its pending request', () async {
    final a = api.enqueue('/api/chat/a/messages');
    final b = api.enqueue('/api/chat/b/messages');
    final firstA = provider.selectConversation(_conversation('a'));
    await a.started.future;
    final loadingB = provider.selectConversation(_conversation('b'));
    await b.started.future;
    final secondA = provider.selectConversation(_conversation('a'));

    a.complete([_message('a-1', 'a')]);
    b.complete([_message('b-1', 'b')]);
    await Future.wait([firstA, loadingB, secondA]);

    expect(api.requests['/api/chat/a/messages'], 1);
    expect(provider.selectedConversationId, 'a');
    expect(_messageIds(provider), ['a-1']);
  });

  test('logout prevents a late message response from restoring old state', () async {
    final pending = api.enqueue('/api/chat/a/messages');
    final loading = provider.selectConversation(_conversation('a'));
    await pending.started.future;

    provider.clearCurrentUser();
    pending.complete([_message('private-a', 'a')]);
    await loading;

    expect(provider.currentUser, isNull);
    expect(provider.selectedConversation, isNull);
    expect(provider.selectedConversationId, isNull);
    expect(provider.messages, isEmpty);
    expect(provider.isLoadingMessages, isFalse);
  });

  test('a message received during refresh survives an older HTTP snapshot', () async {
    final pending = api.enqueue('/api/chat/a/messages');
    final loading = provider.selectConversation(_conversation('a'));
    await pending.started.future;

    provider.addRealtimeMessage(MessageModel.fromJson(_message('live', 'a', second: 2)));
    pending.complete([_message('old', 'a')]);
    await loading;

    expect(_messageIds(provider), ['old', 'live']);
  });

  test('cached messages appear synchronously and survive a failed refresh', () async {
    final initial = api.enqueue('/api/chat/a/messages');
    final firstLoad = provider.selectConversation(_conversation('a'));
    await initial.started.future;
    initial.complete([_message('cached', 'a')]);
    await firstLoad;
    provider.clearSelectedConversation();

    final refresh = api.enqueue('/api/chat/a/messages');
    final refreshing = provider.selectConversation(_conversation('a'));
    expect(_messageIds(provider), ['cached']);
    expect(provider.isLoadingMessages, isFalse);
    await refresh.started.future;
    refresh.complete([], status: 503);
    await refreshing;

    expect(_messageIds(provider), ['cached']);
    expect(provider.isLoadingMessages, isFalse);
  });

  test('a receipt or reaction received during refresh is not rolled back', () async {
    final initial = api.enqueue('/api/chat/a/messages');
    final firstLoad = provider.selectConversation(_conversation('a'));
    await initial.started.future;
    initial.complete([_message('message-1', 'a')]);
    await firstLoad;

    final refresh = api.enqueue('/api/chat/a/messages');
    final refreshing = provider.selectConversation(_conversation('a'));
    await refresh.started.future;
    provider.addRealtimeMessage(provider.messages.single.copyWith(
      isRead: true,
      isDelivered: true,
      reactions: {'alice': 'like'},
    ));
    refresh.complete([_message('message-1', 'a')]);
    await refreshing;

    expect(provider.messages.single.isRead, isTrue);
    expect(provider.messages.single.isDelivered, isTrue);
    expect(provider.messages.single.reactions, {'alice': 'like'});
  });

  test('logout clears memory cache before another account opens the same chat', () async {
    final initial = api.enqueue('/api/chat/a/messages');
    final firstLoad = provider.selectConversation(_conversation('a'));
    await initial.started.future;
    initial.complete([_message('alice-private', 'a')]);
    await firstLoad;

    provider.clearCurrentUser();
    provider.currentUser = _user('bob');
    final bob = api.enqueue('/api/chat/a/messages');
    final bobLoad = provider.selectConversation(_conversation('a'));
    expect(provider.messages, isEmpty);
    expect(provider.isLoadingMessages, isTrue);
    await bob.started.future;
    bob.complete([_message('bob-private', 'a')]);
    await bobLoad;

    expect(_messageIds(provider), ['bob-private']);
  });

  test('conversation disk cache and late refreshes stay scoped to their account', () async {
    SharedPreferences.setMockInitialValues({
      'cached_conversations_alice': jsonEncode([{'id': 'alice-cached', 'name': 'Alice'}]),
      'cached_conversations_bob': jsonEncode([{'id': 'bob-cached', 'name': 'Bob'}]),
    });
    final alice = api.enqueue('/api/chat/conversations');
    final aliceLoad = provider.fetchConversations();
    await alice.started.future;
    expect(provider.conversations.single.id, 'alice-cached');

    provider.clearCurrentUser();
    provider.currentUser = _user('bob');
    final bob = api.enqueue('/api/chat/conversations');
    final bobLoad = provider.fetchConversations();
    await bob.started.future;
    expect(provider.conversations.single.id, 'bob-cached');

    bob.complete([{'id': 'bob-fresh', 'name': 'Bob'}]);
    await bobLoad;
    alice.complete([{'id': 'alice-late', 'name': 'Alice'}]);
    await aliceLoad;

    expect(provider.conversations.single.id, 'bob-fresh');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('cached_conversations_bob'), contains('bob-fresh'));
    expect(prefs.getString('cached_conversations_alice'), contains('alice-cached'));
  });

  test('disposing during a request prevents late listener notifications', () async {
    final pending = api.enqueue('/api/chat/a/messages');
    final loading = provider.selectConversation(_conversation('a'));
    await pending.started.future;
    provider.dispose();
    disposed = true;

    pending.complete([_message('late', 'a')]);
    await expectLater(loading, completes);
  });
}
