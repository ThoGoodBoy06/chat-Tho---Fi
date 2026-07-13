import UIKit
import Flutter
import WebKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // Fix: cho phép bàn phím ảo tự hiện khi JS gọi focus() không từ user gesture trực tiếp
    WKWebView.forceEnableProgrammaticKeyboard()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

extension WKWebView {
    private static let swizzleFocusOnce: Void = {
        guard let contentViewClass = NSClassFromString("WKContentView") else {
            print("⚠️ Không tìm thấy WKContentView (Apple có thể đã đổi tên ở iOS mới hơn).")
            return
        }
        let selector = NSSelectorFromString(
            "_startAssistingNode:userIsInteracting:blurPreviousNode:changingActivityState:userObject:"
        )
        guard let originalMethod = class_getInstanceMethod(contentViewClass, selector) else {
            print("⚠️ Không tìm thấy selector _startAssistingNode, API iOS có thể đã thay đổi.")
            return
        }

        typealias OriginalIMP = @convention(c) (AnyObject, Selector, AnyObject?, Bool, Bool, Bool, AnyObject?) -> Void
        let originalImp = method_getImplementation(originalMethod)
        let originalFunc = unsafeBitCast(originalImp, to: OriginalIMP.self)

        let swizzledBlock: @convention(block) (AnyObject, AnyObject?, Bool, Bool, Bool, AnyObject?) -> Void = {
            (receiver, node, _, blurPreviousNode, changingActivityState, userObject) in
            // Ép luôn userIsInteracting = true -> WKWebView coi đây là tương tác thật, sẽ bật bàn phím
            originalFunc(receiver, selector, node, true, blurPreviousNode, changingActivityState, userObject)
        }

        let swizzledImp = imp_implementationWithBlock(swizzledBlock)
        method_setImplementation(originalMethod, swizzledImp)
    }()

    static func forceEnableProgrammaticKeyboard() {
        _ = swizzleFocusOnce
    }
}
