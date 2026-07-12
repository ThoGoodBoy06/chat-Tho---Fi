import Flutter
import UIKit
import WebKit

// Extension để ẩn Accessory Bar (Done bar) của WKWebView trên iOS
extension WKWebView {
    func setHideAccessoryBar(_ hide: Bool) {
        guard let contentViewClass = NSClassFromString("WKContentView") else { return }
        let selector = #selector(getter: UIResponder.inputAccessoryView)
        guard let originalMethod = class_getInstanceMethod(contentViewClass, selector) else { return }
        
        let newBlock: @convention(block) (AnyObject) -> AnyObject? = { _ in
            return nil // Trả về nil để ẩn hoàn toàn Done bar
        }
        
        let newImplementation = imp_implementationWithBlock(newBlock)
        method_setImplementation(originalMethod, newImplementation)
    }
}

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Ẩn thanh Done bar của WebView bàn phím hệ thống
    let webView = WKWebView()
    webView.setHideAccessoryBar(true)
    
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
