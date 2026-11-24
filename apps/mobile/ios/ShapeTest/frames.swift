// Test only. frames.swift <video> <folder>: writes one small JPEG for every tenth of a second of the video.
import AVFoundation
import AppKit

let args = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
let generator = AVAssetImageGenerator(asset: asset)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 720, height: 720)
let length = CMTimeGetSeconds(asset.duration)
print("video length \(length) s")
var t = 0.0
var written = 0
while t < length {
    if let image = try? generator.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) {
        let rep = NSBitmapImageRep(cgImage: image)
        if let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.5]) {
            try? data.write(to: URL(fileURLWithPath: String(format: "%@/%06.2f.jpg", args[2], t)))
            written += 1
        }
    }
    t += 0.1
}
print("frames written \(written)")
