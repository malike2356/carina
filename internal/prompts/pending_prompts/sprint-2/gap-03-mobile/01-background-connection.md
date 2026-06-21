# Gap 04 - Prompt 01: Persistent Background WebSocket Service

**Gap:** 04 - Native Mobile
**Prompt:** 01 of 04
**Primary agent:** Codex
**Fallback agent:** Claude Code (JS bridge portions)
**Estimated hours:** 6-8

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

The Carina mobile app (`carinaMobile/`) has 121 files already built. The React Native
JavaScript layer is complete: chat UI, memory panel, packs, billing, Scout, and settings
all exist. The only missing piece is the native platform layer.

Currently `carinaMobile/src/hooks/useConnectionStatus.ts` tracks connection state in-
process. When the user backgrounds the app, that hook goes dormant. The goal of this
prompt is a true platform foreground/background service so Carina maintains its WebSocket
connection even when the screen is off.

---

## Read First

Before writing any code, read these files completely:

- `carinaMobile/src/hooks/useConnectionStatus.ts` - existing hook you will wire to
- `carinaMobile/src/lib/native-capabilities.ts` - pattern for platform detection
- `carinaMobile/src/lib/biometric-prefs.ts` - pattern for native module wrapping
- `carinaMobile/package.json` - installed dependencies, RN version
- `carinaMobile/android/app/src/main/AndroidManifest.xml` - existing permissions
- `carinaMobile/ios/Carina/Info.plist` - existing iOS config
- `core.carinaai.uk/src/index.ts` - core agent entry point (understand WS endpoint)

---

## What Already Exists

- Complete React Native app with chat, memory, packs, billing, Scout
- `useConnectionStatus.ts` hook with in-process connection monitoring
- `native-capabilities.ts` for platform detection patterns
- Build configs for both Android and iOS

## What to Build

1. Android: `CarinaConnectionService.kt` - Foreground Service with persistent WebSocket
2. Android: `CarinaConnectionModule.kt` - React Native Native Module exposing the service
3. iOS: `CarinaBackgroundConnection.swift` - BGTaskScheduler + URLSession WebSocket
4. iOS: `CarinaBackgroundConnectionModule.m` / `.swift` - RCTEventEmitter bridge
5. TypeScript: `carinaMobile/src/lib/connection-service.ts` - unified JS bridge
6. Wire to existing `useConnectionStatus.ts` hook

---

## Step-by-Step Implementation

### Step 1: Android Foreground Service

Create `carinaMobile/android/app/src/main/java/com/carina/CarinaConnectionService.kt`:

```kotlin
package com.carina

import android.app.*
import android.content.Context
import android.content.Intent
import android.net.*
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class CarinaConnectionService : Service() {

    companion object {
        const val CHANNEL_ID = "carina_connection"
        const val NOTIF_ID = 1001
        const val TAG = "CarinaConn"
        const val ACTION_START = "com.carina.START_CONNECTION"
        const val ACTION_STOP = "com.carina.STOP_CONNECTION"
        var reactContext: ReactContext? = null
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var webSocket: WebSocket? = null
    private var client: OkHttpClient? = null
    private var wsUrl: String = ""
    private var reconnectAttempt = 0
    private val maxBackoffSeconds = 30L
    private var isRunning = false
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE)
                as ConnectivityManager
        registerNetworkCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                wsUrl = intent.getStringExtra("wsUrl") ?: return START_NOT_STICKY
                startForeground(NOTIF_ID, buildNotification("Connecting..."))
                isRunning = true
                scope.launch { connect() }
            }
            ACTION_STOP -> {
                isRunning = false
                webSocket?.close(1000, "Service stopped")
                scope.cancel()
                stopSelf()
            }
        }
        return START_STICKY
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
    private fun backoffDelay(): Long {
        val delay = minOf((1L shl reconnectAttempt), maxBackoffSeconds)
        reconnectAttempt = minOf(reconnectAttempt + 1, 5)
        return delay * 1000L
    }

    private suspend fun connect() {
        if (!isRunning) return

        // Battery optimization: reduce ping when battery < 20%
        val batteryLow = isBatteryLow()
        val pingIntervalSeconds = if (batteryLow) 60L else 20L

        client = OkHttpClient.Builder()
            .pingInterval(pingIntervalSeconds, TimeUnit.SECONDS)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()

        val request = Request.Builder().url(wsUrl).build()
        val listener = object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                reconnectAttempt = 0
                webSocket = ws
                updateNotification("Carina is running")
                emit("connection_state_change", mapOf(
                    "state" to "connected",
                    "url" to wsUrl
                ))
            }

            override fun onMessage(ws: WebSocket, text: String) {
                emit("message_received", mapOf("raw" to text))
                try {
                    val obj = JSONObject(text)
                    if (obj.has("event")) {
                        emit("agent_event", mapOf(
                            "event" to obj.getString("event"),
                            "data" to obj.opt("data")
                        ))
                    }
                } catch (_: Exception) {}
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                emit("connection_state_change", mapOf(
                    "state" to "closing",
                    "code" to code
                ))
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.w(TAG, "WebSocket failure: ${t.message}")
                emit("connection_state_change", mapOf(
                    "state" to "disconnected",
                    "error" to (t.message ?: "unknown")
                ))
                if (isRunning) {
                    scope.launch {
                        val delay = backoffDelay()
                        updateNotification("Reconnecting in ${delay / 1000}s...")
                        kotlinx.coroutines.delay(delay)
                        connect()
                    }
                }
            }
        }

        client?.newWebSocket(request, listener)
    }

    private fun isBatteryLow(): Boolean {
        val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return level < 20
    }

    private fun registerNetworkCallback() {
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available - triggering reconnect")
                webSocket?.close(1001, "Network change")
                reconnectAttempt = 0
                if (isRunning) scope.launch { connect() }
            }
            override fun onLost(network: Network) {
                emit("connection_state_change", mapOf("state" to "disconnected", "reason" to "network_lost"))
            }
        }
        val req = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager?.registerNetworkCallback(req, networkCallback!!)
    }

    private fun emit(event: String, data: Any) {
        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit(event, data.toString())
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Carina Connection",
                NotificationManager.IMPORTANCE_LOW
            ).apply { description = "Maintains Carina agent connection" }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pi = PendingIntent.getActivity(this, 0, intent,
            PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Carina")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(NOTIF_ID, buildNotification(text))
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        scope.cancel()
        client?.dispatcher?.executorService?.shutdown()
    }
}
```

### Step 2: Android Native Module

Create `carinaMobile/android/app/src/main/java/com/carina/CarinaConnectionModule.kt`:

```kotlin
package com.carina

import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CarinaConnectionModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "CarinaConnectionService"

    @ReactMethod
    fun startService(wsUrl: String, promise: Promise) {
        try {
            CarinaConnectionService.reactContext = reactContext
            val intent = Intent(reactContext, CarinaConnectionService::class.java).apply {
                action = CarinaConnectionService.ACTION_START
                putExtra("wsUrl", wsUrl)
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("START_FAILED", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactContext, CarinaConnectionService::class.java).apply {
                action = CarinaConnectionService.ACTION_STOP
            }
            reactContext.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
```

Register this module in your `MainApplication.kt` package list.

### Step 3: iOS Background Connection

Create `carinaMobile/ios/Carina/CarinaBackgroundConnection.swift`:

```swift
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
                default: break
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
```

Create `carinaMobile/ios/Carina/CarinaBackgroundConnection.m` (Obj-C bridge header):

```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CarinaBackgroundConnection, RCTEventEmitter)
RCT_EXTERN_METHOD(startConnection:(NSString *)urlString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopConnection:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
```

### Step 4: TypeScript Bridge

Create `carinaMobile/src/lib/connection-service.ts`:

```typescript
import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

// Event types emitted by the native service
export type ConnectionState = 'connected' | 'disconnected' | 'closing' | 'connecting';

export interface ConnectionStateEvent {
  state: ConnectionState;
  url?: string;
  error?: string;
  code?: number;
  reason?: string;
}

export interface MessageReceivedEvent {
  raw: string;
}

export interface AgentEvent {
  event: string;
  data: unknown;
}

// Resolve the correct native module by platform
const NativeModule =
  Platform.OS === 'android'
    ? NativeModules.CarinaConnectionService
    : NativeModules.CarinaBackgroundConnection;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

export const ConnectionService = {
  /**
   * Start the background connection to the Carina core WebSocket.
   * On Android this launches a Foreground Service.
   * On iOS this sets up a URLSession WebSocket + BGTaskScheduler.
   */
  async start(wsUrl: string): Promise<void> {
    if (!NativeModule) {
      console.warn('[ConnectionService] Native module not available (simulator or web?)');
      return;
    }
    await NativeModule.startConnection(wsUrl);
  },

  async stop(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.stopConnection();
  },

  onConnectionStateChange(
    handler: (event: ConnectionStateEvent) => void
  ): EmitterSubscription | null {
    return emitter?.addListener('connection_state_change', (raw: string) => {
      try {
        handler(JSON.parse(raw) as ConnectionStateEvent);
      } catch {
        // raw may already be an object on some RN versions
        handler(raw as unknown as ConnectionStateEvent);
      }
    }) ?? null;
  },

  onMessageReceived(
    handler: (event: MessageReceivedEvent) => void
  ): EmitterSubscription | null {
    return emitter?.addListener('message_received', (raw: string) => {
      try {
        handler(JSON.parse(raw) as MessageReceivedEvent);
      } catch {
        handler(raw as unknown as MessageReceivedEvent);
      }
    }) ?? null;
  },

  onAgentEvent(
    handler: (event: AgentEvent) => void
  ): EmitterSubscription | null {
    return emitter?.addListener('agent_event', (raw: string) => {
      try {
        handler(JSON.parse(raw) as AgentEvent);
      } catch {
        handler(raw as unknown as AgentEvent);
      }
    }) ?? null;
  },
};
```

### Step 5: Wire to useConnectionStatus

Modify `carinaMobile/src/hooks/useConnectionStatus.ts` to initialise the native
service when the app mounts and to subscribe to native events. The hook should:

1. On mount: call `ConnectionService.start(wsUrl)` where `wsUrl` is derived from
   the user's configured core URL (read from AsyncStorage or context).
2. Subscribe to `onConnectionStateChange` and update local state accordingly.
3. Subscribe to `onAgentEvent` and forward to any registered agent event handler.
4. On unmount: call `ConnectionService.stop()` and remove subscriptions.

The existing hook API (`isConnected`, `connectionState`, `lastPing`) must remain
unchanged so the rest of the app compiles without modification.

### Step 6: AndroidManifest Additions

In `carinaMobile/android/app/src/main/AndroidManifest.xml` add inside `<application>`:

```xml
<service
    android:name=".CarinaConnectionService"
    android:foregroundServiceType="connectedDevice"
    android:exported="false" />

<receiver
    android:name=".BootReceiver"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

And outside `<application>`:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

Create `carinaMobile/android/app/src/main/java/com/carina/BootReceiver.kt` to
restart the service after device reboot if the user had it running.

### Step 7: OkHttp Dependency

In `carinaMobile/android/app/build.gradle` confirm or add:

```groovy
implementation("com.squareup.okhttp3:okhttp:4.12.0")
```

---

## Files to Create

- `carinaMobile/android/app/src/main/java/com/carina/CarinaConnectionService.kt`
- `carinaMobile/android/app/src/main/java/com/carina/CarinaConnectionModule.kt`
- `carinaMobile/android/app/src/main/java/com/carina/BootReceiver.kt`
- `carinaMobile/ios/Carina/CarinaBackgroundConnection.swift`
- `carinaMobile/ios/Carina/CarinaBackgroundConnection.m`
- `carinaMobile/src/lib/connection-service.ts`

## Files to Modify

- `carinaMobile/android/app/src/main/AndroidManifest.xml` - add permissions + service declaration
- `carinaMobile/android/app/build.gradle` - add OkHttp
- `carinaMobile/android/app/src/main/java/com/carina/MainApplication.kt` - register module
- `carinaMobile/ios/Carina/Info.plist` - add BGTaskSchedulerPermittedIdentifiers
- `carinaMobile/src/hooks/useConnectionStatus.ts` - wire to native service

---

## Done-When Criteria

- [ ] Android: install app, open it, put it in background. After 5 minutes the
      foreground notification ("Carina is running") is still visible in the status bar.
- [ ] Android: turn off wifi and turn it back on. The app reconnects automatically
      within 5 seconds of network restoration.
- [ ] Android: with battery < 20% (simulated via `adb shell dumpsys battery set level 15`)
      the ping interval increases to 60s (verify in logcat).
- [ ] iOS: app backgrounded, 5 minutes later a BGTask fires and the WebSocket reconnects
      (verify in Xcode console).
- [ ] TypeScript bridge: `ConnectionService.onConnectionStateChange` fires in JS when
      native reconnects.
- [ ] Existing `useConnectionStatus.ts` hook API unchanged (no downstream compilation errors).
- [ ] No ANRs or crashes on Android (check logcat for exceptions).
