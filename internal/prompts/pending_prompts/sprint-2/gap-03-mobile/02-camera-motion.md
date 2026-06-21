# Gap 04 - Prompt 02: Camera Vision and Activity Recognition

**Gap:** 04 - Native Mobile
**Prompt:** 02 of 04
**Primary agent:** Codex
**Fallback agent:** Claude Code
**Estimated hours:** 5-7

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

The Carina agent needs to "see" and "know what the user is doing" to provide proactive
assistance. This prompt builds:

1. Camera frame capture - continuously grabs frames (default 2 fps) and delivers them
   to JavaScript so they can be sent to the Carina core as visual context.
2. Activity recognition - detects whether the user is walking, running, still, in a
   vehicle, or cycling, and emits that state to JavaScript.

The existing app already has chat, memory, packs, billing, and Scout screens. These
native modules are additive - they do not replace any existing functionality.

---

## Read First

- `carinaMobile/src/hooks/useConnectionStatus.ts` - pattern for hook that wraps native
- `carinaMobile/src/lib/native-capabilities.ts` - pattern for platform detection
- `carinaMobile/package.json` - RN version and existing packages
- `carinaMobile/android/app/src/main/java/com/carina/CarinaConnectionModule.kt`
  (from prompt 01) - follow the same module registration pattern
- `carinaMobile/android/app/src/main/AndroidManifest.xml` - existing permissions

---

## What Already Exists

- React Native app with all JS screens done
- Module registration pattern from prompt 01
- AndroidManifest.xml and Info.plist already partially updated in prompt 01

## What to Build

1. `CarinaVisionModule.kt` - Android camera frame capture
2. `CarinaVisionModule.swift` + bridge header - iOS frame capture
3. `CarinaMotionModule.kt` - Android activity recognition
4. `CarinaMotionModule.swift` + bridge header - iOS activity recognition
5. `carinaMobile/src/lib/camera-vision.ts` - TypeScript bridge for vision
6. `carinaMobile/src/lib/motion-activity.ts` - TypeScript bridge for activity
7. `carinaMobile/src/hooks/useVisionCapture.ts` - React hook for vision feed
8. `carinaMobile/src/hooks/useActivityMonitor.ts` - React hook for activity

---

## Step-by-Step Implementation

### Step 1: Android Camera Module

Create `carinaMobile/android/app/src/main/java/com/carina/CarinaVisionModule.kt`:

```kotlin
package com.carina

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class CarinaVisionModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "CarinaVision"
        const val EVENT_FRAME = "vision_frame"
    }

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var imageReader: ImageReader? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private val isCapturing = AtomicBoolean(false)
    private var fpsPeriodMs = 500L // default 2 fps
    private var lastFrameTime = 0L

    override fun getName() = "CarinaVisionModule"

    @ReactMethod
    fun startCapture(fps: Int, promise: Promise) {
        if (isCapturing.get()) {
            promise.resolve(null)
            return
        }
        fpsPeriodMs = if (fps > 0) (1000L / fps) else 500L
        startBackgroundThread()
        openCamera(promise)
    }

    @ReactMethod
    fun stopCapture(promise: Promise) {
        isCapturing.set(false)
        captureSession?.close()
        cameraDevice?.close()
        imageReader?.close()
        stopBackgroundThread()
        promise.resolve(null)
    }

    @ReactMethod
    fun pauseCapture(promise: Promise) {
        isCapturing.set(false)
        promise.resolve(null)
    }

    @ReactMethod
    fun resumeCapture(promise: Promise) {
        isCapturing.set(true)
        promise.resolve(null)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @SuppressLint("MissingPermission")
    private fun openCamera(promise: Promise) {
        val manager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val cameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        } ?: run {
            promise.reject("NO_CAMERA", "No back camera found")
            return
        }

        imageReader = ImageReader.newInstance(640, 480, ImageFormat.JPEG, 2)
        imageReader?.setOnImageAvailableListener({ reader ->
            val now = System.currentTimeMillis()
            if (!isCapturing.get() || now - lastFrameTime < fpsPeriodMs) {
                reader.acquireLatestImage()?.close()
                return@setOnImageAvailableListener
            }
            lastFrameTime = now
            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val buffer = image.planes[0].buffer
                val bytes = ByteArray(buffer.remaining())
                buffer.get(bytes)
                val b64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                emitFrame(b64, now)
            } finally {
                image.close()
            }
        }, backgroundHandler)

        manager.openCamera(cameraId, object : CameraDevice.StateCallback() {
            override fun onOpened(camera: CameraDevice) {
                cameraDevice = camera
                createCaptureSession(promise)
            }
            override fun onDisconnected(camera: CameraDevice) {
                camera.close()
                isCapturing.set(false)
            }
            override fun onError(camera: CameraDevice, error: Int) {
                camera.close()
                promise.reject("CAMERA_ERROR", "Camera error: $error")
            }
        }, backgroundHandler)
    }

    private fun createCaptureSession(promise: Promise) {
        val surface = imageReader!!.surface
        cameraDevice?.createCaptureSession(
            listOf(surface),
            object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    captureSession = session
                    val request = cameraDevice!!
                        .createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                        .apply { addTarget(surface) }
                        .build()
                    session.setRepeatingRequest(request, null, backgroundHandler)
                    isCapturing.set(true)
                    promise.resolve(null)
                }
                override fun onConfigureFailed(session: CameraCaptureSession) {
                    promise.reject("SESSION_FAILED", "CaptureSession config failed")
                }
            }, backgroundHandler
        )
    }

    private fun emitFrame(base64Jpeg: String, timestamp: Long) {
        val params = Arguments.createMap().apply {
            putString("jpeg", base64Jpeg)
            putDouble("timestamp", timestamp.toDouble())
        }
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_FRAME, params)
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CarinaVisionThread").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        backgroundThread?.join()
        backgroundThread = null
        backgroundHandler = null
    }
}
```

### Step 2: iOS Camera Module

Create `carinaMobile/ios/Carina/CarinaVisionModule.swift`:

```swift
import Foundation
import AVFoundation
import React

@objc(CarinaVisionModule)
class CarinaVisionModule: RCTEventEmitter, AVCaptureVideoDataOutputSampleBufferDelegate {

    private var captureSession: AVCaptureSession?
    private var captureQueue = DispatchQueue(label: "com.carina.vision")
    private var isCapturing = false
    private var fpsPeriodMs: Double = 500
    private var lastFrameTime: Double = 0

    override static func requiresMainQueueSetup() -> Bool { false }

    override func supportedEvents() -> [String]! { ["vision_frame"] }

    @objc func startCapture(_ fps: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        fpsPeriodMs = fps > 0 ? (1000.0 / Double(fps)) : 500.0
        captureQueue.async {
            self.setupSession()
            self.isCapturing = true
            resolve(nil)
        }
    }

    @objc func stopCapture(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        isCapturing = false
        captureSession?.stopRunning()
        captureSession = nil
        resolve(nil)
    }

    @objc func pauseCapture(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        isCapturing = false
        resolve(nil)
    }

    @objc func resumeCapture(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        isCapturing = true
        resolve(nil)
    }

    private func setupSession() {
        let session = AVCaptureSession()
        session.sessionPreset = .vga640x480
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: device) else { return }
        session.addInput(input)

        let output = AVCaptureVideoDataOutput()
        output.setSampleBufferDelegate(self, queue: captureQueue)
        output.alwaysDiscardsLateVideoFrames = true
        session.addOutput(output)

        captureSession = session
        session.startRunning()
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard isCapturing else { return }
        let now = Date().timeIntervalSince1970 * 1000
        guard now - lastFrameTime >= fpsPeriodMs else { return }
        lastFrameTime = now

        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        let context = CIContext()
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else { return }
        let uiImage = UIImage(cgImage: cgImage)
        guard let jpegData = uiImage.jpegData(compressionQuality: 0.5) else { return }
        let b64 = jpegData.base64EncodedString()

        sendEvent(withName: "vision_frame", body: ["jpeg": b64, "timestamp": now])
    }
}
```

