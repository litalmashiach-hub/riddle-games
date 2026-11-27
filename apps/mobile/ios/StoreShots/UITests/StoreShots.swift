// TEST ONLY (branch store-screenshots-test). Turns the simulator sideways and launches the app. For each scene that
// the screenshot director inside the app names (one accessibility label on a 2-point element in the top-left
// corner that paints nothing), it takes pictures with XCUIScreen, asks shoot.sh on the Mac to take its own with
// simctl, and then taps that element: the director goes on to the next scene. It taps nothing else.
import XCTest

final class StoreShots: XCTestCase {
  var shots = ["01-river", "02-hanoi", "03-coins", "04-balloon", "05-moonbeam", "06-pancakes", "07-hint", "08-map"]
  let live: Set<String> = ["01-river", "02-hanoi", "03-coins", "04-balloon"]

  func log(_ s: String, _ dir: String) {
    let line = "\(Date().timeIntervalSince1970) \(s)\n"
    print("SHOTLOG " + line, terminator: "")
    let path = dir + "/test-log.txt"
    if let h = FileHandle(forWritingAtPath: path) { h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); h.closeFile() }
    else { try? line.write(toFile: path, atomically: true, encoding: .utf8) }
  }

  func testShoot() throws {
    let env = ProcessInfo.processInfo.environment
    let dir = env["SHOOT_OUT"] ?? "/tmp/shoot"
    let bundle = env["SHOOT_BUNDLE_ID"] ?? "com.example.riddlegames"
    continueAfterFailure = true
    if let only = env["SHOOT_ONLY"], !only.isEmpty { shots = only.split(separator: ",").map(String.init) }
    let noHost = env["SHOOT_NO_HOST"] == "1"
    executionTimeAllowance = 7200
    XCUIDevice.shared.orientation = .landscapeLeft
    let app = XCUIApplication(bundleIdentifier: bundle)
    app.launch()
    log("launched", dir)
    XCUIDevice.shared.orientation = .landscapeLeft
    let started = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "shoot-start")).firstMatch
    log("start marker: \(started.waitForExistence(timeout: 300))", dir)
    for name in shots {
      let m = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "shoot-" + name)).firstMatch
      let ok = m.waitForExistence(timeout: 600)
      log("scene \(name): \(ok)", dir)
      let sub = dir + "/xc/" + name
      try? FileManager.default.createDirectory(atPath: sub, withIntermediateDirectories: true)
      let count = live.contains(name) ? 12 : 6
      for i in 0..<count {
        let shot = XCUIScreen.main.screenshot()
        try? shot.pngRepresentation.write(to: URL(fileURLWithPath: sub + String(format: "/%02d.png", i)))
        log("xc picture \(name) \(i) \(Int(shot.image.size.width))x\(Int(shot.image.size.height)) scale \(shot.image.scale)", dir)
        Thread.sleep(forTimeInterval: live.contains(name) ? 0.4 : 2.0)
      }
      if noHost { app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: 3, dy: 3)).tap(); log("tapped \(name)", dir); continue }
      // Now the Mac's own pictures of the same scene.
      try? name.write(toFile: dir + "/current", atomically: true, encoding: .utf8)
      let hostDone = dir + "/host-done-" + name
      let until = Date().addingTimeInterval(240)
      while !FileManager.default.fileExists(atPath: hostDone) && Date() < until { Thread.sleep(forTimeInterval: 1) }
      log("host pictures \(name): \(FileManager.default.fileExists(atPath: hostDone))", dir)
      // The marker is too small for XCUITest to call it hittable: tap its place on the screen.
      app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0)).withOffset(CGVector(dx: 3, dy: 3)).tap()
      log("tapped \(name)", dir)
    }
    let done = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "shoot-done")).firstMatch
    log("done marker: \(done.waitForExistence(timeout: 300))", dir)
    try? "done".write(toFile: dir + "/current", atomically: true, encoding: .utf8)
    app.terminate()
  }
}
