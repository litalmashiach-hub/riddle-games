import UIKit
import Capacitor

/// The game's only screen: Capacitor's web view, set up to behave like a game and not like a web page.
class GameViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let webView = webView else { return }
        // No rubber-band bounce, no page scroll, no pinch zoom of the page.
        // (The 3D view has its own pinch, handled inside the game.)
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        // Dark blue behind the page, so nothing flashes white between the launch screen and the first frame.
        let background = UIColor(red: 15 / 255, green: 34 / 255, blue: 54 / 255, alpha: 1)
        view.backgroundColor = background
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.isOpaque = false
    }

    // Full-screen game: no status bar. The page keeps clear of the notch and the home bar
    // itself, with CSS safe-area insets.
    override var prefersStatusBarHidden: Bool { true }

    // A first swipe from the bottom edge only shows the home bar; the second one leaves the game.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .bottom }

    // iPhone: sideways only, both directions. iPad: turns and resizes freely, as Apple asks of iPad apps
    // (the setting that let an iPad app refuse to rotate, UIRequiresFullScreen, is deprecated).
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        UIDevice.current.userInterfaceIdiom == .phone ? .landscape : .all
    }
}
