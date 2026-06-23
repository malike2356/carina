**Status: COMPLETED 2026-06-21**

**What was built:**
- Server-side `camera_capture`, `screen_record`, `location_get`, `location_watch`, `location_watch_stop` tools
- Protocol command handling in `ws-transport.ts` for headless node hosts
- Note: native iOS/Android capability handlers remain a mobile client follow-up

# Gap 20 - Prompt 03: Camera Capture, Screen Recording & Location Services

**Gap:** 20 Node System & Device Architecture
**Prompt number:** 03 of 04
**Name:** Camera capture, screen recording, location.get/location.watch
**Primary agent:** Claude Code (server) / Codex (native mobile)
**Estimated hours:** 3-4 h
**Depends on:** 01-node-protocol.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

Add three peripheral capabilities to the node system.

### 1. Camera Capture

Server-side tool:

```typescript
// tools/camera-capture.ts
{
  name: 'camera_capture',
  description: 'Take a photo using a connected device camera',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      source: { type: 'string', enum: ['front', 'back', 'external'], default: 'back' },
      format: { type: 'string', enum: ['jpeg', 'png'], default: 'jpeg' },
      quality: { type: 'number', minimum: 0.1, maximum: 1.0, default: 0.8 },
    },
    required: ['deviceId'],
  },
}

// Implementation:
async function cameraCapture(params, nodeHost: NodeHostServer): Promise<ToolResult> {
  const response = await nodeHost.sendCommand(
    params.deviceId,
    NodeCapability.CAMERA_CAPTURE,
    'capture',
    { source: params.source, format: params.format, quality: params.quality },
    15000,
  );

  if (!response.ok) {
    return { content: [{ type: 'text', text: `Camera capture failed: ${response.error}` }] };
  }

  // response.payload is { dataUrl: string, width: number, height: number, timestamp: number }
  const { dataUrl } = response.payload as any;
  return {
    content: [
      { type: 'image_url', image_url: { url: dataUrl } },
      { type: 'text', text: `Photo captured (${response.payload.width}x${response.payload.height})` },
    ],
  };
}
```

### 2. Screen Recording

```typescript
{
  name: 'screen_record',
  description: 'Record the screen of a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      action: { type: 'string', enum: ['start', 'stop', 'status'] },
      duration: { type: 'number', description: 'Max seconds (start only, default 60)' },
      includeAudio: { type: 'boolean', default: false },
    },
    required: ['deviceId', 'action'],
  },
}
```

Starting a recording returns a `recordingId`. Stopping returns the video data URL.
Status shows current recording state and duration.

### 3. Location Services

```typescript
{
  name: 'location_get',
  description: 'Get current GPS location from a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      highAccuracy: { type: 'boolean', default: true },
      timeout: { type: 'number', default: 10000 },
    },
    required: ['deviceId'],
  },
}

// Returns: { latitude, longitude, altitude, accuracy, heading, speed, timestamp }

{
  name: 'location_watch',
  description: 'Start watching GPS location changes on a connected device',
  parameters: {
    type: 'object',
    properties: {
      deviceId: { type: 'string' },
      interval: { type: 'number', default: 5000, description: 'Update interval in ms' },
      distanceFilter: { type: 'number', default: 10, description: 'Min movement in meters' },
      duration: { type: 'number', default: 60000, description: 'Watch duration in ms' },
    },
    required: ['deviceId'],
  },
}

// Returns: watchId for later stop: location_watch_stop(deviceId, watchId)
```

### Native Implementation (Mobile -- Codex task)

Each capability needs native implementation on iOS (Swift) and Android (Kotlin):

**iOS:**
- Camera: `AVCaptureSession` + `AVCapturePhotoOutput`
- Screen record: `RPScreenRecorder.shared()`
- Location: `CLLocationManager` (requestWhenInUseAuthorization)

**Android:**
- Camera: `CameraX` (ImageCapture + Preview)
- Screen record: `MediaProjectionManager`
- Location: `FusedLocationProviderClient`

Each capability connects to the gateway WebSocket and responds to commands.

---

## Existing Carina code to integrate with

- `infrastructure/node-host/` -- node protocol (prompt 01)
- `tools/toolset.ts` -- register camera/screen/location tools
- `external/client-apps/carinaMobile/ios/` -- Swift native modules
- `external/client-apps/carinaMobile/android/` -- Kotlin native modules
