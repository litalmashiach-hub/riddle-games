import XCTest

/// TEST ONLY. Turns the simulated device, opens the app, and tries to share the screen or resize the window.
/// It asserts nothing: it takes pictures and prints what it sees, on lines that start with "SW".
final class SidewaysTests: XCTestCase {
    let env = ProcessInfo.processInfo.environment
    lazy var out: String = env["SW_OUT"] ?? NSTemporaryDirectory()
    lazy var app = XCUIApplication(bundleIdentifier: env["SW_BUNDLE"] ?? "com.example.riddlegames")
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    var count = 0

    override func setUp() { continueAfterFailure = true }

    func name(_ o: UIDeviceOrientation) -> String {
        switch o {
        case .portrait: return "upright"
        case .portraitUpsideDown: return "upside-down"
        case .landscapeLeft: return "sideways-left"
        case .landscapeRight: return "sideways-right"
        default: return "other(\(o.rawValue))"
        }
    }

    func facts() -> String {
        var s = "device=\(name(XCUIDevice.shared.orientation))"
        let w = app.windows.firstMatch
        if w.exists { s += " appWindow=\(w.frame)" } else { s += " appWindow=none" }
        let web = app.webViews.firstMatch
        if web.exists { s += " webView=\(web.frame)" }
        s += " appState=\(app.state.rawValue)"
        return s
    }

    func shot(_ label: String) {
        count += 1
        let file = String(format: "%@/%@-%02d-%@.png", out, env["SW_STEP"] ?? "x", count, label)
        let shot = XCUIScreen.main.screenshot()
        do { try shot.pngRepresentation.write(to: URL(fileURLWithPath: file)) } catch { print("SW could not write \(file): \(error)") }
        let a = XCTAttachment(screenshot: shot); a.name = label; a.lifetime = .keepAlways; add(a)
        print("SW picture \((file as NSString).lastPathComponent) size=\(shot.image.size) \(facts())")
    }

    func dump(_ what: XCUIApplication, _ label: String) {
        let file = "\(out)/\(env["SW_STEP"] ?? "x")-tree-\(label).txt"
        try? what.debugDescription.write(toFile: file, atomically: true, encoding: .utf8)
    }

    func turn(_ o: UIDeviceOrientation) {
        XCUIDevice.shared.orientation = o
        sleep(4)
        print("SW turned to \(name(o)); \(facts())")
    }

    func waitForMap() -> Bool {
        let card = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Level 1:'")).firstMatch
        let ok = card.waitForExistence(timeout: 90)
        print("SW level map shown=\(ok)")
        sleep(3)
        return ok
    }

    /// The device is upright when the app opens; then it is turned every way on the level map.
    func testTurnOnMap() {
        turn(.portrait)
        app.launch()
        sleep(2)
        shot("opening-device-upright")
        _ = waitForMap()
        shot("map-device-upright")
        turn(.landscapeLeft); shot("map-device-sideways-left")
        turn(.portrait); shot("map-device-upright-again")
        turn(.portraitUpsideDown); shot("map-device-upside-down")
        turn(.landscapeRight); shot("map-device-sideways-right")
        app.terminate()
    }

    /// Level 1 is opened with the device sideways; then the device is turned upright and back.
    func testTurnInLevel() {
        turn(.landscapeLeft)
        app.launch()
        guard waitForMap() else { shot("no-map"); return }
        let card = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Level 1:'")).firstMatch
        card.tap()
        let go = app.buttons["Let's go!"]
        print("SW rules card shown=\(go.waitForExistence(timeout: 90))")
        if go.exists { go.tap() }
        sleep(10)
        shot("level-device-sideways")
        turn(.portrait); shot("level-device-upright")
        turn(.landscapeRight); shot("level-device-sideways-right")
        app.terminate()
    }

    /// What the system offers for sharing the screen while the app is open.
    func testShareScreen() {
        turn(.landscapeLeft)
        app.launch()
        _ = waitForMap()
        shot("before")
        dump(springboard, "springboard-app-open")
        dump(app, "app")
        // The window's corner: on iPadOS 26 and later a drag from here resizes a window.
        let corner = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.995, dy: 0.995))
        let inside = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.55))
        corner.press(forDuration: 0.6, thenDragTo: inside)
        sleep(3)
        shot("after-corner-drag")
        // The top edge: window controls (iPadOS 26) or the three-dot multitasking button (iPadOS 16 to 18).
        let top = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.008))
        top.tap()
        sleep(2)
        shot("after-top-tap")
        dump(springboard, "springboard-after-top-tap")
        let topLeft = springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.02))
        topLeft.press(forDuration: 1.2)
        sleep(2)
        shot("after-top-left-press")
        dump(springboard, "springboard-after-top-left-press")
        app.terminate()
    }

    /// With windowed apps on: tries to drag the app's window into a tall, narrow shape, then a small one.
    func testPortraitWindow() {
        turn(.landscapeLeft)
        app.launch()
        _ = waitForMap()
        shot("before")
        let screen = springboard.frame
        print("SW screen=\(screen)")
        for (i, target) in [(0.30, 0.95), (0.25, 0.40)].enumerated() {
            let f = app.windows.firstMatch.frame
            print("SW window before drag \(i + 1): \(f)")
            // The window's bottom-right corner, a little inside it, in screen points.
            let from = springboard.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: f.maxX - 4, dy: f.maxY - 4))
            let to = springboard.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: f.minX + screen.width * target.0, dy: f.minY + screen.height * target.1))
            from.press(forDuration: 0.6, thenDragTo: to)
            sleep(4)
            shot(i == 0 ? "after-drag-tall-narrow" : "after-drag-small")
        }
        turn(.portrait)
        shot("window-device-upright")
        turn(.landscapeLeft)
        app.terminate()
    }

    /// Looks at the Settings page for multitasking, and turns on windowed apps where the page offers it.
    func testWindowedSetting() {
        turn(.landscapeLeft)
        settings.launch()
        sleep(4)
        shot("settings")
        dump(settings, "settings")
        let names = ["Multitasking & Gestures", "Home Screen & App Library", "Home Screen & Multitasking"]
        for n in names {
            let cell = settings.staticTexts[n].firstMatch
            if cell.exists {
                if !cell.isHittable { settings.swipeUp(); sleep(1) }
                cell.tap(); sleep(3)
                print("SW opened settings page \(n)")
                break
            }
        }
        shot("settings-multitasking")
        dump(settings, "settings-multitasking")
        for n in ["Windowed Apps", "Stage Manager"] {
            let choice = settings.staticTexts[n].firstMatch
            if choice.exists && choice.isHittable {
                choice.tap(); sleep(3)
                print("SW chose \(n)")
                break
            }
        }
        shot("settings-after-choice")
        dump(settings, "settings-after-choice")
        settings.terminate()
    }
}
