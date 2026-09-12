const fs = require('fs');
const path = require('path');

const chatScreenPath = path.join(__dirname, '..', 'flutter_frontend', 'lib', 'screens', 'chat_screen.dart');
let content = fs.readFileSync(chatScreenPath, 'utf8');

const isCRLF = content.includes('\r\n');
let norm = content.replace(/\r\n/g, '\n');

// 1. Thêm lắng nghe onCallEnded trong _handleIncomingCall (đang đổ chuông cuộc gọi đến)
const targetHandleIncoming = `    Timer? autoRejectTimer;

    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'IncomingCall',
      pageBuilder: (dialogContext, anim1, anim2) {
        autoRejectTimer = Timer(const Duration(seconds: 30), () {`;

const newHandleIncoming = `    Timer? autoRejectTimer;
    StreamSubscription? incomingEndSub;

    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'IncomingCall',
      pageBuilder: (dialogContext, anim1, anim2) {
        // Tự động tắt màn hình đổ chuông khi người gọi ngắt máy trước khi nghe
        incomingEndSub?.cancel();
        incomingEndSub = SocketService.onCallEnded.listen((_) {
          print('🔴 Người gọi đã tắt máy -> Đóng màn hình cuộc gọi đến!');
          autoRejectTimer?.cancel();
          incomingEndSub?.cancel();
          _isIncomingCallShowing = false;
          try {
            Navigator.of(dialogContext, rootNavigator: true).pop();
          } catch (_) {
            try {
              Navigator.of(context, rootNavigator: true).pop();
            } catch (_) {}
          }
        });

        autoRejectTimer = Timer(const Duration(seconds: 30), () {
          incomingEndSub?.cancel();`;

if (norm.includes(targetHandleIncoming)) {
  norm = norm.replace(targetHandleIncoming, newHandleIncoming);
  console.log('✅ 1. Đã thêm listener onCallEnded vào màn hình cuộc gọi đến (_handleIncomingCall)');
} else {
  console.log('ℹ️ 1. Màn hình cuộc gọi đến đã có listener onCallEnded hoặc không tìm thấy khớp');
}

// Hủy incomingEndSub khi bấm Từ chối hoặc Trả lời
const targetRejectClean = `onPressed: () {
                                    _isIncomingCallShowing = false;
                                    autoRejectTimer?.cancel();
                                    SocketService.socket?.emit('reject_call', {`;

const newRejectClean = `onPressed: () {
                                    _isIncomingCallShowing = false;
                                    autoRejectTimer?.cancel();
                                    incomingEndSub?.cancel();
                                    SocketService.socket?.emit('reject_call', {`;

if (norm.includes(targetRejectClean)) {
  norm = norm.replace(targetRejectClean, newRejectClean);
  console.log('✅ 2. Đã hủy incomingEndSub khi bấm Từ chối');
}

const targetAcceptClean = `onPressed: () {
                                    _isIncomingCallShowing = false;
                                    autoRejectTimer?.cancel();
                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;`;

const newAcceptClean = `onPressed: () {
                                    _isIncomingCallShowing = false;
                                    autoRejectTimer?.cancel();
                                    incomingEndSub?.cancel();
                                    final audioPlayer = html.document.getElementById('remoteAudioPlayer') as html.AudioElement?;`;

if (norm.includes(targetAcceptClean)) {
  norm = norm.replace(targetAcceptClean, newAcceptClean);
  console.log('✅ 3. Đã hủy incomingEndSub khi bấm Trả lời');
}

// 4. Cải tiến cleanupCall trong _showCallDialog (xóa sạch phần tử Video khỏi DOM)
const targetCleanupCall = `        final localVideo = html.document.getElementById('localVideoPlayer') as html.VideoElement?;
        final remoteVideo = html.document.getElementById('remoteVideoPlayer') as html.VideoElement?;
        if (localVideo != null) {
          localVideo.pause();
          localVideo.srcObject = null;
          localVideo.style.display = 'none';
        }
        if (remoteVideo != null) {
          remoteVideo.pause();
          remoteVideo.srcObject = null;
          remoteVideo.style.display = 'none';
        }`;

