import UIKit
import XCTest

/// TEST ONLY, never merged. Looks at how the built app feels in a simulator: where the controls sit against
/// the safe areas the web view itself reports, what a long press, a double tap, a pinch and a drag do,
/// and whether the haptics plugin answers. The page carries a small observer (observer.js) that reports
/// what it measures as the label of an invisible element; this test reads that label.
@MainActor
final class FeelTests: XCTestCase {
    let env = ProcessInfo.processInfo.environment
    lazy var app = XCUIApplication(bundleIdentifier: env["FEEL_BUNDLE_ID"] ?? "com.example.riddlegames")
    var t0 = Date()
    var shotCount = 0
    var web: XCUIElement { app.webViews.firstMatch }

    func log(_ s: String) {
        let line = "FEELTEST| " + String(format: "%7.1f", Date().timeIntervalSince(t0)) + " | " + s
        print(line)
        fflush(stdout)
        if let dir = env["FEEL_OUT"], let data = (line + "\n").data(using: .utf8) {
            let url = URL(fileURLWithPath: dir).appendingPathComponent("feel-log.txt")
            if let h = try? FileHandle(forWritingTo: url) {
                h.seekToEndOfFile(); h.write(data); h.closeFile()
            } else {
                try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
                try? data.write(to: url)
            }
        }
    }

    func pause(_ s: Double) { Thread.sleep(forTimeInterval: s) }

    func shot(_ name: String) {
        let s = XCUIScreen.main.screenshot()
        shotCount += 1
        let file = String(format: "%02d-%@.png", shotCount, name)
        if let dir = env["FEEL_OUT"] {
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent(file), options: .atomic)
        }
        log("shot \(file) \(Int(s.image.size.width))x\(Int(s.image.size.height)) orient=\(s.image.imageOrientation.rawValue)")
    }

    func button(_ prefix: String) -> XCUIElement {
        web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    /// The observer's newest report, as the page wrote it.
    func report(_ what: String) {
        pause(3.5)
        let el = web.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "FEEL {")).firstMatch
        if el.waitForExistence(timeout: 8) {
            log("REPORT \(what): \(el.label)")
        } else {
            log("REPORT \(what): the observer's element was not found")
        }
    }

    func frames(_ what: String, _ prefixes: [String]) {
        let win = web.frame
        var parts = ["web view \(Int(win.minX)),\(Int(win.minY)) \(Int(win.width))x\(Int(win.height))"]
        for p in prefixes {
            let b = button(p)
            if b.exists { let f = b.frame; parts.append("\(p): x \(Int(f.minX))..\(Int(f.maxX)) y \(Int(f.minY))..\(Int(f.maxY))") } else { parts.append("\(p): not found") }
        }
        log("FRAMES \(what): " + parts.joined(separator: " | "))
    }

    /// What the system shows after a long press: an edit menu ("Copy", "Look Up"), if any.
    func menuItems() -> String {
        let wanted = ["Copy", "Look Up", "Select All", "Share…", "Translate", "Select"]
        let names = app.menuItems.allElementsBoundByIndex.map { $0.label } + app.buttons.matching(NSPredicate(format: "label IN %@", wanted)).allElementsBoundByIndex.map { $0.label }
        return names.isEmpty ? "none" : names.joined(separator: ", ")
    }

    func testFeel() {
        continueAfterFailure = true
        t0 = Date()
        let phone = UIDevice.current.userInterfaceIdiom == .phone
        if phone { XCUIDevice.shared.orientation = .landscapeLeft }
        log("device \(UIDevice.current.name), \(UIDevice.current.systemName) \(UIDevice.current.systemVersion), phone=\(phone)")
        app.launch()
        let first = button("Level 1: ")
        guard first.waitForExistence(timeout: 120) else { log("RESULT the level map did not appear"); shot("no-map"); return }
        pause(3)
        shot("map")
        report("level map")
        frames("level map", ["Level 1: ", "Mute", "About"])

        // ---- long press, double tap, pinch, pull on the level map
        let heading = web.staticTexts["Riddle Games"].firstMatch
        if heading.exists {
            let h0 = heading.frame
            heading.press(forDuration: 1.6)
            pause(0.6)
            log("after a long press on the heading: system menu items: \(menuItems())")
            shot("map-after-long-press-on-heading")
            heading.doubleTap()
            pause(0.8)
            let h1 = heading.frame
            web.pinch(withScale: 2.0, velocity: 1.0)
            pause(0.8)
            let h2 = heading.frame
            web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.9)))
            pause(0.8)
            let h3 = heading.frame
            log("heading frame: start \(h0) | after double tap \(h1) | after pinch out \(h2) | after pull down \(h3)")
            shot("map-after-double-tap-pinch-and-pull")
        } else {
            log("the heading was not found as a text element")
        }
        report("level map after a long press, a double tap, a pinch and a pull")

        // ---- the sound switch: off, then on
        let mute = button("Mute")
        if mute.exists { mute.tap(); pause(0.8); report("after turning the sound off") }
        let unmute = button("Unmute")
        if unmute.exists { unmute.tap(); pause(0.8); report("after turning the sound back on") }

        // ---- level 1: rules card
        first.tap()
        let go = button("Let's go!")
        guard go.waitForExistence(timeout: 60) else { log("RESULT level 1 did not open"); shot("no-level"); return }
        pause(2)
        shot("rules-card")
        report("rules card")
        let rule = web.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "wolf")).firstMatch
        if rule.exists {
            rule.press(forDuration: 1.6)
            pause(0.6)
            log("after a long press on a line of the rules: system menu items: \(menuItems())")
            shot("rules-card-after-long-press-on-text")
            report("rules card after a long press on its text")
        } else {
            log("no rules line with the word wolf was found")
        }
        go.tap()

        // ---- level 1: play
        pause(phone ? 25 : 30)
        shot("level-1-play")
        report("level 1 in play")
        frames("level 1 in play", ["Back to levels", "Graphics quality", "Mute", "Rules", "Undo", "Redo", "Restart", "Hint", "Row across"])
        let hint = web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Hint")).allElementsBoundByIndex.first(where: { $0.isHittable })
        if let hint = hint {
            hint.tap()
            pause(1.5)
            shot("level-1-hint")
            report("level 1 after a tap on Hint")
        } else {
            log("no Hint button could be tapped")
        }
        // A long press in the 3D scene: the scene may turn its own camera; no menu may come.
        web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).press(forDuration: 1.6)
        pause(0.6)
        log("after a long press in the scene: system menu items: \(menuItems())")
        shot("level-1-after-long-press-in-scene")
        let row = button("Row across")
        if row.exists && row.isHittable {
            row.tap()
            pause(8)
            shot("level-1-after-one-crossing")
            report("level 1 after one crossing")
        } else {
            log("no Row across button could be tapped")
        }

        // ---- the iPad turns
        if !phone {
            XCUIDevice.shared.orientation = .landscapeLeft
            pause(5)
            shot("ipad-sideways-level-1")
            report("iPad sideways, level 1")
            let home = button("Back to levels")
            if home.exists && home.isHittable { home.tap(); pause(5); shot("ipad-sideways-map"); report("iPad sideways, level map") }
            XCUIDevice.shared.orientation = .portrait
            pause(4)
        }
        log("RESULT done")
    }
}
