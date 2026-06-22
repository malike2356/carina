# Gap 03 - Prompt 03: SMS, Call Log, and Notification Relay

**Status: COMPLETED 2026-06-22**

**What was built:**
- Android SMS relay: `SmsReceiver.kt`, `SmsRelayManager.kt`, `SmsRelayModule.kt`
- Android call log relay: `CallLogRelay.kt`, `CallLogCheckWorker.kt`, `CallLogRelayScheduler.kt`
- iOS notification relay: `NotificationRelayManager.swift`, `NotificationRelayModule.swift`, `CarinaNotificationService/NotificationService.swift`
- JS layer: `src/lib/message-relay.ts`, `src/lib/relay-redaction.ts`, `src/hooks/useRelaySettings.ts`, `app/privacy-relay.tsx`
- Expo plugins: `plugins/withSmsRelay.js`, wired in `app.config.ts`
- Navigation: Message relay entry in `app/(tabs)/more/index.tsx`
- Tests: `message-relay.test.ts`, `relay-redaction.test.ts`

**Agent:** Codex (fallback: Cursor)
**Estimated hours:** 5-6 hrs
**Depends on:** 01-background-connection.md done (connection service running)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

```
carinaMobile/
  src/services/CarinaConnectionService.ts     (from 01)
  src/api/                                    (existing API client)
  android/app/src/main/java/                  (native Android modules)
  ios/CarinaAI/                               (native iOS source)
core.carinaai.uk/src/channels/               (inbound channel routing)
core.carinaai.uk/src/security/               (privacy/tool approval layer)
```

---

## Context

Carina can respond to messages from Telegram, Discord, Slack, and email already. This gap adds the mobile device itself as a channel: SMS messages and incoming calls can be forwarded to the Carina agent, and notifications from other apps can be optionally relayed. All of this requires explicit user consent and per-source privacy controls.

The key constraint: all relay is opt-in, per-sender configurable, and always shows a privacy confirmation before first use.

---

## What to Build

### Part A: Android SMS/Call Relay

#### 1. Native Android SMS Receiver

File: `android/app/src/main/java/ai/carina/mobile/SmsReceiver.kt`

```kotlin
package ai.carina.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        for (message in messages) {
            val sender = message.displayOriginatingAddress
            val body = message.messageBody
            val timestamp = message.timestampMillis

            SmsRelayManager.getInstance(context).onSmsReceived(
                sender = sender,
                body = body,
                timestamp = timestamp,
            )
        }
    }
}
```

Register in `AndroidManifest.xml`:
```xml
<receiver android:name=".SmsReceiver"
          android:permission="android.permission.BROADCAST_SMS"
          android:exported="true">
    <intent-filter android:priority="999">
        <action android:name="android.provider.Telephony.SMS_RECEIVED" />
    </intent-filter>
</receiver>

<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
```

#### 2. SMS Relay Manager

File: `android/app/src/main/java/ai/carina/mobile/SmsRelayManager.kt`

```kotlin
// Singleton responsible for filtering, consenting, and sending to Carina

class SmsRelayManager private constructor(private val context: Context) {

    private val prefs = context.getSharedPreferences("sms_relay_prefs", Context.MODE_PRIVATE)
    private val connectionService = CarinaConnectionService.getInstance(context)

    // Allowed senders: stored in prefs as JSON set
    // An empty set means "nothing relayed" (default)
    // Value "ALL" means relay from all senders (explicit user choice)

    fun onSmsReceived(sender: String, body: String, timestamp: Long) {
        if (!isRelayEnabled()) return
        if (!isSenderAllowed(sender)) return
        if (!isWithinPrivacyHours()) return  // optional: only relay during set hours

        val redacted = applyRedaction(body)
        connectionService.sendInboundEvent(
            type = "sms",
            source = sender,
            content = redacted,
            timestamp = timestamp,
        )
    }

    fun isRelayEnabled(): Boolean = prefs.getBoolean("enabled", false)

    fun isSenderAllowed(sender: String): Boolean {
        val allowed = prefs.getStringSet("allowed_senders", emptySet()) ?: return false
        return "ALL" in allowed || sender in allowed
    }

    // Privacy: strip payment card numbers, PINs (simple heuristic regex)
    private fun applyRedaction(text: String): String {
        return text
            .replace(Regex("""\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"""), "[CARD_REDACTED]")
            .replace(Regex("""\bPIN[:\s]+\d{4,6}\b""", RegexOption.IGNORE_CASE), "[PIN_REDACTED]")
            .replace(Regex("""\bpassword[:\s]+\S+""", RegexOption.IGNORE_CASE), "[PASSWORD_REDACTED]")
    }

    private fun isWithinPrivacyHours(): Boolean {
        val startHour = prefs.getInt("privacy_start_hour", 7)
        val endHour = prefs.getInt("privacy_end_hour", 22)
        val current = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return current in startHour..endHour
    }

    companion object {
        @Volatile private var instance: SmsRelayManager? = null
        fun getInstance(context: Context) = instance ?: synchronized(this) {
            instance ?: SmsRelayManager(context.applicationContext).also { instance = it }
        }
    }
}
```

