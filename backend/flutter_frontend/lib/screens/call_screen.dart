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
  dynamic _signalHandler;
  dynamic _endHandler;
  final List<Map<String, dynamic>> _iceCandidateQueue = [];
  Timer? _durationTimer;
  int _callDurationSeconds = 0;
  bool _isCallConnected = false;
  String _cameraFacingMode = "user";
  bool _isSwitchingCamera = false;

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

  Future<void> _processIceQueue(html.RtcPeerConnection pc) async {
    final queued = List<Map<String, dynamic>>.of(_iceCandidateQueue);
    _iceCandidateQueue.clear();
    for (var candidateMap in queued) {
      try {
        await pc.addIceCandidate(html.RtcIceCandidate(candidateMap));
      } catch (e) {
        debugPrint('⚠️ [CallScreen] Error adding queued ICE candidate: $e');
      }
    }
  }

  Future<void> _setupCall() async {
    // Lắng nghe tín hiệu kết thúc từ socket
    _endHandler = (_) {
      if (mounted) {
        _hangUp(notifyPeer: false);
      }
    };
    SocketService.socket?.on('call_ended', _endHandler);

    // Lắng nghe tín hiệu WebRTC (offer, answer, candidate)
    _signalHandler = (data) async {
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
          await _processIceQueue(pc);
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
          await _processIceQueue(pc);
          if (mounted) {
            setState(() {
              _isCallConnected = true;
            });
            _startDurationTimer();
          }
        } else if (type == 'candidate') {
          final candidateStr = signal['candidate']?.toString();
          if (candidateStr != null && candidateStr.isNotEmpty) {
            int? mLineIndex;
            if (signal['sdpMLineIndex'] != null) {
              if (signal['sdpMLineIndex'] is int) {
                mLineIndex = signal['sdpMLineIndex'] as int;
              } else {
                mLineIndex = int.tryParse(signal['sdpMLineIndex'].toString());
              }
            }
            final candidateMap = <String, dynamic>{
              'candidate': candidateStr,
              if (signal['sdpMid'] != null) 'sdpMid': signal['sdpMid'].toString(),
              if (mLineIndex != null) 'sdpMLineIndex': mLineIndex,
            };
            if (pc.remoteDescription != null) {
              await pc.addIceCandidate(html.RtcIceCandidate(candidateMap));
            } else {
              _iceCandidateQueue.add(candidateMap);
            }
          }
        }
      } catch (e) {
        debugPrint('⚠️ [CallScreen] Signal handling error: $e');
      }
    };
    SocketService.socket?.on('webrtc_signal', _signalHandler);

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


  Future<void> _switchCamera() async {
    if (!widget.isVideo || _isSwitchingCamera) return;
    final pc = _webrtcService.peerConnection;
    final localStream = _webrtcService.localStream;
    if (pc == null || localStream == null) return;

    _isSwitchingCamera = true;
    final targetMode = _cameraFacingMode == 'user' ? 'environment' : 'user';

    try {
      final devices = html.window.navigator.mediaDevices;
      if (devices == null) return;
      final newStream = await devices.getUserMedia({
        'audio': false,
        'video': {'facingMode': {'ideal': targetMode}},
      });

      final newVideoTracks = newStream.getVideoTracks();
      if (newVideoTracks.isNotEmpty) {
        final newTrack = newVideoTracks.first;
        final dynamic pcDynamic = pc;
        if (pcDynamic.getSenders != null) {
          final senders = pcDynamic.getSenders() as List;
          for (final sender in senders) {
            final dynamic s = sender;
            if (s.track != null && s.track.kind == 'video') {
              await s.replaceTrack(newTrack);
              break;
            }
          }
        }
        for (final oldTrack in List.from(localStream.getVideoTracks())) {
          localStream.removeTrack(oldTrack);
          (oldTrack as dynamic).stop();
        }
        newTrack.enabled = _isVideoEnabled;
        localStream.addTrack(newTrack);
        _cameraFacingMode = targetMode;
        if (mounted) setState(() {});
      }
    } catch (e) {
      debugPrint('⚠️ [CallScreen] switchCamera error: ' + e.toString());
    } finally {
      _isSwitchingCamera = false;
    }
  }

  void _hangUp({bool notifyPeer = true}) {
    if (notifyPeer) {
      SocketService.socket?.emit('end_call', {
        'targetUserId': widget.targetUserId,
      });
    }

    _durationTimer?.cancel();
    if (_signalHandler != null) {
      SocketService.socket?.off('webrtc_signal', _signalHandler);
      _signalHandler = null;
    }
    if (_endHandler != null) {
      SocketService.socket?.off('call_ended', _endHandler);
      _endHandler = null;
    }
    _webrtcService.dispose();

    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    _durationTimer?.cancel();
    if (_signalHandler != null) {
      SocketService.socket?.off('webrtc_signal', _signalHandler);
      _signalHandler = null;
    }
    if (_endHandler != null) {
      SocketService.socket?.off('call_ended', _endHandler);
      _endHandler = null;
    }
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
            if (widget.isVideo)
              Positioned(
                top: 16,
                right: 16,
                child: FloatingActionButton.small(
                  heroTag: 'switch_cam_btn',
                  backgroundColor: Colors.white24,
                  onPressed: _isSwitchingCamera ? null : _switchCamera,
                  child: _isSwitchingCamera
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.flip_camera_ios_rounded, color: Colors.white, size: 20),
                ),
              ),
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
