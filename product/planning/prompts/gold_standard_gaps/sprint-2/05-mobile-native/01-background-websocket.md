# Prompt 01: Background WebSocket Service

## Context

The `carinaMobile/` React Native app (121 files) has an API client but the WebSocket
connection drops when the app is backgrounded. Voice and push notification features depend
on a persistent WebSocket connection. This prompt builds the background service layer.

## What to Build

### 1. Android foreground service

Create `carinaMobile/android/app/src/main/java/uk/carinaai/mobile/CarinaService.kt`:
```kotlin
import android.app.ForegroundServiceStartNotAllowedException
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

class CarinaService : Service() {
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val channel = NotificationChannel(
      "carina_service", "Carina Agent", NotificationManager.IMPORTANCE_LOW
    )
    (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)

    val notification = Notification.Builder(this, "carina_service")
      .setContentTitle("Carina is running")
      .setSmallIcon(R.drawable.ic_carina)
      .build()

    startForeground(1, notification)
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
```

Register in `AndroidManifest.xml`:
```xml
<service
  android:name=".CarinaService"
  android:foregroundServiceType="connectedDevice"
  android:exported="false" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
```

### 2. iOS background keepalive

Create `carinaMobile/ios/CarinaApp/BackgroundTaskManager.swift`:
```swift
import BackgroundTasks

class BackgroundTaskManager {
  static let taskId = "uk.carinaai.mobile.keepalive"

  static func register() {
    BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
      Self.handleKeepalive(task: task as! BGProcessingTask)
    }
  }

  static func schedule() {
    let request = BGProcessingTaskRequest(identifier: taskId)
    request.requiresNetworkConnectivity = true
    request.earliestBeginDate = Date(timeIntervalSinceNow: 60)
    try? BGTaskScheduler.shared.submit(request)
  }

  private static func handleKeepalive(task: BGProcessingTask) {
    // Ping Carina server to maintain session
    WebSocketManager.shared.ping()
    schedule()
    task.setTaskCompleted(success: true)
  }
}
```

### 3. WebSocket connection manager (JS/TS side)

Create `carinaMobile/src/services/WebSocketManager.ts`:
```typescript
type MessageHandler = (message: unknown) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string = '';
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectDelay = 1000;
  private maxDelay = 30000;

  connect(url: string): void {
    this.url = url;
    this.reconnect();
  }

  private reconnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.emit('connected', null);
    };

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      this.emit(msg.type, msg);
    };

    this.ws.onclose = () => {
      this.emit('disconnected', null);
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
        this.reconnect();
      }, this.reconnectDelay);
    };
  }

  send(type: string, payload: unknown): void {
    this.ws?.send(JSON.stringify({ type, ...payload as object }));
  }

  on(type: string, handler: MessageHandler): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
    return () => this.handlers.set(type, list.filter(h => h !== handler));
  }

  private emit(type: string, data: unknown): void {
    this.handlers.get(type)?.forEach(h => h(data));
  }
}

export const wsManager = new WebSocketManager();
```

### 4. Network change detection

```typescript
import NetInfo from '@react-native-community/netinfo';

NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable) {
    wsManager.connect(CARINA_WS_URL);
  }
});
```

## Verification Checklist

- [ ] Background the app on Android - persistent notification "Carina is running" appears
- [ ] Kill app on Android - service restarts via START_STICKY after 5 seconds
- [ ] Disconnect WiFi and reconnect - WebSocket reconnects with exponential backoff
- [ ] Reconnect delay maxes at 30 seconds (no faster reconnect storm)
- [ ] `wsManager.on('message', ...)` receives messages while app is active

## Files to Create or Modify

- CREATE `carinaMobile/android/app/src/.../CarinaService.kt`
- MODIFY `carinaMobile/android/app/src/main/AndroidManifest.xml`
- CREATE `carinaMobile/ios/CarinaApp/BackgroundTaskManager.swift`
- CREATE `carinaMobile/src/services/WebSocketManager.ts`
- MODIFY `carinaMobile/src/App.tsx` - connect WebSocketManager on startup
