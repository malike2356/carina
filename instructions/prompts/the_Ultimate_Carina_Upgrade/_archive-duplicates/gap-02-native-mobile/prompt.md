# Gap 2: Native Mobile Depth; Full Build Prompt

**Date revised:** 2026-06-18
**Status:** Partial (React Native app exists, 121 files; lacks deep native integration)
**Reference agents:** OpenClaw (Android Kotlin; full sensor integration), Odysseus (companion pairing)
**Existing code:** `carinaMobile/`; React Native + Expo SDK 54, 121 files (not 30+ as originally stated)

> Read `00-PRE-WORK-ALIGNMENT.md` Gap 2 section before starting.
>
> CRITICAL UPDATE: The companion pairing BACKEND is now built in `src/pairing/pairing.ts` and `infrastructure/device-pairing.ts`. The companion pairing section below is now a 2-3 day frontend task (QR scan + API call), not a week-long build. Adjust your timeline accordingly.
>
> Also: The mobile app already has 121 files covering basic chat, memory, packs, billing, Scout integration, hooks for everything, and full tabs. Do NOT spend time on those features. Only the native modules listed below are missing.

---

## SPECIFICATION

### What Carina Mobile Already Has
```
carinaMobile/
├── app/
│   ├── index.tsx; main entry
│   ├── _layout.tsx; root layout
│   ├── memory.tsx; memory management
│   ├── instance.tsx; instance management
│   ├── packs.tsx; skill packs
│   ├── usage.tsx; usage/billing
│   ├── (auth)/login.tsx; authentication
│   ├── (auth)/onboarding.tsx; onboarding
│   └── (tabs)/_layout.tsx; tab navigation
├── src/
│   ├── api/
│   │   ├── carina-client.ts; Carina API client
│   │   ├── scout-trust.ts; Scout integration
│   │   ├── scout-hosted.ts; Scout hosted
│   │   ├── packs-client.ts; packs API
│   │   ├── billing-client.ts; billing API
│   │   ├── memory-client.ts; memory API
│   │   ├── push-client.ts; push notifications
│   │   ├── chat-stream.ts; chat streaming
│   │   └── types.ts; API types
│   ├── lib/
│   │   ├── gateway-auth.ts; authentication
│   │   ├── task-store.ts; task management
│   │   ├── session-export.ts; session export
│   │   └── id.ts; ID generation
│   └── widgets/
│       ├── register-widget.tsx; widget registration
│       └── TaskCountWidget.tsx; task count widget
```

### What Needs to Be Added (from OpenClaw Android)

---

## FEATURES; ADOPT FROM OPENCLAW ANDROID

### 1. Background Service (from OpenClaw `ConnectionManager.kt`)
```
- Persistent WebSocket connection to Carina Gateway
- Auto-reconnect with exponential backoff
- Foreground service notification (Android requirement)
- Battery-optimized (work manager for periodic tasks)
- Network type awareness (WiFi vs cellular; different behaviors)

Implementation:
- expo-background-fetch for periodic tasks
- expo-task-manager for background execution
- Custom native module for persistent WebSocket
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/ConnectionManager.kt`

### 2. Camera Integration (from OpenClaw `CameraHandler.kt`, `CameraCaptureManager.kt`)
```
- Photo capture on agent request
- Video recording with configurable quality
- Continuous frame capture for vision analysis
- Camera selection (front/back)
- Flash control
- Image compression before upload (JpegSizeLimiter pattern)

Implementation:
- expo-camera for capture
- expo-image-manipulator for compression
- Custom native module for continuous frames
```

Files to study:
- `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/CameraHandler.kt`
- `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/CameraCaptureManager.kt`
- `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/JpegSizeLimiter.kt`

### 3. Location Services (from OpenClaw `LocationHandler.kt`, `LocationCaptureManager.kt`)
```
- Current location on agent request
- Continuous location tracking (with user consent)
- Geofencing for location-based triggers
- Location history
- Battery-aware location strategies (GPS vs network vs passive)

Implementation:
- expo-location for foreground/background location
- expo-task-manager for geofencing
```

Files to study:
- `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/LocationHandler.kt`
- `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/LocationCaptureManager.kt`

