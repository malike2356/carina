import Foundation

@objc(NotificationRelayManager)
class NotificationRelayManager: NSObject {

  static let shared = NotificationRelayManager()
  static let appGroupId = "group.uk.carinaai.mobile"

  private var defaults: UserDefaults {
    UserDefaults(suiteName: NotificationRelayManager.appGroupId) ?? .standard
  }

  var isEnabled: Bool {
    get { defaults.bool(forKey: "notif_relay_enabled") }
    set { defaults.set(newValue, forKey: "notif_relay_enabled") }
  }

  var allowedSources: Set<String> {
    get { Set(defaults.stringArray(forKey: "notif_relay_sources") ?? []) }
    set { defaults.set(Array(newValue), forKey: "notif_relay_sources") }
  }

  var privacyStartHour: Int {
    get {
      let value = defaults.integer(forKey: "privacy_start_hour")
      return value == 0 && !defaults.bool(forKey: "privacy_start_set") ? 7 : value
    }
    set {
      defaults.set(newValue, forKey: "privacy_start_hour")
      defaults.set(true, forKey: "privacy_start_set")
    }
  }

  var privacyEndHour: Int {
    get {
      let value = defaults.integer(forKey: "privacy_end_hour")
      return value == 0 && !defaults.bool(forKey: "privacy_end_set") ? 22 : value
    }
    set {
      defaults.set(newValue, forKey: "privacy_end_hour")
      defaults.set(true, forKey: "privacy_end_set")
    }
  }

  func configure(apiUrl: String, deviceToken: String?, apiKey: String?) {
    defaults.set(apiUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: "carina_api_url")
    defaults.set(deviceToken ?? "", forKey: "device_token")
    defaults.set(apiKey ?? "", forKey: "api_key")
  }

  func isSourceAllowed(_ source: String) -> Bool {
    let allowed = allowedSources
    if allowed.isEmpty { return false }
    return allowed.contains("ALL") || allowed.contains(source)
  }

  func isWithinPrivacyHours() -> Bool {
    let start = privacyStartHour
    let end = privacyEndHour
    let current = Calendar.current.component(.hour, from: Date())
    if start <= end {
      return current >= start && current <= end
    }
    return current >= start || current <= end
  }

  @objc func forwardToCarina(title: String, body: String, source: String) {
    guard isEnabled, isSourceAllowed(source), isWithinPrivacyHours() else { return }
    guard let apiUrl = defaults.string(forKey: "carina_api_url"),
          let url = URL(string: "\(apiUrl)/api/mobile/inbound") else { return }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let deviceToken = defaults.string(forKey: "device_token") ?? ""
    if !deviceToken.isEmpty {
      request.setValue(deviceToken, forHTTPHeaderField: "X-Device-Token")
    }
    let apiKey = defaults.string(forKey: "api_key") ?? ""
    if !apiKey.isEmpty {
      request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    }

    let payload: [String: Any] = [
      "type": "notification",
      "source": source,
      "title": title,
      "content": Self.applyRedaction(body),
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
    request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
    URLSession.shared.dataTask(with: request).resume()
  }

  static func applyRedaction(_ text: String) -> String {
    var result = text
    let replacements: [(String, String)] = [
      (#"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"#, "[CARD_REDACTED]"),
      (#"(?i)pin[:\s]+\d{4,6}"#, "[PIN_REDACTED]"),
      (#"(?i)password[:\s]+\S+"#, "[PASSWORD_REDACTED]"),
    ]
    for (pattern, replacement) in replacements {
      result = result.replacingOccurrences(
        of: pattern,
        with: replacement,
        options: .regularExpression,
      )
    }
    return result
  }
}