#### 3. Call Log Relay

File: `android/app/src/main/java/ai/carina/mobile/CallLogRelay.kt`

```kotlin
// Polls CallLog.Calls provider on a schedule (not real-time - requires PROCESS_OUTGOING_CALLS which is deprecated)
// Schedule: check every 30 minutes for missed calls, surface to Carina

class CallLogRelay(private val context: Context) {

    fun checkMissedCalls() {
        if (!isCallRelayEnabled()) return

        val projection = arrayOf(
            CallLog.Calls.NUMBER,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
        )
        val selection = "${CallLog.Calls.TYPE} = ? AND ${CallLog.Calls.DATE} > ?"
        val args = arrayOf(
            CallLog.Calls.MISSED_TYPE.toString(),
            lastCheckedTimestamp().toString(),
        )

        context.contentResolver.query(
            CallLog.Calls.CONTENT_URI, projection, selection, args,
            "${CallLog.Calls.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val number = cursor.getString(0) ?: return@use
                val date = cursor.getLong(2)
                CarinaConnectionService.getInstance(context).sendInboundEvent(
                    type = "missed_call",
                    source = number,
                    content = "Missed call",
                    timestamp = date,
                )
            }
        }
        saveLastCheckedTimestamp()
    }

    private fun isCallRelayEnabled(): Boolean =
        context.getSharedPreferences("call_relay_prefs", Context.MODE_PRIVATE)
            .getBoolean("enabled", false)

    private fun lastCheckedTimestamp(): Long =
        context.getSharedPreferences("call_relay_prefs", Context.MODE_PRIVATE)
            .getLong("last_checked", System.currentTimeMillis() - 3600_000)

    private fun saveLastCheckedTimestamp() {
        context.getSharedPreferences("call_relay_prefs", Context.MODE_PRIVATE)
            .edit().putLong("last_checked", System.currentTimeMillis()).apply()
    }
}
```

---

### Part B: iOS Notification Relay (NotificationServiceExtension)

iOS does not allow reading SMS directly. The relay is limited to push notifications from other apps via a Notification Service Extension.

File: `ios/CarinaNotificationService/NotificationService.swift`

```swift
import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)
        
        guard let content = bestAttemptContent else {
            contentHandler(request.content)
            return
        }
        
        // Check if relay is enabled and this source is allowed
        let relay = NotificationRelayManager.shared
        guard relay.isEnabled,
              relay.isSourceAllowed(content.categoryIdentifier) else {
            contentHandler(content)
            return
        }
        
        // Forward to Carina in background
        relay.forwardToCarinana(
            title: content.title,
            body: content.body,
            source: content.categoryIdentifier,
        )
        
        contentHandler(content)
    }
}
```

File: `ios/CarinaAI/NotificationRelayManager.swift`

```swift
import Foundation

class NotificationRelayManager {
    
    static let shared = NotificationRelayManager()
    private let defaults = UserDefaults(suiteName: "group.ai.carina.mobile")!
    
    var isEnabled: Bool {
        get { defaults.bool(forKey: "notif_relay_enabled") }
        set { defaults.set(newValue, forKey: "notif_relay_enabled") }
    }
    
    var allowedSources: Set<String> {
        get { Set(defaults.stringArray(forKey: "notif_relay_sources") ?? []) }
        set { defaults.set(Array(newValue), forKey: "notif_relay_sources") }
    }
    
    func isSourceAllowed(_ source: String) -> Bool {
        return allowedSources.contains("ALL") || allowedSources.contains(source)
    }
    
    func forwardToCarina(title: String, body: String, source: String) {
        guard let apiUrl = defaults.string(forKey: "carina_api_url"),
              let url = URL(string: "\(apiUrl)/api/mobile/inbound") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(defaults.string(forKey: "device_token") ?? "", forHTTPHeaderField: "X-Device-Token")
        
        let payload: [String: Any] = [
            "type": "notification",
            "source": source,
            "title": title,
            "body": applyRedaction(body),
            "timestamp": Date().timeIntervalSince1970,
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        
        URLSession.shared.dataTask(with: request).resume()
    }
    
    private func applyRedaction(_ text: String) -> String {
        var result = text
        let patterns = [
            (#"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"#, "[CARD_REDACTED]"),
            (#"(?i)pin[:\s]+\d{4,6}"#, "[PIN_REDACTED]"),
            (#"(?i)password[:\s]+\S+"#, "[PASSWORD_REDACTED]"),
        ]
        for (pattern, replacement) in patterns {
            result = result.replacingOccurrences(
                of: pattern, with: replacement,
                options: .regularExpression
            )
        }
        return result
    }
}
```

---

### Part C: React Native Privacy Settings Screen

