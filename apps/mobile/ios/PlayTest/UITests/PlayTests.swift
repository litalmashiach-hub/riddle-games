import UIKit
import XCTest

/// Plays the built game by real taps, from a recorded list of steps (steps-<width>x<height>.json).
/// Test only: see reports/simulator-play in the project's files.
@MainActor
final class PlayTests: XCTestCase {
    let env = ProcessInfo.processInfo.environment
    lazy var app = XCUIApplication(bundleIdentifier: env["PLAY_BUNDLE_ID"] ?? "com.example.riddlegames")
    var t0 = Date()
    var problems: [String] = []
    var shotCount = 0

    var web: XCUIElement { app.webViews.firstMatch }

    func log(_ s: String) {
        let line = "PLAY| " + String(format: "%8.2f", Date().timeIntervalSince(t0)) + " | " + s
        print(line)
        fflush(stdout)
        // A second copy in a file, in case the test's output does not reach xcodebuild's.
        if let dir = env["PLAY_OUT"], let data = (line + "\n").data(using: .utf8) {
            let url = URL(fileURLWithPath: dir).appendingPathComponent("play-log.txt")
            if let h = try? FileHandle(forWritingTo: url) {
                h.seekToEndOfFile()
                h.write(data)
                h.closeFile()
            } else {
                try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
                try? data.write(to: url)
            }
        }
    }

    func problem(_ s: String) {
        problems.append(s)
        log("PROBLEM: " + s)
        _ = shot("problem-\(problems.count)")
    }

    func pause(_ seconds: Double) { Thread.sleep(forTimeInterval: seconds) }

    // MARK: pictures

