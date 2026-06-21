# Prompt 05: SMS and Call Relay


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The PSTN telephony layer (voice agent phase 5) uses Twilio to give Carina a phone number.
Before that is built, a lighter-weight SMS relay can be implemented on mobile: the user
grants Carina permission to read incoming SMS messages, and Carina processes them as
context (e.g., "forward any SMS about security alerts to me as chat messages").

Call relay is similar: incoming call metadata (caller ID, timestamp) can be sent to Carina
for logging or triggering workflows.

NOTE: iOS does not allow SMS read access. This feature is Android-only.

## What to Build

### 1. Android SMS receiver

Create `carinaMobile/android/app/src/.../SmsReceiver.kt`:
```kotlin
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    for (sms in messages) {
      val sender = sms.displayOriginatingAddress
      val body = sms.messageBody
      // Forward to React Native via event emitter
      SmsModule.sendEvent(context, mapOf("sender" to sender, "body" to body))
    }
  }
}
```

Register in `AndroidManifest.xml`:
```xml
<receiver android:name=".SmsReceiver" android:exported="true">
  <intent-filter android:priority="1000">
    <action android:name="android.provider.Telephony.SMS_RECEIVED" />
  </intent-filter>
</receiver>
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
```

### 2. React Native bridge

Create `carinaMobile/src/services/SmsRelay.ts`:
```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';

export function startSmsRelay(
  sessionId: string,
  filter?: (sender: string, body: string) => boolean
): () => void {
  const emitter = new NativeEventEmitter(NativeModules.SmsModule);

  const subscription = emitter.addListener('sms.received', (sms: { sender: string; body: string }) => {
    if (filter && !filter(sms.sender, sms.body)) return;

    wsManager.send('context.sms', {
      sessionId,
      from: sms.sender,
      body: sms.body,
      timestamp: new Date().toISOString(),
    });
  });

  return () => subscription.remove();
}
```

### 3. User-configurable filters

In Settings -> SMS Relay:
- Enable/disable SMS relay (toggle)
- Filter by keywords: only relay SMS containing "alert", "OTP", "security", "payment"
- Filter by sender: allowlist of phone numbers or short codes
- "Show relay log": list of SMS messages forwarded to Carina in the last 7 days

### 4. Call logging (Android)

Android allows reading call logs with `READ_CALL_LOG` permission:
```typescript
// Log missed calls and send summary to Carina
const missedCalls = await readCallLog({ type: 'missed', since: lastCheck });
if (missedCalls.length > 0) {
  wsManager.send('context.calls', { sessionId, calls: missedCalls });
}
```

Carina uses this to proactively surface: "You missed 2 calls from +44 7911 123456.
Want me to look up who that is?"

### 5. iOS alternative: clipboard monitoring

Since iOS blocks SMS access, offer clipboard monitoring as an alternative:
"When you copy a text message or SMS content, Carina can process it."

```typescript
import * as Clipboard from 'expo-clipboard';

// Check clipboard every 3 seconds when app is in foreground
const interval = setInterval(async () => {
  const content = await Clipboard.getStringAsync();
  if (content && content !== lastClipboard) {
    lastClipboard = content;
    // Show "Send to Carina?" prompt
  }
}, 3000);
```

## Verification Checklist

- [ ] Android: receive an SMS while relay is enabled - appears as context message in Carina chat
- [ ] Keyword filter blocks SMS not matching filter words
- [ ] Settings screen shows relay toggle and keyword filter list
- [ ] Disable relay - subsequent SMS not forwarded
- [ ] iOS: clipboard monitoring shows "Send to Carina?" prompt when text is copied

## Files to Create or Modify

- CREATE `carinaMobile/android/app/src/.../SmsReceiver.kt`
- CREATE `carinaMobile/android/app/src/.../SmsModule.kt`
- MODIFY `carinaMobile/android/app/src/main/AndroidManifest.xml`
- CREATE `carinaMobile/src/services/SmsRelay.ts`
- MODIFY `carinaMobile/src/screens/SettingsScreen.tsx` - add SMS relay settings
