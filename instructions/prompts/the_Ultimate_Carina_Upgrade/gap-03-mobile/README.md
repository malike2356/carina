# Gap 04 - Native Mobile Layer

## Purpose

The Carina mobile app (`carinaMobile/`) has 121 files already built: chat UI, memory
panel, packs browser, billing, Scout, settings, and more. The React Native JavaScript
layer is complete. What is missing is the native platform layer that gives the app
persistent connectivity, camera/vision access, activity recognition, SMS/notification
relaying, and companion pairing.

This gap closes that native layer with four focused prompts.

## Prompt Index

| File | Title | Agent | Hours |
|------|-------|-------|-------|
| 01-background-connection.md | Persistent WebSocket Service | Codex / Claude Code | 6-8 |
| 02-camera-motion.md | Camera Vision and Activity Recognition | Codex / Claude Code | 5-7 |
| 03-sms-notifications.md | SMS, Call Log, and Notification Relay | Codex / Claude Code | 5-6 |
| 04-companion-pairing.md | Companion Pairing Frontend | Claude Code / Cursor | 2-3 |

## Execution Order

Run these prompts in order: 01 establishes the connection layer that 02 and 03 build
on top of. Prompt 04 is independent and can run in parallel with 02 or 03.

## Key Constraint

The backend companion pairing is already built at:
`core.carinaai.uk/src/pairing/pairing.ts`

Prompt 04 is frontend-only. Do not rebuild or modify the backend.

## Repository Context

- Mobile app root: `carinaMobile/`
- Android native modules go in: `carinaMobile/android/app/src/main/java/com/carina/`
- iOS native modules go in: `carinaMobile/ios/Carina/`
- TypeScript bridges go in: `carinaMobile/src/lib/`
- Hooks go in: `carinaMobile/src/hooks/`
- Screens go in: `carinaMobile/src/screens/`

## Android Permissions Required (add to AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
```

## iOS Permissions Required (add to Info.plist)

```xml
<key>NSCameraUsageDescription</key>
<string>Carina uses the camera to provide visual context to the AI agent.</string>
<key>NSMotionUsageDescription</key>
<string>Carina uses motion data to understand your current activity context.</string>
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.carina.connection.refresh</string>
</array>
```
