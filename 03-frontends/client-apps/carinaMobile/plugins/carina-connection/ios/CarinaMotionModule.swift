import CoreMotion
import Foundation
import React

@objc(CarinaMotionModule)
class CarinaMotionModule: RCTEventEmitter {

  private let motionManager = CMMotionActivityManager()
  private let queue = OperationQueue()

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! { ["activity_changed"] }

  @objc func startRecognition(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard CMMotionActivityManager.isActivityAvailable() else {
      reject("UNAVAILABLE", "Activity recognition not available", nil)
      return
    }
    motionManager.startActivityUpdates(to: queue) { [weak self] activity in
      guard let activity = activity else { return }
      let type: String
      if activity.running { type = "RUNNING" }
      else if activity.walking { type = "WALKING" }
      else if activity.cycling { type = "ON_BICYCLE" }
      else if activity.automotive { type = "IN_VEHICLE" }
      else if activity.stationary { type = "STILL" }
      else { type = "UNKNOWN" }
      self?.sendEvent(withName: "activity_changed", body: [
        "activity": type,
        "transition": "ENTER",
        "confidence": activity.confidence.rawValue,
        "timestamp": activity.startDate.timeIntervalSince1970 * 1000,
      ])
    }
    resolve(nil)
  }

  @objc func stopRecognition(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    motionManager.stopActivityUpdates()
    resolve(nil)
  }
}