### 4. Contacts Integration (from OpenClaw `ContactsHandler.kt`)
```
- Read contacts (with permission)
- Search contacts by name, phone, email
- Create/update contacts on agent request
- Contact photo access
- Contact groups/labels

Implementation:
- expo-contacts for read/write access
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/ContactsHandler.kt`

### 5. Calendar Integration (from OpenClaw `CalendarHandler.kt`)
```
- Read calendar events
- Create/update/delete events
- Event reminders
- Calendar selection
- Recurring event support
- Free/busy checking

Implementation:
- expo-calendar for calendar access
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/CalendarHandler.kt`

### 6. SMS & Call Integration (from OpenClaw `SmsHandler.kt`, `CallLogHandler.kt`)
```
- Read SMS messages
- Send SMS on agent request
- Read call log
- SMS thread view
- Permission handling

Implementation:
- expo-sms for sending
- Custom native module for reading (Android only)
```

Files to study:
- `openclaw/apps/android/app/src/play/java/ai/openclaw/app/node/SmsHandler.kt`
- `openclaw/apps/android/app/src/play/java/ai/openclaw/app/node/CallLogHandler.kt`

### 7. Notification Relay (from OpenClaw `DeviceNotificationListenerService.kt`)
```
- Listen for device notifications
- Relay to Carina agent for context awareness
- Filter by app/priority
- Notification action handling
- Privacy controls (opt-in per app)

Implementation:
- NotificationListenerService (Android native)
- expo-notifications for local notifications
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/DeviceNotificationListenerService.kt`

### 8. System Information (from OpenClaw `SystemHandler.kt`)
```
- Battery level and charging state
- Network type and strength
- Storage space
- Current app in foreground
- Device info (model, OS version, screen size)
- Do Not Disturb status

Implementation:
- expo-battery for battery
- expo-device for device info
- NetInfo for network
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/SystemHandler.kt`

### 9. Motion Sensors (from OpenClaw `MotionHandler.kt`)
```
- Accelerometer data
- Gyroscope data
- Device orientation
- Step counter
- Significant motion detection
- Activity recognition (walking, running, driving, stationary)

Implementation:
- expo-sensors for accelerometer/gyroscope
- expo-pedometer for steps
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/MotionHandler.kt`

### 10. Photos & Media (from OpenClaw `PhotosHandler.kt`)
```
- Photo library access
- Photo metadata (date, location, size)
- Album management
- Photo selection (single/multiple)
- Media upload with progress

Implementation:
- expo-image-picker for selection
- expo-media-library for library access
```

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/PhotosHandler.kt`

### 11. Secure Storage (from OpenClaw)
```
- API keys and tokens in encrypted storage
- Biometric authentication for sensitive operations
- Auto-lock after inactivity
- Secure preferences for config

Implementation:
- expo-secure-store for encrypted storage
- expo-local-authentication for biometrics
```

### 12. Gateway Event Handler (from OpenClaw `GatewayEventHandler.kt`)
```
- Event types: tool calls, approvals, notifications, updates
- Event routing to appropriate handlers
- Event queue with persistence
- Offline event queuing

File to study: `openclaw/apps/android/app/src/main/java/ai/openclaw/app/node/GatewayEventHandler.kt`

---

## FEATURES; ADOPT FROM ODYSSEUS COMPANION

### 13. Companion Pairing (from Odysseus `companion/`)
```
- LAN discovery via Bonjour/mDNS
- QR code pairing
- Token-based auth
- Admin approval flow
- Token scoping to user identity

Implementation:
- expo-network for LAN discovery
- Custom Bonjour module or react-native-zeroconf
- QR code generation (existing qrcode.min.js pattern)

Files to study:
- `odysseus/companion/pairing.py`
- `odysseus/companion/routes.py`
```

---

## CARINA-SPECIFIC ADDITIONS

### 14. Scout Integration (from existing `scout-trust.ts`, `scout-hosted.ts`)
```
- Trust score widget on home screen
- Security event notifications
- Kill switch trigger (emergency button)
- Shield status indicator
- Quick security audit trigger
```

