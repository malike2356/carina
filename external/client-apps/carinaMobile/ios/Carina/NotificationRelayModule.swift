import Foundation
import React

@objc(NotificationRelayModule)
class NotificationRelayModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func configure(_ apiUrl: String, deviceToken: String?, apiKey: String?, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NotificationRelayManager.shared.configure(apiUrl: apiUrl, deviceToken: deviceToken, apiKey: apiKey)
    resolve(nil)
  }

  @objc func setNotificationRelayEnabled(_ enabled: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NotificationRelayManager.shared.isEnabled = enabled
    resolve(nil)
  }

  @objc func setAllowedSources(_ sources: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NotificationRelayManager.shared.allowedSources = Set(sources)
    resolve(nil)
  }

  @objc func setPrivacyHours(_ startHour: Int, endHour: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NotificationRelayManager.shared.privacyStartHour = startHour
    NotificationRelayManager.shared.privacyEndHour = endHour
    resolve(nil)
  }

  @objc func getSettings(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let relay = NotificationRelayManager.shared
    resolve([
      "notificationEnabled": relay.isEnabled,
      "allowedSources": Array(relay.allowedSources),
      "privacyStartHour": relay.privacyStartHour,
      "privacyEndHour": relay.privacyEndHour,
    ])
  }

  @objc func forwardNotification(_ title: String, body: String, source: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    NotificationRelayManager.shared.forwardToCarina(title: title, body: body, source: source)
    resolve(nil)
  }
}
