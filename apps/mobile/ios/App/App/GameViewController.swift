import UIKit
import WebKit
import Capacitor

/// The game's only screen: Capacitor's web view, set up to behave like a game and not like a web page.
class GameViewController: CAPBridgeViewController {

    /// The launch screen's picture, kept on top of the web view until the game has drawn.
    private var launchCover: UIImageView?
    private var loadingWatch: NSKeyValueObservation?

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
        coverUntilDrawn(webView)
    }

    /// The system takes its launch screen away as soon as this view exists, which is before the page
    /// has drawn anything. So the same picture, laid out the same way as in LaunchScreen.storyboard,
    /// stays on top until the game's first screen has been drawn, and then fades into it. Without it
    /// the player would see the launch picture, then an empty dark screen, then the game.
    private func coverUntilDrawn(_ webView: WKWebView) {
        guard launchCover == nil, let picture = UIImage(named: "Splash") else { return }
        let cover = UIImageView(image: picture)
        cover.contentMode = .scaleAspectFill
        cover.clipsToBounds = true
        cover.isUserInteractionEnabled = true   // no tap reaches the game before it can be seen
        cover.backgroundColor = webView.backgroundColor
        cover.frame = webView.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.addSubview(cover)
        launchCover = cover
        loadingWatch = webView.observe(\.isLoading, options: [.new]) { [weak self] webView, _ in
            guard !webView.isLoading, webView.url != nil else { return }
            DispatchQueue.main.async { self?.uncoverOnceDrawn(webView) }
        }
        // Never keep the game hidden, whatever happens to the page.
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in self?.uncover() }
    }

    /// Asks the loaded page to answer once its first screen is in place: something is inside the
    /// game's root element, two frames have been drawn, and the first screen's own fade-in is over.
    private func uncoverOnceDrawn(_ webView: WKWebView) {
        guard launchCover != nil, loadingWatch != nil else { return }
        loadingWatch = nil
        let drawn = """
            await new Promise((done) => {
              const look = () => document.querySelector('#root > *')
                ? requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 450)))
                : setTimeout(look, 50);
              look();
            });
            """
        webView.callAsyncJavaScript(drawn, arguments: [:], in: nil, in: .page) { [weak self] _ in
            self?.uncover()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        launchCover?.frame = view.bounds
    }

    private func uncover() {
        guard let cover = launchCover else { return }
        launchCover = nil
        loadingWatch = nil
        UIView.animate(withDuration: 0.3, animations: { cover.alpha = 0 }, completion: { _ in cover.removeFromSuperview() })
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