### 15. Kanban Board Widget
```
- Home screen widget showing task count
- Kanban board view for task management
- Drag-and-drop task status changes
- Task assignment and claiming
```

### 16. Voice Agent Mode
```
- Wake word detection ("Hey Carina")
- Continuous listening mode
- Voice activity detection
- TTS response playback
- Hands-free mode for driving/walking
```

### 17. Offline Mode
```
- Local LLM via llama.cpp (spec exists: SPEC-PHASE10-ONDEVICE.md)
- Offline message queue
- Sync when reconnected
- Offline-capable memory search
```

### 18. Widget System (expand existing)
```
- Today widget: agenda, tasks, Scout status
- Lock screen widget: quick actions
- Live activity: agent progress
- Complications: Apple Watch / Wear OS
```

---

## TECHNICAL SPECIFICATION

### New Files to Create
```
carinaMobile/
├── src/
│   ├── native/
│   │   ├── background-service.ts; persistent connection
│   │   ├── camera-handler.ts; camera operations
│   │   ├── location-handler.ts; location services
│   │   ├── contacts-handler.ts; contacts integration
│   │   ├── calendar-handler.ts; calendar integration
│   │   ├── sms-handler.ts; SMS integration
│   │   ├── notification-relay.ts; notification listener
│   │   ├── system-handler.ts; device info/sensors
│   │   ├── motion-handler.ts; motion sensors
│   │   ├── photos-handler.ts; photo library
│   │   ├── secure-storage.ts; encrypted storage
│   │   ├── pairing.ts; companion pairing
│   │   └── gateway-event-handler.ts; event processing
│   ├── voice/
│   │   ├── wake-word.ts; wake word detection
│   │   ├── voice-activity.ts; VAD
│   │   └── tts-player.ts; TTS playback
│   ├── offline/
│   │   ├── message-queue.ts; offline message queue
│   │   ├── local-llm.ts; on-device inference
│   │   └── sync-manager.ts; reconnection sync
│   ├── widgets/
│   │   ├── AgendaWidget.tsx; today widget
│   │   ├── ScoutWidget.tsx; Scout trust score
│   │   ├── KanbanWidget.tsx; task board widget
│   │   └── QuickActionWidget.tsx; lock screen actions
│   └── components/
│       ├── SensorPermissionGate.tsx; permission UI
│       ├── DeviceDashboard.tsx; device overview
│       ├── CameraCapture.tsx; camera UI
│       └── LocationPicker.tsx; location UI
```

### Permissions (Android + iOS)
```
Android Manifest additions:
  - FOREGROUND_SERVICE
  - CAMERA, RECORD_AUDIO
  - ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_BACKGROUND_LOCATION
  - READ_CONTACTS, WRITE_CONTACTS
  - READ_CALENDAR, WRITE_CALENDAR
  - READ_SMS, SEND_SMS
  - READ_CALL_LOG
  - BIND_NOTIFICATION_LISTENER_SERVICE
  - BODY_SENSORS
  - READ_EXTERNAL_STORAGE

iOS Info.plist additions:
  - NSCameraUsageDescription
  - NSMicrophoneUsageDescription
  - NSLocationWhenInUseUsageDescription
  - NSLocationAlwaysUsageDescription
  - NSContactsUsageDescription
  - NSCalendarsUsageDescription
  - NSMotionUsageDescription
  - NSPhotoLibraryUsageDescription
```

### Implementation Phases

**Phase 1; Sensor Foundation (Week 1)**
- Background service with persistent WebSocket
- Gateway event handler
- System handler (battery, network, device info)
- Permission infrastructure

**Phase 2; Media & Location (Week 2)**
- Camera handler (photo + video)
- Location handler (current + continuous)
- Motion sensors
- Photos/media access

**Phase 3; System Integration (Week 3)**
- Contacts handler
- Calendar handler
- SMS handler
- Notification relay
- Secure storage

**Phase 4; Voice & Companion (Week 4)**
- Wake word detection
- Voice activity detection
- TTS playback
- Companion pairing via Bonjour + QR

**Phase 5; Widgets & Offline (Week 5)**
- Home screen widgets
- Lock screen widgets
- Offline message queue
- On-device LLM integration
- Sync manager
