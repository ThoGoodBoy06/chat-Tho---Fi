const fs = require('fs');
const path = require('path');

const chatScreenPath = path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart');
let content = fs.readFileSync(chatScreenPath, 'utf8');

const isCRLF = content.includes('\r\n');
let norm = content.replace(/\r\n/g, '\n');

// 1. Thêm biến cờ trạng thái _isIncomingCallShowing và _isStartingCall
const targetDecl = `  StreamSubscription? _incomingCallSub;\n  StreamSubscription? _visibilitySub;`;
const newDecl = `  StreamSubscription? _incomingCallSub;\n  StreamSubscription? _visibilitySub;\n  bool _isIncomingCallShowing = false;\n  bool _isStartingCall = false;`;

if (norm.includes(targetDecl) && !norm.includes('_isIncomingCallShowing')) {
  norm = norm.replace(targetDecl, newDecl);
  console.log('✅ 1. Đã khai báo _isIncomingCallShowing và _isStartingCall');
} else {
  console.log('ℹ️ 1. Biến cờ cuộc gọi đã tồn tại hoặc đã cập nhật');
}

// 2. Chặn nhiều dialog cuộc gọi đến đè lên nhau trong _handleIncomingCall
const targetIncoming = `  void _handleIncomingCall(Map<String, dynamic> data) {\n    final callerId = data['callerId']?.toString();\n    final callerName = data['callerName']?.toString() ?? 'Người dùng';\n    final callType = data['callType']?.toString() ?? 'audio';\n    final isVideo = callType == 'video';\n\n    if (callerId == null || callerId.isEmpty) return;`;

const newIncoming = `  void _handleIncomingCall(Map<String, dynamic> data) {\n    if (_isIncomingCallShowing) return;\n    _isIncomingCallShowing = true;\n\n    final callerId = data['callerId']?.toString();\n    final callerName = data['callerName']?.toString() ?? 'Người dùng';\n    final callType = data['callType']?.toString() ?? 'audio';\n    final isVideo = callType == 'video';\n\n    if (callerId == null || callerId.isEmpty) {\n      _isIncomingCallShowing = false;\n      return;\n    }`;

if (norm.includes(targetIncoming)) {
  norm = norm.replace(targetIncoming, newIncoming);
  console.log('✅ 2. Đã thêm cờ chặn chồng dialog trong _handleIncomingCall');
} else {
  console.log('ℹ️ 2. _handleIncomingCall đã được bảo vệ trước đó');
}

// Reset cờ khi dialog đóng
const targetCloseDialog = `        autoRejectTimer = Timer(const Duration(seconds: 30), () {\n          SocketService.socket?.emit('reject_call', {\n            'callerId': callerId,\n            'callType': callType,\n          });`;

const newCloseDialog = `        autoRejectTimer = Timer(const Duration(seconds: 30), () {\n          _isIncomingCallShowing = false;\n          SocketService.socket?.emit('reject_call', {\n            'callerId': callerId,\n            'callType': callType,\n          });`;

if (norm.includes(targetCloseDialog)) {
  norm = norm.replace(targetCloseDialog, newCloseDialog);
  console.log('✅ 3. Đã reset cờ khi autoRejectTimer kích hoạt');
}

const targetRejectBtn = `onPressed: () {\n                                    autoRejectTimer?.cancel();\n                                    SocketService.socket?.emit('reject_call', {`;

const newRejectBtn = `onPressed: () {\n                                    _isIncomingCallShowing = false;\n                                    autoRejectTimer?.cancel();\n                                    SocketService.socket?.emit('reject_call', {`;

if (norm.includes(targetRejectBtn)) {
  norm = norm.replace(targetRejectBtn, newRejectBtn);
  console.log('✅ 4. Đã reset cờ khi bấm Từ chối');
}

const targetAcceptBtn = `onPressed: () {\n                                    autoRejectTimer?.cancel();\n                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;`;

const newAcceptBtn = `onPressed: () {\n                                    _isIncomingCallShowing = false;\n                                    autoRejectTimer?.cancel();\n                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;`;

if (norm.includes(targetAcceptBtn)) {
  norm = norm.replace(targetAcceptBtn, newAcceptBtn);
  console.log('✅ 5. Đã reset cờ khi bấm Trả lời');
}

// 6. Debounce 3s trong _startCall
const targetStartCall = `  void _startCall(BuildContext context, ChatProvider provider, {required bool isVideo}) {\n    final conv = provider.selectedConversation;\n    if (conv == null) return;`;

const newStartCall = `  void _startCall(BuildContext context, ChatProvider provider, {required bool isVideo}) {\n    if (_isStartingCall) return;\n    _isStartingCall = true;\n    Future.delayed(const Duration(seconds: 3), () {\n      _isStartingCall = false;\n    });\n\n    final conv = provider.selectedConversation;\n    if (conv == null) return;`;

if (norm.includes(targetStartCall)) {
  norm = norm.replace(targetStartCall, newStartCall);
  console.log('✅ 6. Đã thêm debounce 3s chống bấm liên hoàn cho _startCall');
}

const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
fs.writeFileSync(chatScreenPath, result, 'utf8');
console.log('🎉 Hoàn tất vá lỗi spam cuộc gọi trong chat_screen.dart!');
