import 'dart:async';
import 'dart:html' as html;
import 'package:flutter/foundation.dart';

/// WebRTC Service quản lý kết nối Peer-to-Peer và âm thanh 2 chiều trên Flutter Web
class WebRtcService {
  static final WebRtcService _instance = WebRtcService._internal();
  factory WebRtcService() => _instance;
  WebRtcService._internal();

  html.RtcPeerConnection? peerConnection;
  html.MediaStream? localStream;
  html.MediaStream? remoteStream;

  // Cấu hình STUN & TURN Relay dự phòng (OpenRelay / Metered TURN) để xuyên thủng NAT/4G
  static final Map<String, dynamic> rtcConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
      {'urls': 'stun:stun2.l.google.com:19302'},
      {'urls': 'stun:stun.cloudflare.com:3478'},
      // TURN Relay fallback cho kết nối 4G và Symmetric NAT
      {
        'urls': [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        'username': 'openrelayproject',
        'credential': 'openrelayproject',
      },
    ],
    'iceCandidatePoolSize': 10,
  };

  /// 1. Mở khóa Audio Pipeline ngay trong User Interaction (Bắt máy hoặc Gọi)
  void unlockAudio() {
    if (!kIsWeb) return;
    try {
      final jsWin = html.window as dynamic;
      if (jsWin.unlockAudio != null) {
        jsWin.unlockAudio();
        debugPrint('🔓 [WebRtcService] window.unlockAudio() called on user interaction');
      }
    } catch (e) {
      debugPrint('⚠️ [WebRtcService] unlockAudio error: $e');
    }
  }

  /// 2. Gán remote stream xuống JS Helper để phát loa ngoài với volume 1.0
  void attachRemoteStream(html.MediaStream stream) {
    if (!kIsWeb) return;
    try {
      final jsWin = html.window as dynamic;
      if (jsWin.attachRemoteStream != null) {
        jsWin.attachRemoteStream(stream);
        debugPrint('🔊 [WebRtcService] window.attachRemoteStream(stream) invoked');
      }
    } catch (e) {
      debugPrint('⚠️ [WebRtcService] attachRemoteStream error: $e');
    }
  }

  /// 3. Dừng âm thanh cuộc gọi
  void stopCallAudio() {
    if (!kIsWeb) return;
    try {
      final jsWin = html.window as dynamic;
      if (jsWin.stopCallAudio != null) {
        jsWin.stopCallAudio();
        debugPrint('🛑 [WebRtcService] window.stopCallAudio() invoked');
      }
    } catch (e) {
      debugPrint('⚠️ [WebRtcService] stopCallAudio error: $e');
    }
  }

  /// 4. Khởi tạo PeerConnection với đầy đủ Audio Constraints & Transceiver
  Future<html.RtcPeerConnection?> initPeerConnection({
    required bool isVideoCall,
    required Function(Map<String, dynamic>) onIceCandidate,
    Function(html.MediaStream)? onRemoteStreamReady,
  }) async {
    if (!kIsWeb) return null;

    try {
      peerConnection = await html.RtcPeerConnection(rtcConfig);

      // Lấy mic & camera với ràng buộc âm thanh tối ưu
      final mediaConstraints = {
        'audio': {
          'echoCancellation': true,
          'noiseSuppression': true,
          'autoGainControl': true,
        },
        'video': isVideoCall ? {'facingMode': 'user'} : false,
      };

      try {
        localStream = await html.window.navigator.mediaDevices?.getUserMedia(mediaConstraints);
      } catch (e) {
        debugPrint('⚠️ [WebRtcService] Detailed getUserMedia constraints failed, fallback to basic: $e');
        localStream = await html.window.navigator.mediaDevices?.getUserMedia({
          'audio': true,
          'video': isVideoCall,
        });
      }

      // Add toàn bộ track của local stream vào peer connection
      if (localStream != null && peerConnection != null) {
        for (var track in localStream!.getTracks()) {
          track.enabled = true;
          try {
            peerConnection!.addTrack(track, localStream!);
          } catch (err) {
            debugPrint('⚠️ [WebRtcService] addTrack error: $err');
          }
        }

        // Đảm bảo transceiver âm thanh được thiết lập với direction 'sendrecv'
        try {
          final audioTracks = localStream!.getAudioTracks();
          if (audioTracks.isNotEmpty) {
            final dynamic pcDynamic = peerConnection;
            if (pcDynamic.addTransceiver != null) {
              pcDynamic.addTransceiver(audioTracks.first, {'direction': 'sendrecv'});
              debugPrint('✅ [WebRtcService] Audio transceiver set to sendrecv');
            }
          }
        } catch (e) {
          debugPrint('ℹ️ [WebRtcService] addTransceiver fallback: $e');
        }
      }

      // Lắng nghe track từ xa
      peerConnection!.onTrack.listen((event) {
        debugPrint('🔊 [WebRtcService] onTrack event fired! Track kind: ${event.track?.kind}');
        html.MediaStream? stream;
        if (event.streams != null && event.streams!.isNotEmpty) {
          stream = event.streams![0];
        } else if (event.track != null) {
          stream = html.MediaStream([event.track!]);
        }
        if (stream != null) {
          remoteStream = stream;
          attachRemoteStream(stream);
          onRemoteStreamReady?.call(stream);
        }
      });

      // Lắng nghe stream từ xa (hỗ trợ trình duyệt cũ)
      peerConnection!.onAddStream.listen((event) {
        if (event.stream != null) {
          debugPrint('🔊 [WebRtcService] onAddStream fired! Stream id: ${event.stream!.id}');
          remoteStream = event.stream;
          attachRemoteStream(event.stream!);
          onRemoteStreamReady?.call(event.stream!);
        }
      });

      // Lắng nghe ICE Candidate và gửi qua socket
      peerConnection!.onIceCandidate.listen((event) {
        if (event.candidate != null && event.candidate!.candidate != null) {
          onIceCandidate({
            'candidate': event.candidate!.candidate,
            'sdpMid': event.candidate!.sdpMid,
            'sdpMLineIndex': event.candidate!.sdpMLineIndex,
          });
        }
      });

      // Giám sát trạng thái ICE Connection
      peerConnection!.onIceConnectionStateChange.listen((_) {
        final state = peerConnection?.iceConnectionState ?? '';
        debugPrint('⚡ [WebRtcService] ICE Connection State: $state');
        if (state == 'failed') {
          debugPrint('⚠️ [WebRtcService] ICE failed -> Triggering restartIce()...');
          restartIce();
        }
      });

      return peerConnection;
    } catch (e) {
      debugPrint('❌ [WebRtcService] initPeerConnection error: $e');
      return null;
    }
  }

  /// Khởi động lại ICE khi gặp lỗi kết nối mạng
  void restartIce() {
    try {
      final dynamic pc = peerConnection;
      if (pc != null && pc.restartIce != null) {
        pc.restartIce();
        debugPrint('🔄 [WebRtcService] restartIce() called on peerConnection');
      }
    } catch (e) {
      debugPrint('⚠️ [WebRtcService] restartIce error: $e');
    }
  }

  /// Dọn dẹp hoàn toàn cuộc gọi
  void dispose() {
    stopCallAudio();

    if (localStream != null) {
      for (var track in localStream!.getTracks()) {
        try {
          (track as dynamic).stop();
        } catch (_) {}
      }
      localStream = null;
    }

    remoteStream = null;

    try {
      peerConnection?.close();
    } catch (_) {}
    peerConnection = null;
    debugPrint('🛑 [WebRtcService] WebRTC resources successfully disposed');
  }
}