File: `src/screens/PrivacyRelayScreen.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, NativeModules, Platform, ScrollView } from 'react-native';

export function PrivacyRelayScreen() {
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [callEnabled, setCallEnabled] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function requestAndroidPermissions() {
    const { PermissionsAndroid } = require('react-native');
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
    ]);
    const allGranted = Object.values(granted).every(
      v => v === PermissionsAndroid.RESULTS.GRANTED
    );
    setHasPermissions(allGranted);
    return allGranted;
  }

  async function toggleSmsRelay(value: boolean) {
    if (value && Platform.OS === 'android') {
      const granted = await requestAndroidPermissions();
      if (!granted) return;
    }
    setSmsEnabled(value);
    NativeModules.SmsRelayModule?.setEnabled(value);
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>
        Message Relay
      </Text>
      <Text style={{ color: '#888', marginBottom: 24 }}>
        Allow Carina to receive messages from your device. All relay is
        opt-in. Sensitive content is automatically redacted before sending.
      </Text>

      {/* SMS Relay (Android only) */}
      {Platform.OS === 'android' && (
        <SettingRow
          title="SMS Relay"
          description="Forward incoming SMS messages to Carina"
          value={smsEnabled}
          onToggle={toggleSmsRelay}
        />
      )}

      {/* Call Log (Android only) */}
      {Platform.OS === 'android' && (
        <SettingRow
          title="Missed Call Alerts"
          description="Notify Carina when you miss a call"
          value={callEnabled}
          onToggle={setCallEnabled}
        />
      )}

      {/* Notification Relay */}
      <SettingRow
        title="Notification Relay"
        description={Platform.OS === 'ios'
          ? "Forward app notifications to Carina (requires notification extension)"
          : "Forward app notifications to Carina"}
        value={notifEnabled}
        onToggle={setNotifEnabled}
      />

      {/* Privacy Hours */}
      <View style={{ marginTop: 24, padding: 16, backgroundColor: '#1a1a2e', borderRadius: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 8 }}>
          Privacy Hours
        </Text>
        <Text style={{ color: '#888', fontSize: 12 }}>
          Only relay messages between 07:00 and 22:00. Outside these hours,
          messages are queued and delivered when privacy hours resume.
        </Text>
        {/* Hour pickers would go here */}
      </View>

      {/* Allowed Senders */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ color: '#fff', fontWeight: '600', marginBottom: 8 }}>
          Allowed Senders
        </Text>
        <Text style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
          Only messages from these contacts are forwarded to Carina.
          Leave empty to block all relay.
        </Text>
        {/* Contact picker list goes here */}
      </View>
    </ScrollView>
  );
}
```

---

### Part D: Expo Config Plugin (Android Manifest wiring)

File: `plugins/withSmsRelay.js`

```javascript
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withSmsRelay(config) {
  return withAndroidManifest(config, async (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application[0];

    // Add receiver
    if (!app.receiver) app.receiver = [];
    app.receiver.push({
      $: {
        'android:name': '.SmsReceiver',
        'android:permission': 'android.permission.BROADCAST_SMS',
        'android:exported': 'true',
      },
      'intent-filter': [{
        $: { 'android:priority': '999' },
        action: [{ $: { 'android:name': 'android.provider.Telephony.SMS_RECEIVED' } }],
      }],
    });

    return cfg;
  });
};
```

Register in `app.config.js`:
```javascript
plugins: [
  './plugins/withSmsRelay',
  ...
]
```

---

## Files to Create

```
carinaMobile/
├── android/app/src/main/java/ai/carina/mobile/
│   ├── SmsReceiver.kt
│   ├── SmsRelayManager.kt
│   └── CallLogRelay.kt
├── ios/CarinaNotificationService/
│   └── NotificationService.swift          (new Notification Service Extension target)
├── ios/CarinaAI/
│   └── NotificationRelayManager.swift
├── src/screens/
│   └── PrivacyRelayScreen.tsx
└── plugins/
    └── withSmsRelay.js
```

## Files to Modify

```
android/app/src/main/AndroidManifest.xml   → receiver + permissions
app.config.js                              → add withSmsRelay plugin
src/navigation/                            → add Privacy Relay to settings nav tree
```

---

## Done When

- [ ] Android: sending an SMS to the test device relays the message to Carina agent within 5 seconds
- [ ] Android: a missed call appears in Carina as a "missed_call" inbound event within 30 minutes
- [ ] iOS: a notification from a test app (e.g. WhatsApp) is forwarded to Carina via the extension
- [ ] Privacy hours: messages received outside configured hours are not forwarded
- [ ] Allowed senders: adding a sender to the allow list relays their messages; others are blocked
- [ ] Redaction: sending a test SMS containing "PIN: 1234" shows "[PIN_REDACTED]" in Carina
- [ ] PrivacyRelayScreen shows correct toggle state after app restart (settings persisted)
- [ ] Permission denial on Android shows a clear explanation screen (not a crash)
