# Sprint 2 - Category 05: Mobile Native

## What Exists

- `carinaMobile/` - 121-file React Native / Expo Router app
- Chat, memory management, billing, Scout integration tabs
- API clients for Carina Gateway, Scout, billing, memory, push
- Session export, task management, widget system

## What Is Missing

- Background WebSocket service (persistent connection when app is backgrounded)
- Microphone access and audio pipeline for voice input
- Push notifications (FCM on Android, APNs on iOS)
- Camera and activity recognition (QR scanning, context from photos)
- SMS and call relay (forward texts and calls to Carina for processing)

## Prompts in This Category

- `01-background-websocket.md` - Persistent WebSocket with Android foreground service and iOS BGTaskScheduler
- `02-microphone-audio-pipeline.md` - Mic access, PCM capture, Opus streaming to gateway
- `03-push-notifications.md` - FCM + APNs integration with silent push reconnect
- `04-camera-activity-recognition.md` - Camera access, QR scanning, photo context
- `05-sms-call-relay.md` - Forward SMS and call events to Carina for processing

## Original Reference

`sprint-2/gap-03-mobile/` (Phase 1 of voice roadmap foundation)