Create `carinaMobile/ios/Carina/CarinaVisionModule.m`:

```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CarinaVisionModule, RCTEventEmitter)
RCT_EXTERN_METHOD(startCapture:(int)fps resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopCapture:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(pauseCapture:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(resumeCapture:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
```

### Step 3: Android Activity Recognition

Create `carinaMobile/android/app/src/main/java/com/carina/CarinaMotionModule.kt`:

```kotlin
package com.carina

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.*

class CarinaMotionModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val EVENT_ACTIVITY = "activity_changed"
        const val ACTION_ACTIVITY = "com.carina.ACTIVITY_RESULT"
    }

    private var recognitionClient: ActivityRecognitionClient? = null
    private var pendingIntent: PendingIntent? = null

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (ActivityTransitionResult.hasResult(intent)) {
                val result = ActivityTransitionResult.extractResult(intent) ?: return
                for (event in result.transitionEvents) {
                    val type = when (event.activityType) {
                        DetectedActivity.WALKING -> "WALKING"
                        DetectedActivity.RUNNING -> "RUNNING"
                        DetectedActivity.STILL -> "STILL"
                        DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
                        DetectedActivity.ON_BICYCLE -> "ON_BICYCLE"
                        else -> "UNKNOWN"
                    }
                    val transition = if (event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) "ENTER" else "EXIT"
                    emitActivity(type, transition)
                }
            }
        }
    }

    override fun getName() = "CarinaMotionModule"

    @ReactMethod
    fun startRecognition(promise: Promise) {
        try {
            reactContext.registerReceiver(receiver, IntentFilter(ACTION_ACTIVITY))
            val intent = Intent(ACTION_ACTIVITY)
            pendingIntent = PendingIntent.getBroadcast(
                reactContext, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            val transitions = listOf(
                DetectedActivity.WALKING, DetectedActivity.RUNNING,
                DetectedActivity.STILL, DetectedActivity.IN_VEHICLE,
                DetectedActivity.ON_BICYCLE
            ).flatMap { type ->
                listOf(
                    ActivityTransition.Builder()
                        .setActivityType(type)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_ENTER)
                        .build(),
                    ActivityTransition.Builder()
                        .setActivityType(type)
                        .setActivityTransition(ActivityTransition.ACTIVITY_TRANSITION_EXIT)
                        .build()
                )
            }
            val request = ActivityTransitionRequest(transitions)
            recognitionClient = ActivityRecognition.getClient(reactContext)
            recognitionClient?.requestActivityTransitionUpdates(request, pendingIntent!!)
                ?.addOnSuccessListener { promise.resolve(null) }
                ?.addOnFailureListener { e -> promise.reject("ACTIVITY_ERROR", e.message) }
        } catch (e: Exception) {
            promise.reject("ACTIVITY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopRecognition(promise: Promise) {
        pendingIntent?.let { recognitionClient?.removeActivityTransitionUpdates(it) }
        try { reactContext.unregisterReceiver(receiver) } catch (_: Exception) {}
        promise.resolve(null)
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    private fun emitActivity(type: String, transition: String) {
        val params = Arguments.createMap().apply {
            putString("activity", type)
            putString("transition", transition)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_ACTIVITY, params)
    }
}
```

### Step 4: iOS Activity Recognition

Create `carinaMobile/ios/Carina/CarinaMotionModule.swift`:

