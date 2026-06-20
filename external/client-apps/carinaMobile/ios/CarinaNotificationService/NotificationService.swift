import UserNotifications

class NotificationService: UNNotificationServiceExtension {

  var contentHandler: ((UNNotificationContent) -> Void)?
  var bestAttemptContent: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void,
  ) {
    self.contentHandler = contentHandler
    bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

    guard let content = bestAttemptContent else {
      contentHandler(request.content)
      return
    }

    let relay = NotificationRelayManager.shared
    let source = content.categoryIdentifier.isEmpty ? request.identifier : content.categoryIdentifier
    if relay.isEnabled && relay.isSourceAllowed(source) {
      relay.forwardToCarina(title: content.title, body: content.body, source: source)
    }

    contentHandler(content)
  }

  override func serviceExtensionTimeWillExpire() {
    if let contentHandler = contentHandler, let bestAttemptContent = bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }
}
