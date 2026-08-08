import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:universal_html/html.dart' as html;
import '../utils/web_helpers.dart';
import '../services/api_service.dart';
import 'my_qr_screen.dart';
import 'other_user_profile_screen.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({Key? key}) : super(key: key);

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  // Mobile scanner controller
  MobileScannerController? _mobileController;

  bool _isProcessing = false;
  late final String _containerId;
  static int _viewCounter = 0;

  StreamSubscription? _qrEventSub;
  final _manualInputController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _viewCounter++;
    _containerId = 'qr-container-$_viewCounter';

    if (kIsWeb) {
      _initWebScanner();
    } else {
      _initMobileScanner();
    }
  }

  void _initWebScanner() {
    registerWebQrView(_containerId);

    _qrEventSub = listenWebQrEvent((rawData) {
      if (_isProcessing) return;
      debugPrint('📸 [Dart] Received qr-scanned event with payload: $rawData');
      _handleQrCodeDetected(rawData);
    });

    Future.delayed(const Duration(milliseconds: 150), () {
      if (!mounted) return;
      startWebQrScanner(_containerId);
    });
  }

  void _initMobileScanner() {
    try {
      _mobileController?.dispose();
      _mobileController = MobileScannerController(
        detectionSpeed: DetectionSpeed.normal,
        autoStart: true,
      );
    } catch (e) {
      debugPrint('⚠️ Mobile scanner init error: $e');
    }
  }

  void _stopCamera() {
    if (kIsWeb) {
      stopWebQrScanner();
    } else {
      _mobileController?.stop();
    }
  }

  @override
  void dispose() {
    _qrEventSub?.cancel();
    _stopCamera();
    _mobileController?.dispose();
    _manualInputController.dispose();
    super.dispose();
  }

  void _onDetectMobile(BarcodeCapture capture) {
    if (_isProcessing) return;
    for (final barcode in capture.barcodes) {
      final rawValue = barcode.rawValue;
      if (rawValue != null && rawValue.isNotEmpty) {
        _handleQrCodeDetected(rawValue);
        break;
      }
    }
  }

  /// Tự động xử lý payload khi đọc được mã QR:
  /// Chuyển thẳng sang OtherUserProfileScreen (xử lý logic không cần BottomSheet)
  Future<void> _handleQrCodeDetected(String rawData) async {
    if (_isProcessing) return;
    setState(() => _isProcessing = true);
    _stopCamera();

    String input = rawData.trim();
    if (input.startsWith('chathofi://user/')) {
      input = input.replaceFirst('chathofi://user/', '').trim();
    }

    if (input.isEmpty) {
      _showErrorAndReset('Mã QR không chứa thông tin hợp lệ.');
      return;
    }

    // Tra cứu user ID trực tiếp nếu dạng GUID/UUID hoặc tìm kiếm qua keyword
    String targetUserId = input;
    final userLookup = await ApiService.lookupUserById(input);
    if (userLookup != null && userLookup['id'] != null) {
      targetUserId = userLookup['id'].toString();
    } else {
      final searchResults = await ApiService.searchUsers(input);
      if (searchResults.isNotEmpty && searchResults.first['id'] != null) {
        targetUserId = searchResults.first['id'].toString();
      }
    }

    if (!mounted) return;

    // Đóng màn hình scanner và điều hướng trực tiếp sang OtherUserProfileScreen
    Navigator.pop(context);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OtherUserProfileScreen(userId: targetUserId),
      ),
    );
  }

  void _showErrorAndReset(String msg) {
    if (!mounted) return;
    setState(() => _isProcessing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: const Color(0xFFEF4444)),
    );

    // Bật lại camera để người dùng quét lại
    if (kIsWeb) {
      startWebQrScanner(_containerId);
    } else {
      _mobileController?.start();
    }
  }

  void _pickImageFromGallery() {
    if (kIsWeb) {
      final uploadInput = html.FileUploadInputElement()..accept = 'image/*';
      uploadInput.click();
      uploadInput.onChange.listen((e) {
        final files = uploadInput.files;
        if (files != null && files.isNotEmpty) {
          final reader = html.FileReader();
          reader.readAsDataUrl(files[0]);
          reader.onLoadEnd.listen((e) {
            final dataUrl = reader.result as String?;
            if (dataUrl != null) {
              scanWebQrImage(dataUrl);
            }
          });
        }
      });
    } else {
      _showManualInputDialog();
    }
  }

  void _showManualInputDialog() {
    _manualInputController.clear();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(children: [
          Icon(Icons.person_search_rounded, color: Color(0xFF0068FF)),
          SizedBox(width: 10),
          Text('Tìm bạn bè', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        ]),
        content: TextField(
          controller: _manualInputController,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Nhập Username, SĐT hoặc User ID',
            hintStyle: const TextStyle(fontSize: 13),
            prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF0068FF)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
          onSubmitted: (val) {
            Navigator.pop(ctx);
            if (val.trim().isNotEmpty) {
              _handleQrCodeDetected(val.trim());
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0068FF),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () {
              final input = _manualInputController.text.trim();
              Navigator.pop(ctx);
              if (input.isNotEmpty) {
                _handleQrCodeDetected(input);
              }
            },
            child: const Text('Tra cứu', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        _stopCamera();
        return true;
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        extendBodyBehindAppBar: true,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
            ),
            onPressed: () {
              _stopCamera();
              Navigator.pop(context);
            },
          ),
          title: const Text('Quét mã QR', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
          centerTitle: true,
          actions: [
            IconButton(
              icon: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: Colors.black38, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.qr_code_rounded, color: Colors.white, size: 20),
              ),
              onPressed: () {
                _stopCamera();
                Navigator.push(context, MaterialPageRoute(builder: (_) => const MyQrScreen()));
              },
              tooltip: 'Mã QR của tôi',
            ),
          ],
        ),
        body: Stack(
          children: [
            // 1. Fullscreen Live Camera View
            Positioned.fill(
              child: kIsWeb
                  ? HtmlElementView(viewType: _containerId)
                  : (_mobileController != null
                      ? MobileScanner(
                          controller: _mobileController!,
                          onDetect: _onDetectMobile,
                          errorBuilder: (ctx, err, child) => Container(color: Colors.black),
                        )
                      : Container(color: Colors.black)),
            ),

            // 2. Square scanning target frame
            Center(
              child: Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFF0068FF), width: 3),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0068FF).withOpacity(0.2),
                      blurRadius: 24,
                      spreadRadius: 6,
                    ),
                  ],
                ),
              ),
            ),

            // 3. Processing loader
            if (_isProcessing)
              Positioned.fill(
                child: Container(
                  color: Colors.black54,
                  child: const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: Color(0xFF0068FF)),
                        SizedBox(height: 16),
                        Text('Đang mở trang cá nhân...', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ),

            // 4. Bottom compact action bar (Chọn ảnh QR & Nhập ID)
            if (!_isProcessing)
              Positioned(
                bottom: 40,
                left: 0,
                right: 0,
                child: Column(
                  children: [
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 50),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                      child: const Text(
                        'Đưa mã QR vào khung hình để tự động quét',
                        style: TextStyle(color: Colors.white70, fontSize: 12.5),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildBottomIcon(Icons.photo_library_rounded, 'Chọn ảnh QR', _pickImageFromGallery),
                        const SizedBox(width: 32),
                        _buildBottomIcon(Icons.person_search_rounded, 'Nhập ID', _showManualInputDialog),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomIcon(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(height: 6),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