```swift
import Foundation
import CoreMotion
import React

@objc(CarinaMotionModule)
class CarinaMotionModule: RCTEventEmitter {

    private let motionManager = CMMotionActivityManager()
    private let queue = OperationQueue()

    override static func requiresMainQueueSetup() -> Bool { false }
    override func supportedEvents() -> [String]! { ["activity_changed"] }

    @objc func startRecognition(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard CMMotionActivityManager.isActivityAvailable() else {
            reject("UNAVAILABLE", "Activity recognition not available", nil)
            return
        }
        motionManager.startActivityUpdates(to: queue) { [weak self] activity in
            guard let activity = activity else { return }
            let type: String
            if activity.running { type = "RUNNING" }
            else if activity.walking { type = "WALKING" }
            else if activity.cycling { type = "ON_BICYCLE" }
            else if activity.automotive { type = "IN_VEHICLE" }
            else if activity.stationary { type = "STILL" }
            else { type = "UNKNOWN" }
            self?.sendEvent(withName: "activity_changed", body: [
                "activity": type,
                "transition": "ENTER",
                "confidence": activity.confidence.rawValue,
                "timestamp": activity.startDate.timeIntervalSince1970 * 1000
            ])
        }
        resolve(nil)
    }

    @objc func stopRecognition(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        motionManager.stopActivityUpdates()
        resolve(nil)
    }
}
```

Create `carinaMobile/ios/Carina/CarinaMotionModule.m`:

```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CarinaMotionModule, RCTEventEmitter)
RCT_EXTERN_METHOD(startRecognition:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stopRecognition:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
```

### Step 5: TypeScript Vision Bridge

Create `carinaMobile/src/lib/camera-vision.ts`:

```typescript
import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

const NativeModule = Platform.OS === 'android'
  ? NativeModules.CarinaVisionModule
  : NativeModules.CarinaVisionModule;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

export interface VisionFrame {
  /** Base64-encoded JPEG */
  jpeg: string;
  timestamp: number;
}

export const CameraVision = {
  /**
   * Start frame capture at the given FPS (default 2).
   * Frames are emitted as base64 JPEG via onFrame.
   */
  async startCapture(fps = 2): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.startCapture(fps);
  },

  async stopCapture(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.stopCapture();
  },

  /** Pause frame emission without tearing down the camera session. */
  async pauseCapture(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.pauseCapture();
  },

  async resumeCapture(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.resumeCapture();
  },

  onFrame(handler: (frame: VisionFrame) => void): EmitterSubscription | null {
    return emitter?.addListener('vision_frame', handler) ?? null;
  },
};
```

### Step 6: TypeScript Activity Bridge

Create `carinaMobile/src/lib/motion-activity.ts`:

```typescript
import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

const NativeModule = Platform.OS === 'android'
  ? NativeModules.CarinaMotionModule
  : NativeModules.CarinaMotionModule;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

export type ActivityType = 'WALKING' | 'RUNNING' | 'STILL' | 'IN_VEHICLE' | 'ON_BICYCLE' | 'UNKNOWN';
export type TransitionType = 'ENTER' | 'EXIT';

export interface ActivityEvent {
  activity: ActivityType;
  transition: TransitionType;
  timestamp: number;
  confidence?: number;
}

export const MotionActivity = {
  async startRecognition(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.startRecognition();
  },

  async stopRecognition(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.stopRecognition();
  },

  onActivityChanged(handler: (event: ActivityEvent) => void): EmitterSubscription | null {
    return emitter?.addListener('activity_changed', handler) ?? null;
  },
};
```

### Step 7: React Hooks

Create `carinaMobile/src/hooks/useVisionCapture.ts`:

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CameraVision, VisionFrame } from '../lib/camera-vision';

interface UseVisionCaptureOptions {
  fps?: number;
  enabled?: boolean;
  onFrame: (frame: VisionFrame) => void;
}

/**
 * Manages camera frame capture lifecycle.
 * Automatically pauses when the app is backgrounded.
 */
export function useVisionCapture({ fps = 2, enabled = true, onFrame }: UseVisionCaptureOptions) {
  const isCapturing = useRef(false);
  const frameSubRef = useRef<ReturnType<typeof CameraVision.onFrame>>(null);

  const start = useCallback(async () => {
    if (isCapturing.current || !enabled) return;
    await CameraVision.startCapture(fps);
    frameSubRef.current = CameraVision.onFrame(onFrame);
    isCapturing.current = true;
  }, [fps, enabled, onFrame]);

  const stop = useCallback(async () => {
    if (!isCapturing.current) return;
    frameSubRef.current?.remove();
    await CameraVision.stopCapture();
    isCapturing.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    start();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        CameraVision.pauseCapture();
      } else if (state === 'active') {
        CameraVision.resumeCapture();
      }
    });

    return () => {
      sub.remove();
      stop();
    };
  }, [enabled, start, stop]);
}
```

Create `carinaMobile/src/hooks/useActivityMonitor.ts`:

```typescript
import { useEffect, useState, useRef } from 'react';
import { MotionActivity, ActivityEvent, ActivityType } from '../lib/motion-activity';

