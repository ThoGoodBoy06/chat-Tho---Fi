import 'dart:async';
import 'dart:html' as html;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../services/webrtc_service.dart';
import '../services/socket_service.dart';

class CallScreen extends StatefulWidget {
  final String targetUserId;
  final String targetUserName;
  final String? targetAvatarUrl;
  final bool isCaller;
  final bool isVideo;

  const CallScreen({
    Key? key,
    required this.targetUserId,
    required this.targetUserName,
    this.targetAvatarUrl,
    required this.isCaller,
    this.isVideo = false,
  }) : super(key: key);

  @override
  State<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends State<CallScreen> {
  final WebRtcService _webrtcService = WebRtcService();
  bool _isMuted = false;
  bool _isVideoEnabled = true;
  String _callStatus = 'Đang kết nối...';
  StreamSubscription? _signalSub;
  StreamSubscription? _endSub;
  Timer? _durationTimer;
  int _callDurationSeconds = 0;
  bool _isCallConnected = false;

  @override
  void initState() {
    super.initState();
    // 1. Mở khóa Audio Pipeline ngay lập tức khi vào màn hình cuộc gọi
    _webrtcService.unlockAudio();

    _setupCall();
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _callDurationSeconds++;
          final minutes = (_callDurationSeconds ~/ 60).toString().padLeft(2, '0');
          final seconds = (_callDurationSeconds % 60).toString().padLeft(2, '0');
          _callStatus = '$minutes:$seconds';
        });
      }
    });
  }

  Future<void> _setupCall() async {
    // Lắng nghe tín hiệu kết thúc từ socket
    _endSub = SocketService.socket?.on('call_ended', (_) {
      if (mounted) {
        _hangUp(notifyPeer: false);
      }
    }) as StreamSubscription?;

    // Lắng nghe tín hiệu WebRTC (offer, answer, candidate)
    _signalSub = SocketService.socket?.on('webrtc_signal', (data) async {
      if (data == null || data is! Map) return;
      final signal = data['signal'];
      if (signal == null || signal is! Map) return;
      final pc = _webrtcService.peerConnection;
      if (pc == null) return;

      try {
        final type = signal['type']?.toString();
        if (type == 'offer') {
          await pc.setRemoteDescription({
            'type': 'offer',
            'sdp': signal['sdp'],
          });
          final answer = await pc.createAnswer({
            'offerToReceiveAudio': true,
            'offerToReceiveVideo': widget.isVideo,
          });
          await pc.setLocalDescription({
            'type': answer.type,
            'sdp': answer.sdp,
          });
          SocketService.socket?.emit('webrtc_signal', {
            'connectedUserId': widget.targetUserId,
            'signal': {
              'type': 'answer',
              'sdp': answer.sdp,
            }
          });
        } else if (type == 'answer') {
          await pc.setRemoteDescription({
            'type': 'answer',
            'sdp': signal['sdp'],
          });
          if (mounted) {
            setState(() {
              _isCallConnected = true;
            });
            _startDurationTimer();
          }
        } else if (type == 'candidate') {
          final candidateStr = signal['candidate']?.toString();
          if (candidateStr != null && candidateStr.isNotEmpty) {
            await pc.addIceCandidate(html.RtcIceCandidate({
              'candidate': candidateStr,
              'sdpMid': signal['sdpMid']?.toString(),
              'sdpMLineIndex': signal['sdpMLineIndex'],
            }));
          }
        }
      } catch (e) {
        debugPrint('⚠️ [CallScreen] Signal handling error: $e');
      }
    }) as StreamSubscription?;

    // Khởi tạo PeerConnection
    final pc = await _webrtcService.initPeerConnection(
      isVideoCall: widget.isVideo,
      onIceCandidate: (candidateData) {
        SocketService.socket?.emit('webrtc_signal', {
          'connectedUserId': widget.targetUserId,
          'signal': {
            'type': 'candidate',
            'candidate': candidateData['candidate'],
            'sdpMid': candidateData['sdpMid'],
            'sdpMLineIndex': candidateData['sdpMLineIndex'],
          }
        });
      },
      onRemoteStreamReady: (stream) {
        if (mounted) {
          setState(() {
            _isCallConnected = true;
          });
          _startDurationTimer();
        }
      },
    );

    if (pc != null && widget.isCaller) {
      final offer = await pc.createOffer({
        'offerToReceiveAudio': true,
        'offerToReceiveVideo': widget.isVideo,
      });
      await pc.setLocalDescription({
        'type': offer.type,
        'sdp': offer.sdp,
      });
      SocketService.socket?.emit('webrtc_signal', {
        'connectedUserId': widget.targetUserId,
        'signal': {
          'type': 'offer',
          'sdp': offer.sdp,
        }
      });
    }
  }

  void _toggleMute() {
    setState(() {
      _isMuted = !_isMuted;
      final localStream = _webrtcService.localStream;
      if (localStream != null) {
        for (var track in localStream.getAudioTracks()) {
          track.enabled = !_isMuted;
        }
      }
    });
  }

  void _toggleVideo() {
    if (!widget.isVideo) return;
    setState(() {
      _isVideoEnabled = !_isVideoEnabled;
      final localStream = _webrtcService.localStream;
      if (localStream != null) {
        for (var track in localStream.getVideoTracks()) {
          track.enabled = _isVideoEnabled;
        }
      }
    });
  }

  void _hangUp({bool notifyPeer = true}) {
    if (notifyPeer) {
      SocketService.socket?.emit('end_call', {
        'targetUserId': widget.targetUserId,
      });
    }

    _durationTimer?.cancel();
    _signalSub?.cancel();
    _endSub?.cancel();
    _webrtcService.dispose();

    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    _signalSub?.cancel();
    _endSub?.cancel();
    _webrtcService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B111E),
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 54,
                    backgroundColor: Colors.blueAccent.withOpacity(0.2),
                    backgroundImage: widget.targetAvatarUrl != null
                        ? NetworkImage(widget.targetAvatarUrl!)
                        : null,
                    child: widget.targetAvatarUrl == null
                        ? const Icon(Icons.person, size: 54, color: Colors.white)
                        : null,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    widget.targetUserName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _callStatus,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              bottom: 40,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  FloatingActionButton(
                    heroTag: 'mute_btn',
                    backgroundColor: _isMuted ? Colors.white : Colors.white24,
                    onPressed: _toggleMute,
                    child: Icon(
                      _isMuted ? Icons.mic_off : Icons.mic,
                      color: _isMuted ? Colors.black : Colors.white,
                    ),
                  ),
                  FloatingActionButton(
                    heroTag: 'hangup_btn',
                    backgroundColor: Colors.redAccent,
                    onPressed: () => _hangUp(notifyPeer: true),
                    child: const Icon(Icons.call_end, color: Colors.white),
                  ),
                  if (widget.isVideo)
                    FloatingActionButton(
                      heroTag: 'video_btn',
                      backgroundColor: _isVideoEnabled ? Colors.white24 : Colors.white,
                      onPressed: _toggleVideo,
                      child: Icon(
                        _isVideoEnabled ? Icons.videocam : Icons.videocam_off,
                        color: _isVideoEnabled ? Colors.white : Colors.black,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
