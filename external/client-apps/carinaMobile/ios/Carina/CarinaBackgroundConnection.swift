import Foundation
import BackgroundTasks
import React

@objc(CarinaBackgroundConnection)
class CarinaBackgroundConnection: RCTEventEmitter {

  private var urlSession: URLSession?
  private var webSocketTask: URLSessionWebSocketTask?
  private var wsURL: URL?
  private var reconnectAttempt = 0
  private let maxBackoffSeconds = 30.0
  private var isRunning = false
  private var reconnectTimer: Timer?

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! {
    ["connection_state_change", "message_received", "agent_event"]
  }

  @objc func startConnection(_ urlString: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let url = URL(string: urlString) else {
      reject("INVALID_URL", "Invalid WebSocket URL", nil)
      return
    }
    wsURL = url
    isRunning = true
    registerBackgroundTask()
    connect()
    resolve(nil)
  }

  @objc func stopConnection(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    isRunning = false
    reconnectTimer?.invalidate()
    webSocketTask?.cancel(with: .normalClosure, reason: nil)
    resolve(nil)
  }

  private func connect() {
    guard isRunning, let url = wsURL else { return }

    let config = URLSessionConfiguration.default
    config.waitsForConnectivity = true
    urlSession = URLSession(configuration: config, delegate: nil, delegateQueue: .main)
    webSocketTask = urlSession?.webSocketTask(with: url)
    webSocketTask?.resume()
    listenForMessages()

    sendEvent(withName: "connection_state_change", body: ["state": "connected", "url": url.absoluteString])
    reconnectAttempt = 0
    schedulePing()
  }

  private func schedulePing() {
    reconnectTimer?.invalidate()
    reconnectTimer = Timer.scheduledTimer(withTimeInterval: 20.0, repeats: true) { [weak self] _ in
      self?.webSocketTask?.sendPing { error in
        if let error = error {
          self?.handleDisconnection(reason: error.localizedDescription)
        }
      }
    }
  }

  private func listenForMessages() {
    webSocketTask?.receive { [weak self] result in
      switch result {
      case .success(let message):
        switch message {
        case .string(let text):
          self?.sendEvent(withName: "message_received", body: ["raw": text])
          if let data = text.data(using: .utf8),
             let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
             let event = json["event"] as? String {
            self?.sendEvent(withName: "agent_event", body: ["event": event, "data": json["data"] ?? NSNull()])
          }
        default:
          break
        }
        self?.listenForMessages()
      case .failure(let error):
        self?.handleDisconnection(reason: error.localizedDescription)
      }
    }
  }

  private func handleDisconnection(reason: String) {
    guard isRunning else { return }
    sendEvent(withName: "connection_state_change", body: ["state": "disconnected", "error": reason])
    let delay = min(pow(2.0, Double(reconnectAttempt)), maxBackoffSeconds)
    reconnectAttempt = min(reconnectAttempt + 1, 5)
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
      self?.connect()
    }
  }

  private func registerBackgroundTask() {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.carina.connection.refresh", using: nil) { [weak self] task in
      self?.handleBackgroundRefresh(task: task as! BGAppRefreshTask)
    }
    scheduleBackgroundRefresh()
  }

  private func scheduleBackgroundRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.carina.connection.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60)
    try? BGTaskScheduler.shared.submit(request)
  }

  private func handleBackgroundRefresh(task: BGAppRefreshTask) {
    scheduleBackgroundRefresh()
    if webSocketTask?.state != .running {
      connect()
    }
    task.setTaskCompleted(success: true)
  }
}