interface UseActivityMonitorResult {
  currentActivity: ActivityType | null;
  lastEvent: ActivityEvent | null;
}

/**
 * Subscribes to native activity recognition and exposes the current activity type.
 */
export function useActivityMonitor(enabled = true): UseActivityMonitorResult {
  const [currentActivity, setCurrentActivity] = useState<ActivityType | null>(null);
  const [lastEvent, setLastEvent] = useState<ActivityEvent | null>(null);
  const subRef = useRef<ReturnType<typeof MotionActivity.onActivityChanged>>(null);

  useEffect(() => {
    if (!enabled) return;

    MotionActivity.startRecognition().catch(console.warn);
    subRef.current = MotionActivity.onActivityChanged((event) => {
      setLastEvent(event);
      if (event.transition === 'ENTER') {
        setCurrentActivity(event.activity);
      }
    });

    return () => {
      subRef.current?.remove();
      MotionActivity.stopRecognition().catch(console.warn);
    };
  }, [enabled]);

  return { currentActivity, lastEvent };
}
```

### Step 8: AndroidManifest Additions

Add to `carinaMobile/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
```

Add to Info.plist:

```xml
<key>NSCameraUsageDescription</key>
<string>Carina uses the camera to provide visual context to the AI agent.</string>
<key>NSMotionUsageDescription</key>
<string>Carina uses motion data to understand your current activity context.</string>
```

### Step 9: Google Play Services Dependency

In `carinaMobile/android/app/build.gradle` add:

```groovy
implementation 'com.google.android.gms:play-services-location:21.2.0'
```

---

## Files to Create

- `carinaMobile/android/app/src/main/java/com/carina/CarinaVisionModule.kt`
- `carinaMobile/android/app/src/main/java/com/carina/CarinaMotionModule.kt`
- `carinaMobile/ios/Carina/CarinaVisionModule.swift`
- `carinaMobile/ios/Carina/CarinaVisionModule.m`
- `carinaMobile/ios/Carina/CarinaMotionModule.swift`
- `carinaMobile/ios/Carina/CarinaMotionModule.m`
- `carinaMobile/src/lib/camera-vision.ts`
- `carinaMobile/src/lib/motion-activity.ts`
- `carinaMobile/src/hooks/useVisionCapture.ts`
- `carinaMobile/src/hooks/useActivityMonitor.ts`

## Files to Modify

- `carinaMobile/android/app/src/main/AndroidManifest.xml` - CAMERA + ACTIVITY_RECOGNITION
- `carinaMobile/android/app/build.gradle` - Google Play Services location
- `carinaMobile/android/app/src/main/java/com/carina/MainApplication.kt` - register both modules
- `carinaMobile/ios/Carina/Info.plist` - camera + motion usage descriptions

---

## Done-When Criteria

- [ ] Android: `useVisionCapture({ fps: 2, onFrame: console.log })` logs base64 JPEG
      objects every ~500ms on a device (not simulator) with camera access granted.
- [ ] Android: `useActivityMonitor()` returns `currentActivity: "WALKING"` when the
      device is physically walked around.
- [ ] iOS: same tests pass on a real device (Simulator does not have camera or motion).
- [ ] Frames pause when app is backgrounded (AppState change triggers `pauseCapture`).
- [ ] No memory leaks: start/stop cycles do not accumulate objects (check with
      Android Studio profiler or Instruments).
- [ ] All four native modules registered in MainApplication.kt without duplicates.
- [ ] TypeScript compiles with `tsc --noEmit` in carinaMobile/ without errors.
