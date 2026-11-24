import XCTest

/// Test only. Drives the simulator's home screen, never the app itself.
final class ShapeTests: XCTestCase {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    /// Goes to the home-screen page that shows the app's icon, and stays there.
    func testShowIcon() {
        let name = ProcessInfo.processInfo.environment["SHAPE_APP_NAME"] ?? "Riddle Games"
        XCUIDevice.shared.press(.home)
        sleep(2)
        XCUIDevice.shared.press(.home)
        sleep(2)
        let icon = springboard.icons[name]
        var swipes = 0
        while !(icon.exists && icon.isHittable) && swipes < 5 {
            springboard.swipeLeft()
            sleep(2)
            swipes += 1
        }
        print("SHAPE icon '\(name)' exists=\(icon.exists) hittable=\(icon.exists && icon.isHittable) swipes=\(swipes) frame=\(icon.exists ? icon.frame : .zero)")
        XCTAssertTrue(icon.exists, "no icon named \(name) on the home screen")
    }

    func testTurnSideways() {
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(3)
        print("SHAPE orientation now \(XCUIDevice.shared.orientation.rawValue)")
    }

    func testTurnUpright() {
        XCUIDevice.shared.orientation = .portrait
        sleep(3)
        print("SHAPE orientation now \(XCUIDevice.shared.orientation.rawValue)")
    }
}
