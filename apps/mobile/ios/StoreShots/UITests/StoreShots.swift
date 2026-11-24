// TEST ONLY (branch store-screenshots-test). Turns the simulator sideways, launches the app, and waits for the
// screenshot director inside the app to name each scene (one accessibility label). It writes the scene's name to a
// file on the Mac, where shoot.sh takes the pictures with simctl. It taps nothing.
import XCTest

final class StoreShots: XCTestCase {
  let shots = ["01-river", "02-hanoi", "03-coins", "04-balloon", "05-moonbeam", "06-pancakes", "07-hint", "08-map"]

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
    XCUIDevice.shared.orientation = .landscapeLeft
    let app = XCUIApplication(bundleIdentifier: bundle)
    app.launch()
    log("launched", dir)
    XCUIDevice.shared.orientation = .landscapeLeft
    let started = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "shoot-start")).firstMatch
    log("start marker: \(started.waitForExistence(timeout: 300))", dir)
    for name in shots {
      let m = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "shoot-" + name)).firstMatch
      let ok = m.waitForExistence(timeout: 420)
      log("scene \(name): \(ok)", dir)
      try? name.write(toFile: dir + "/current", atomically: true, encoding: .utf8)
      // shoot.sh takes the pictures while the director holds the scene; wait for the next name.
    }
    let done = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "shoot-done")).firstMatch
    log("done marker: \(done.waitForExistence(timeout: 300))", dir)
    try? "done".write(toFile: dir + "/current", atomically: true, encoding: .utf8)
  }
}
