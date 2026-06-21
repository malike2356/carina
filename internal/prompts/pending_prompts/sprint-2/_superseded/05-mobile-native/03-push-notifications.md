# Prompt 03: Push Notifications (FCM + APNs)


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Carina needs to reach the user when the app is closed. Push notifications wake the app for
high-urgency events: Scout critical alerts, pending tool approvals, morning briefings, and
proactive outreach when Carina has something to report.

## What to Build

### 1. Install expo-notifications

```bash
cd carinaMobile
npx expo install expo-notifications expo-device
```

### 2. Permission and token registration

In `carinaMobile/src/services/PushNotifications.ts`:
```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators don't get push tokens

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  // Send token to Carina server
  await fetch('/api/push/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.data }),
  });

  return token.data;
}
```

### 3. Push token API in Carina core

In `src/api/push.ts`:
```typescript
// POST /api/push/register - stores device token for user's session
// POST /api/push/send - ops-gated; sends push to a user
// DELETE /api/push/token - unregisters device token
```

Store tokens in `push_tokens` table:
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,  -- 'expo', 'fcm', 'apns'
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used TIMESTAMPTZ
);
```

### 4. Send push notifications from core

Use Expo's Push API for cross-platform delivery:
```typescript
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPush(token: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (!Expo.isExpoPushToken(token)) return;

  await expo.sendPushNotificationsAsync([{
    to: token,
    title,
    body,
    data,
    priority: 'high',
    sound: 'default',
  }]);
}
```

### 5. Notification types and deep links

| Event | Title | Body | Data |
|-------|-------|------|------|
| Scout critical alert | "Scout Alert" | "Critical finding on example.com" | `{ screen: 'scout', alertId }` |
| Tool approval required | "Approval needed" | "Carina wants to delete /tmp/test" | `{ screen: 'approvals', toolCall }` |
| Morning briefing | "Good morning" | "3 things to know this morning" | `{ screen: 'briefing' }` |
| Voicemail | "New voicemail" | "Tom (NOC): unusual traffic..." | `{ screen: 'voicemail', id }` |

### 6. Notification tap handler

```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const data = response.notification.request.content.data;
  if (data.screen === 'scout') navigation.navigate('Scout', { alertId: data.alertId });
  if (data.screen === 'approvals') navigation.navigate('Approvals', { toolCall: data.toolCall });
});
```

### 7. Silent push for WebSocket reconnect

When the gateway has a message and the WebSocket is disconnected, it sends a silent push:
```typescript
await expo.sendPushNotificationsAsync([{
  to: token,
  _contentAvailable: true,  // silent push on iOS
  priority: 'high',
  data: { type: 'reconnect' },
}]);
```

The app receives the silent push in the background, the `BackgroundTaskManager` (from
Prompt 01) reconnects the WebSocket.

## Verification Checklist

- [ ] App prompts for notification permission on first launch
- [ ] Token is registered with Carina server (visible in ops panel)
- [ ] Close app, trigger a Scout alert from ops panel - notification appears
- [ ] Tap notification - app opens to the Scout screen
- [ ] Silent push reconnects the WebSocket (visible in server logs)

## Files to Create or Modify

- CREATE `carinaMobile/src/services/PushNotifications.ts`
- CREATE `src/api/push.ts` (Carina core)
- MODIFY `src/server.ts` - mount push API routes
- MODIFY `carinaMobile/src/App.tsx` - call registerForPushNotifications on startup
- MODIFY `carinaMobile/src/navigation/index.tsx` - handle notification tap deep links