    /// (spread of brightness, number of distinct colours, share of near-white pixels) of a screenshot, on a 64 by 64 copy.
    func stats(_ s: XCUIScreenshot) -> (sd: Double, colours: Int, white: Double, mean: Double) {
        guard let cg = s.image.cgImage else { return (-1, -1, -1, -1) }
        let w = 64, h = 64
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return (-1, -1, -1, -1) }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let raw = ctx.data else { return (-1, -1, -1, -1) }
        let p = raw.bindMemory(to: UInt8.self, capacity: w * h * 4)
        var sum = 0.0, sum2 = 0.0, white = 0
        var seen = Set<Int>()
        for i in 0..<(w * h) {
            let r = Int(p[i * 4]), g = Int(p[i * 4 + 1]), b = Int(p[i * 4 + 2])
            let l = 0.299 * Double(r) + 0.587 * Double(g) + 0.114 * Double(b)
            sum += l
            sum2 += l * l
            if r > 235 && g > 235 && b > 235 { white += 1 }
            seen.insert((r >> 4) << 8 | (g >> 4) << 4 | (b >> 4))
        }
        let n = Double(w * h)
        let mean = sum / n
        return ((sum2 / n - mean * mean).squareRoot(), seen.count, Double(white) / n, mean)
    }

    @discardableResult
    func shot(_ name: String) -> XCUIScreenshot {
        let s = XCUIScreen.main.screenshot()
        shotCount += 1
        let file = String(format: "%02d-%@.png", shotCount, name)
        if let dir = env["PLAY_OUT"] {
            do {
                try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
                try s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent(file), options: .atomic)
            } catch {
                log("could not write \(file): \(error)")
            }
        }
        let a = XCTAttachment(screenshot: s)
        a.name = file
        a.lifetime = .keepAlways
        add(a)
        let st = stats(s)
        log("shot \(file) size=\(Int(s.image.size.width))x\(Int(s.image.size.height)) scale=\(s.image.scale) orient=\(s.image.imageOrientation.rawValue) sd=\(Int(st.sd)) colours=\(st.colours) white=\(String(format: "%.2f", st.white))")
        return s
    }

    // MARK: finding things in the web view

    func button(_ prefix: String) -> XCUIElement {
        web.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }

    func anything(_ label: String) -> XCUIElement {
        web.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    func texts(containing part: String) -> [String] {
        web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", part)).allElementsBoundByIndex.map { $0.label }
    }

    func tapCentre(_ el: XCUIElement, _ what: String) {
        let f = el.frame
        log("tap \(what) at \(Int(f.midX)),\(Int(f.midY)) frame=\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height))")
        el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    /// Drags the page until the element's centre is on the screen.
    func bringIntoView(_ el: XCUIElement) {
        for i in 0..<12 {
            let win = web.frame
            let f = el.frame
            if f.height > 0 && f.midY > win.minY + 70 && f.midY < win.maxY - 50 { return }
            let below = f.midY >= win.maxY - 50
            log("scroll \(i): element centre y=\(Int(f.midY)), window \(Int(win.minY))..\(Int(win.maxY))")
            let from = web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: below ? 0.75 : 0.35))
            let to = web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: below ? 0.35 : 0.75))
            from.press(forDuration: 0.05, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.4)
            pause(0.6)
        }
    }

    func starTotal() -> String {
        let all = web.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+ / [0-9]+$")).allElementsBoundByIndex.map { $0.label }
        if let first = all.first { return first }
        // The total may be split over several text elements: list the short ones near the top of the map.
        let short = web.staticTexts.allElementsBoundByIndex.prefix(12).map { $0.label }.filter { $0.count <= 8 }
        return "pieces " + short.joined(separator: "|")
    }

    func waitForMap(_ what: String, since: Date) -> Bool {
        let firstCard = button("Level 1: ")
        let ok = firstCard.waitForExistence(timeout: 90)
        log("\(what): level map (its first level card) \(ok ? "seen" : "NOT seen") \(String(format: "%.2f", Date().timeIntervalSince(since))) s after the launch call")
        if !ok { problem("\(what): the level map did not appear in 90 s") }
        return ok
    }

    /// Screenshots in a loop after a tap that opens a level, to see when the 3D scene is drawn behind the rules card.
    func watchSceneAppear(_ name: String, since: Date) {
        var series: [String] = []
        var last: [Int] = []
        while Date().timeIntervalSince(since) < 45 {
            let s = XCUIScreen.main.screenshot()
            let t = Date().timeIntervalSince(since)
            let st = stats(s)
            series.append(String(format: "%.2f:%d/%d", t, Int(st.sd), st.colours))
            last.append(st.colours)
            if t > 6, last.count >= 5 {
                let tail = last.suffix(4)
                if let lo = tail.min(), let hi = tail.max(), lo > 30, hi - lo <= max(6, hi / 12) { break }
            }
            pause(0.15)
        }
        log("scene-watch \(name) (seconds after tap : brightness spread / distinct colours): " + series.joined(separator: " "))
    }

    // MARK: steps

    struct Step: Decodable {
        let action: String
        let label: String?
        let title: String?
        let text: String?
        let x: Double?
        let y: Double?
        let moves: Int?
        let summary: String?

        enum CodingKeys: String, CodingKey {
            case action = "do"
            case label, title, text, x, y, moves, summary
        }
    }

    struct Recording: Decodable {
        let size: [Int]
        let steps: [Step]
    }

    func loadSteps(width: Int, height: Int) -> Recording? {
        let name = "steps-\(width)x\(height)"
        var candidates: [URL] = []
        if let dir = env["PLAY_STEPS_DIR"] { candidates.append(URL(fileURLWithPath: dir).appendingPathComponent(name + ".json")) }
        if let u = Bundle(for: PlayTests.self).url(forResource: name, withExtension: "json") { candidates.append(u) }
        for u in candidates {
            if let d = try? Data(contentsOf: u), let r = try? JSONDecoder().decode(Recording.self, from: d) {
                log("steps from \(u.path): \(r.steps.count) steps")
                return r
            }
        }
        log("no steps file \(name).json (looked in \(candidates.map { $0.path }))")
        return nil
    }

    func testPlay() {
        continueAfterFailure = true
        t0 = Date()
        let attach = env["PLAY_ATTACH"] == "1"
        let maxLevels = Int(env["PLAY_MAX_LEVELS"] ?? "") ?? 99
        let hdFromLevel = Int(env["PLAY_HD_FROM_LEVEL"] ?? "") ?? 0
        let phone = UIDevice.current.userInterfaceIdiom == .phone
        log("device \(UIDevice.current.name), \(UIDevice.current.systemName) \(UIDevice.current.systemVersion), phone=\(phone), attach=\(attach), maxLevels=\(maxLevels), hdFromLevel=\(hdFromLevel)")
        if phone { XCUIDevice.shared.orientation = .landscapeLeft }

        // ---- launch
        var launchCall = Date()
        if attach {
            app.activate()
        } else {
            app.launch()
        }
        log("launch call returned after \(String(format: "%.2f", Date().timeIntervalSince(launchCall))) s")
        shot("after-launch-call")
        guard waitForMap("first launch", since: launchCall) else { log("RESULT levelsWon=0 problems=\(problems.count)"); return }
        pause(1.5)
        shot("level-map-first-launch")
        let wf = web.frame, af = app.frame
        log("web view frame \(wf), app frame \(af), screen scale \(UIScreen.main.scale)")
        log("star total at first launch: \(starTotal())")
        let labels = web.buttons.allElementsBoundByIndex.prefix(8).map { "\($0.label) enabled=\($0.isEnabled)" }
        log("first buttons: \(labels)")

        // ---- does the page scroll sideways, bounce or zoom? Compare the heading's frame before and after.
        let heading = web.staticTexts.matching(NSPredicate(format: "label == %@", "Riddle Games")).firstMatch
        log("heading as a text element exists: \(heading.exists)")
        let h0 = heading.frame
        web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
            .press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8)), withVelocity: .slow, thenHoldForDuration: 0.3)
        pause(1.0)
        let h1 = heading.frame
        web.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.3))
            .press(forDuration: 0.05, thenDragTo: web.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.3)), withVelocity: .slow, thenHoldForDuration: 0.3)
        pause(1.0)
        let h2 = heading.frame
        web.pinch(withScale: 2.0, velocity: 1.0)
        pause(1.0)
        let h3 = heading.frame
        log("heading frame: start \(h0) | after pull down \(h1) | after sideways drag \(h2) | after pinch out \(h3)")
        func near(_ a: CGRect, _ b: CGRect) -> Bool {
            abs(a.minX - b.minX) < 1.5 && abs(a.minY - b.minY) < 1.5 && abs(a.width - b.width) < 1.5 && abs(a.height - b.height) < 1.5
        }
        if !near(h1, h0) { problem("the level map moved after a pull down at its top: \(h0) -> \(h1)") }
        if !near(h2, h1) { problem("the level map moved after a sideways drag: \(h1) -> \(h2)") }
        if !near(h3, h2) { problem("the level map changed size after a pinch: \(h2) -> \(h3)") }
        shot("level-map-after-drag-and-pinch")

        // ---- play
        let w = Int(wf.width.rounded()), h = Int(wf.height.rounded())
        guard let rec = loadSteps(width: w, height: h) ?? loadSteps(width: h, height: w) else {
            problem("no recorded steps for a web view of \(w)x\(h)")
            log("RESULT levelsWon=0 problems=\(problems.count)")
            return
        }
        var level = 0
        var tapsInLevel = 0
        var hintsInLevel = 0
        var levelsWon = 0
        var openTap = Date()
        var stop = false
        var lastTap: XCUICoordinate?
        var retries = 0
        var relaunched = false
        for step in rec.steps {
            if stop { break }
            switch step.action {
            case "openLevel":
                let card = button(step.label ?? "Level 1")
                guard card.waitForExistence(timeout: 20) else { problem("no card \(step.label ?? "")"); stop = true; break }
                bringIntoView(card)
                shot("level-map-card-in-view")
                tapCentre(card, "card '\(card.label)'")
                openTap = Date()

            case "next":
                if level >= maxLevels { stop = true; break }
                let next = button("Next level")
                guard next.waitForExistence(timeout: 10) else { problem("no Next level button"); stop = true; break }
                tapCentre(next, "Next level")
                openTap = Date()

            case "rules":
                level += 1
                tapsInLevel = 0
                hintsInLevel = 0
                if level > maxLevels { stop = true; break }
                watchSceneAppear("level \(level) '\(step.title ?? "")'", since: openTap)
                let go = button("Let")
                if !go.waitForExistence(timeout: 30) && !attach && !relaunched {
                    relaunched = true
                    problem("level \(level): no rules card 30 s and more after the tap; ending the app and opening the level again")
                    app.terminate()
                    pause(2.0)
                    let again = Date()
                    app.launch()
                    if waitForMap("launch after a level that did not open", since: again) {
                        let card = button("Level \(level): ")
                        bringIntoView(card)
                        tapCentre(card, "card '\(card.label)'")
                        openTap = Date()
                        watchSceneAppear("level \(level), second try", since: openTap)
                    }
                }
                guard go.waitForExistence(timeout: 30) else { problem("level \(level): no rules card"); stop = true; break }
                log("level \(level): rules card with its button seen \(String(format: "%.2f", Date().timeIntervalSince(openTap))) s after the tap (includes the watching above)")
                let titles = texts(containing: step.title ?? "~")
                log("level \(level): title on screen: \(titles.first ?? "NOT FOUND") (recorded: \(step.title ?? ""))")
                if titles.isEmpty { problem("level \(level): expected the rules of '\(step.title ?? "")'") }
                shot("level-\(level)-rules-card")
                tapCentre(go, "Let's go!")
                pause(3.0)
                if hdFromLevel > 0 && level == hdFromLevel {
                    // A phone starts in SD and an iPad in HD. One tap on the quality button switches, and the game remembers it.
                    shot("level-\(level)-start-before-quality-tap")
                    let q = button("Graphics quality")
                    if q.exists {
                        tapCentre(q, "Graphics quality (switches SD and HD)")
                        pause(3.0)
                    } else {
                        problem("level \(level): no Graphics quality button")
                    }
                }
                shot("level-\(level)-start")

            case "hint":
                let hint = button("Hint")
                var waited = 0.0
                while !(hint.exists && hint.isEnabled) && waited < 20 { pause(0.3); waited += 0.3 }
                if waited >= 20 { problem("level \(level): the Hint button stayed disabled before hint \(hintsInLevel + 1)") }
                if let m = step.moves {
                    let counter = web.staticTexts.matching(NSPredicate(format: "label == %@", String(m))).firstMatch
                    if !counter.exists { problem("level \(level): the move counter does not read \(m) before hint \(hintsInLevel + 1)") }
                }
                tapCentre(hint, "Hint")
                hintsInLevel += 1
                pause(0.8)
                let toast = texts(containing: "💡")
                log("level \(level) hint \(hintsInLevel): on screen \(toast) | recorded '\(step.text ?? "")'")
                if hintsInLevel == 1 { shot("level-\(level)-first-hint") }

            case "tap":
                guard let x = step.x, let y = step.y else { break }
                tapsInLevel += 1
                let c = web.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y))
                log("level \(level) tap \(tapsInLevel) in the 3D scene at \(Int(c.screenPoint.x)),\(Int(c.screenPoint.y)) (\(x), \(y))")
                c.tap()
                lastTap = c
                pause(1.1)
                if tapsInLevel <= 2 || tapsInLevel == 5 { shot("level-\(level)-after-tap-\(tapsInLevel)") }

            case "moved":
                // The move counter must now read the recorded number. If not, the last tap is given once more.
                guard let m = step.moves else { break }
                let counter = web.staticTexts.matching(NSPredicate(format: "label == %@", String(m))).firstMatch
                if !counter.waitForExistence(timeout: 3) {
                    log("level \(level): the counter does not read \(m) after tap \(tapsInLevel); tapping the same place once more")
                    shot("level-\(level)-before-retry-\(retries + 1)")
                    lastTap?.tap()
                    retries += 1
                    pause(1.2)
                    if !counter.waitForExistence(timeout: 5) {
                        problem("level \(level): the counter still does not read \(m) after a second tap")
                    }
                }

            case "won":
                let solved = anything("Solved!")
                let ok = solved.waitForExistence(timeout: 40)
                if !ok {
                    problem("level \(level): no 'Solved!' card after \(tapsInLevel) taps")
                    stop = true
                    break
                }
                levelsWon += 1
                pause(1.5)
                let line = texts(containing: "hint")
                log("level \(level) WON by taps. Card says: \(line) | recorded '\(step.summary ?? "")'")
                shot("level-\(level)-win-card")

            default:
                break
            }
        }
        log("levels won by taps: \(levelsWon), taps given a second time: \(retries), relaunched for a level that did not open: \(relaunched)")

        // ---- back to the map, stars, relaunch
        let all = button("All levels")
        let home = button("Back to levels")
        if all.exists { tapCentre(all, "All levels") } else if home.exists { tapCentre(home, "Back to levels") }
        pause(2.0)
        let before = starTotal()
        log("star total on the map after play: \(before)")
        shot("level-map-after-play-top")
        let card1 = button("Level 1")
        if card1.exists {
            bringIntoView(card1)
            pause(0.5)
            shot("level-map-after-play-cards")
        }

        if !attach {
            app.terminate()
            pause(2.0)
            launchCall = Date()
            app.launch()
            log("second launch call returned after \(String(format: "%.2f", Date().timeIntervalSince(launchCall))) s")
            if waitForMap("second launch", since: launchCall) {
                pause(1.5)
                let after = starTotal()
                log("star total after the app was ended and opened again: \(after) (before: \(before))")
                if after != before { problem("stars changed over a relaunch: \(before) -> \(after)") }
                shot("level-map-after-relaunch-top")
                let again = button("Level 1")
                if again.exists {
                    bringIntoView(again)
                    pause(0.5)
                    shot("level-map-after-relaunch-cards")
                }
                let locked = web.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Level '")).allElementsBoundByIndex.prefix(6).map { $0.label }
                log("cards after relaunch: \(locked)")
            }
        }

        if !phone && !attach {
            XCUIDevice.shared.orientation = .landscapeLeft
            pause(3.0)
            log("iPad turned sideways: web view frame \(web.frame)")
            shot("level-map-ipad-sideways")
            XCUIDevice.shared.orientation = .portrait
            pause(2.0)
        }

        log("RESULT levelsWon=\(levelsWon) problems=\(problems.count)")
        for p in problems { log("RESULT problem: \(p)") }
        // No XCTest failure on purpose: a failed UI test makes xcodebuild gather diagnostics for many minutes.
        // The script that runs this test reads the RESULT line instead.
    }
}