const newCleanupCall = `        final localVideo = html.document.getElementById('localVideoPlayer') as html.VideoElement?;
        final remoteVideo = html.document.getElementById('remoteVideoPlayer') as html.VideoElement?;
        if (localVideo != null) {
          localVideo.pause();
          localVideo.srcObject = null;
          localVideo.style.display = 'none';
          try { localVideo.remove(); } catch (_) {}
        }
        if (remoteVideo != null) {
          remoteVideo.pause();
          remoteVideo.srcObject = null;
          remoteVideo.style.display = 'none';
          try { remoteVideo.remove(); } catch (_) {}
        }`;

if (norm.includes(targetCleanupCall)) {
  norm = norm.replace(targetCleanupCall, newCleanupCall);
  console.log('✅ 4. Đã cập nhật cleanupCall xóa triệt để video player khỏi DOM');
}

// 5. Cải tiến endSub đóng cuộc gọi an toàn qua rootNavigator
const targetEndSub = `            endSub ??= SocketService.onCallEnded.listen((_) {
              print('🔴 Đối phương đã tắt máy -> Tự động đóng màn hình gọi!');
              cleanupCall();
              if (Navigator.of(dialogContext).canPop()) {
                Navigator.of(dialogContext).pop();
              }
            });`;

const newEndSub = `            endSub ??= SocketService.onCallEnded.listen((_) {
              print('🔴 Đối phương đã tắt máy -> Tự động đóng màn hình gọi!');
              cleanupCall();
              try {
                Navigator.of(dialogContext, rootNavigator: true).pop();
              } catch (_) {
                try {
                  Navigator.of(context, rootNavigator: true).pop();
                } catch (_) {}
              }
            });`;

if (norm.includes(targetEndSub)) {
  norm = norm.replace(targetEndSub, newEndSub);
  console.log('✅ 5. Đã nâng cấp endSub đóng cuộc gọi an toàn');
}

// 6. Cải tiến nút bấm đỏ kết thúc cuộc gọi
const targetEndBtn = `SocketService.socket?.emit('end_call', {'connectedUserId': targetUserId});
                                       cleanupCall();
                                       if (Navigator.of(dialogContext).canPop()) {
                                         Navigator.of(dialogContext).pop();
                                       }`;

const newEndBtn = `SocketService.socket?.emit('end_call', {
                                         'connectedUserId': targetUserId,
                                         'conversationId': conv.id,
                                       });
                                       cleanupCall();
                                       try {
                                         Navigator.of(dialogContext, rootNavigator: true).pop();
                                       } catch (_) {
                                         try {
                                           Navigator.of(context, rootNavigator: true).pop();
                                         } catch (_) {}
                                       }`;

if (norm.includes(targetEndBtn)) {
  norm = norm.replace(targetEndBtn, newEndBtn);
  console.log('✅ 6. Đã nâng cấp nút bấm kết thúc cuộc gọi gửi kèm conversationId');
}

// 7. Cải tiến ICE state listener tự động đóng cuộc gọi nếu đứt kết nối
const targetIceChange = `                pc?.onIceConnectionStateChange.listen((_) {
                  print('⚡ WebRTC ICE Connection State: \${pc?.iceConnectionState}');
                });`;

const newIceChange = `                pc?.onIceConnectionStateChange.listen((_) {
                  print('⚡ WebRTC ICE Connection State: \${pc?.iceConnectionState}');
                  final iceState = pc?.iceConnectionState;
                  if (iceState == 'disconnected' || iceState == 'closed') {
                    Future.delayed(const Duration(milliseconds: 1500), () {
                      if (pc?.iceConnectionState == 'disconnected' || pc?.iceConnectionState == 'closed') {
                        print('🔴 Mất kết nối ICE -> Tự động đóng phòng gọi');
                        cleanupCall();
                        try {
                          Navigator.of(dialogContext, rootNavigator: true).pop();
                        } catch (_) {
                          try {
                            Navigator.of(context, rootNavigator: true).pop();
                          } catch (_) {}
                        }
                      }
                    });
                  }
                });`;

if (norm.includes(targetIceChange)) {
  norm = norm.replace(targetIceChange, newIceChange);
  console.log('✅ 7. Đã thêm tự động đóng phòng gọi khi mất kết nối ICE');
}

const result = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
fs.writeFileSync(chatScreenPath, result, 'utf8');
console.log('🎉 Hoàn tất vá logic tắt máy đồng bộ!');
