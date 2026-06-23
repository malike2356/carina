# Native Mobile Depth; Gap 2 Completion Prompt

**This covers the partial gap for both native Android and native iOS.**

**Status:** Partial; React Native app exists (`carinaMobile/`), needs Deep Native Integration Layer
**Reference:** Gap 2 in `02-native-mobile-depth.md`

---

## What's Missing (Native Depth Layer)

The React Native app works for basic chat, memory, packs, and billing. But it lacks the deep native sensor and system integration that OpenClaw's Android app has.

### Native Modules to Create

These go BEYOND what Expo provides out of the box. They require native code (Kotlin for Android, Swift for iOS) exposed to React Native via Native Modules.

---

## 1. Persistent WebSocket Service (Native Module)

**Why native:** Expo's background fetch is limited to periodic 30-second windows. A persistent WebSocket connection for real-time agent communication needs a foreground service (Android) or background task (iOS).

**Android (Kotlin native module):**
```
CarinaConnectionService.kt
- Foreground service with persistent notification
- WebSocket client with auto-reconnect
- Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
- Network change detection → reconnect
- Battery optimization (less frequent when low battery)
- Event emission to JS bridge
```

**iOS (Swift native module):**
```
CarinaBackgroundConnection.swift
- BGTaskScheduler for periodic connection check
- URLSession WebSocket with background configuration
- Silent push notification as wake trigger
- Event emission to JS bridge
```

**React Native interface:**
```typescript
interface CarinaConnectionNative {
  start(config: ConnectionConfig): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ConnectionStatus>;
  onEvent(event: string, callback: (data: any) => void): void;
}
```

---

## 2. Notification Listener (Native Module)

**Why native:** Only native code can access the Notification Listener Service (Android) or Notification Service Extension (iOS). This is how OpenClaw relays device notifications to the agent.

**Android:**
```
CarinaNotificationListener.kt
- NotificationListenerService implementation
- Filter by app package (whitelist)
- Extract title, body, timestamp, app name
- Relay to JS bridge → Carina agent context
- Privacy: opt-in per app, sensitive content filtering
```

**iOS (limited; iOS doesn't allow reading other apps' notifications):**
```
- UNNotificationServiceExtension for Carina's own notifications
- Cannot read other app notifications on iOS (OS limitation)
```

---

## 3. SMS Handler (Native Module)

**Why native:** Expo SMS only supports sending. Reading SMS and call logs requires native code (Android only; iOS does not allow SMS access).

**Android:**
```
CarinaSmsHandler.kt
- Read SMS inbox with pagination
- Read SMS threads by contact
- Send SMS (already available via expo-sms, but native for thread context)
- Read call log (missed, incoming, outgoing)
- Permission handling with rationale
```

---

## 4. Motion & Activity Recognition (Native Module)

**Why native:** Expo sensors provide raw data but not activity recognition (walking, running, driving). This needs Google Play Services Activity Recognition API (Android) or CoreMotion (iOS).

**Android:**
```
CarinaMotionHandler.kt
- ActivityRecognitionClient for activity detection
- Significant motion sensor
- Step counter with daily/weekly aggregation
- Activity transition events → JS bridge
```

**iOS:**
```
CarinaMotionManager.swift
- CMMotionActivityManager for activity detection
- CMPedometer for step counting
- Activity transition events → JS bridge
```

---

## 5. Camera Frame Stream (Native Module)

**Why native:** Expo Camera captures photos/videos but doesn't provide a continuous frame stream for vision analysis. OpenClaw's CameraCaptureManager provides this.

**Android:**
```
CarinaCameraCapture.kt
- Camera2 API for continuous frame capture
- Configurable resolution and frame rate
- JPEG compression with size limits (JpegSizeLimiter pattern)
- Frame callback to JS bridge
- Battery-aware: lower FPS when low battery
```

**iOS:**
```
CarinaCameraCapture.swift
- AVFoundation for continuous frame capture
- Configurable resolution and frame rate
- Frame callback to JS bridge
```

---

## 6. Secure Enclave Storage (Native Module)

**Why native:** expo-secure-store works but doesn't leverage hardware security modules (Android Keystore, iOS Secure Enclave) for the strongest protection.

**Android:**
```
CarinaSecureStorage.kt
- Android Keystore for key generation
- EncryptedSharedPreferences for config
- Biometric-protected key access
- Auto-lock after inactivity timeout
```

**iOS:**
```
CarinaSecureEnclave.swift
- SecKey in Secure Enclave
- Keychain with biometric protection
- Auto-lock after inactivity timeout
```

---

## 7. Companion Pairing (from Odysseus)

**Why native:** Bonjour/mDNS discovery for LAN pairing needs native code.

**Android + iOS (shared native module):**
```
CarinaPairingNative.kt / .swift
- Start/stop Bonjour service advertising
- Discover nearby Carina servers on LAN
- QR code scanning for pairing token
- Secure token exchange
- Token storage in secure enclave
```

---

## IMPLEMENTATION

### Native Module Registration

**Android (`MainApplication.kt`):**
```kotlin
// Register all native modules
addPackage(CarinaConnectionPackage())
addPackage(CarinaNotificationPackage())
addPackage(CarinaSmsPackage())
addPackage(CarinaMotionPackage())
addPackage(CarinaCameraPackage())
addPackage(CarinaSecureStoragePackage())
addPackage(CarinaPairingPackage())
```

**iOS (`AppDelegate.swift`):**
```swift
// Register all native modules via RCTBridge
```

### Permission Handling

Create a `SensorPermissionGate.tsx` component that:
1. Lists all sensors with their permission state
2. Shows rationale before requesting
3. Handles denial with explanation
4. Redirects to system settings if permanently denied

### Testing Native Modules

```
- Unit tests for Kotlin/Swift code (JUnit / XCTest)
- Integration tests via React Native testing
- E2E tests with physical device
- Mock native modules for JS testing
```

---

## PHASED BUILD ORDER

1. **ConnectionService**; most critical, enables background agent
2. **SecureStorage**; needed before any credential-using module
3. **Pairing**; enables phone-to-server connection
4. **Motion**; lowest permission friction, good first sensor
5. **NotificationListener**; Android only, high privacy sensitivity
6. **Camera**; most complex, requires camera2/AVFoundation expertise
7. **SMS**; Android only, legal restrictions in some regions
