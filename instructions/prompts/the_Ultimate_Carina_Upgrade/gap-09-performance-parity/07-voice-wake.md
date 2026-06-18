# Gap 09 - Prompt 07: Voice Wake Words

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Codex (native modules) + Cursor (React Native screens)
**Estimated hours:** 5-6 hrs
**Depends on:** carinaMobile app running; existing TTS setup if any

---

## The Problem

OpenClaw ships voice wake word detection on macOS/iOS and continuous voice input on Android.
Carina has no voice wake capability at all. `subagent-push-wake.ts` in the core is about
push notification wake (different concept - that wakes subagents, not the UI from voice).

Voice wake means the user can say "Hey Carina" without touching the phone or desktop. The
app listens passively in the background, detects the keyword, then captures the follow-up
request and sends it to the agent.

This is a major UX gap for mobile, especially for hands-free property viewing use cases.

---

## Read First

```
carinaMobile/                                    (Expo React Native app root)
carinaMobile/app/                                (Expo Router screens)
carinaMobile/src/                                (source)
carinaMobile/package.json                        (existing packages)
carinaMobile/app.config.js or app.json          (Expo config)
core.carinaai.uk/src/gateway/channels/          (channel adapters - voice may plug in here)
```

---

## Architecture Overview

```
Platform            Library              Wake Trigger          Capture
--------            -------              ------------          -------
iOS/macOS           @picovoice/porcupine  "Hey Carina" keyword  SFSpeechRecognizer
Android             @picovoice/porcupine  "Hey Carina" keyword  SpeechRecognizer (continuous)
Fallback (all)      Button press only     N/A                   react-native-voice
```

Porcupine is the industry standard for on-device wake word detection. It runs entirely locally,
no audio ever leaves the device. The wake word model file is bundled in the app.

---

## 1. Install Packages

```bash
# In carinaMobile/
npx expo install @picovoice/porcupine-react-native
npx expo install @react-native-voice/voice
npx expo install expo-av
npx expo install expo-speech
```

---

## 2. Expo Config Plugin

```javascript
// carinaMobile/plugins/withVoiceWake.js  (new file)

const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

module.exports = (config) => {
  // iOS: add microphone usage description
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSMicrophoneUsageDescription =
      'Carina listens for the wake word "Hey Carina" to enable hands-free assistance.';
    cfg.modResults.NSSpeechRecognitionUsageDescription =
      'Carina converts your voice to text for hands-free queries.';
    return cfg;
  });

  // Android: add RECORD_AUDIO permission
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = manifest['uses-permission'] ?? [];
    const needed = [
      'android.permission.RECORD_AUDIO',
      'android.permission.INTERNET',
    ];
    for (const perm of needed) {
      if (!permissions.find((p) => p.$['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }
    manifest['uses-permission'] = permissions;
    return cfg;
  });

  return config;
};
```

Add to `app.config.js`:
```javascript
plugins: [
  './plugins/withVoiceWake',
  // ... other plugins
]
```

---

## 3. Wake Word Engine Hook

```typescript
// carinaMobile/src/hooks/useVoiceWake.ts  (new file)

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import PorcupineManager from '@picovoice/porcupine-react-native';

// Picovoice access key (add to carinaMobile/.env as EXPO_PUBLIC_PICOVOICE_KEY)
const PICOVOICE_ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_KEY ?? '';

// Built-in keyword: 'hey carina' or closest built-in like 'hey siri' as placeholder
// In production: train a custom keyword model at picovoice.ai and bundle the .ppn file
const WAKE_KEYWORD = 'computer'; // use built-in for dev; swap for custom .ppn in prod

export interface VoiceWakeState {
  isListening: boolean;
  isWoken: boolean;
  error: string | null;
  wakeCount: number;
}

export function useVoiceWake(opts: {
  enabled: boolean;
  onWake: () => void;
  privacyHoursStart?: number; // hour 0-23 to stop listening (e.g. 22 = 10pm)
  privacyHoursEnd?: number; // hour 0-23 to resume listening (e.g. 7 = 7am)
}) {
  const [state, setState] = useState<VoiceWakeState>({
    isListening: false,
    isWoken: false,
    error: null,
    wakeCount: 0,
  });
  const porcupineRef = useRef<PorcupineManager | null>(null);

  const isPrivacyHour = useCallback((): boolean => {
    if (opts.privacyHoursStart == null || opts.privacyHoursEnd == null) return false;
    const hour = new Date().getHours();
    if (opts.privacyHoursStart > opts.privacyHoursEnd) {
      // Overnight window: e.g. 22-7
      return hour >= opts.privacyHoursStart || hour < opts.privacyHoursEnd;
    }
    return hour >= opts.privacyHoursStart && hour < opts.privacyHoursEnd;
  }, [opts.privacyHoursStart, opts.privacyHoursEnd]);

  const startListening = useCallback(async () => {
    if (!opts.enabled || !PICOVOICE_ACCESS_KEY) return;
    if (isPrivacyHour()) return;

    try {
      const manager = await PorcupineManager.fromBuiltInKeywords(
        PICOVOICE_ACCESS_KEY,
        [WAKE_KEYWORD],
        (keywordIndex) => {
          if (keywordIndex === 0) {
            setState(prev => ({ ...prev, isWoken: true, wakeCount: prev.wakeCount + 1 }));
            opts.onWake();
          }
        },
        (error) => {
          setState(prev => ({ ...prev, error: String(error) }));
        }
      );

      await manager.start();
      porcupineRef.current = manager;
      setState(prev => ({ ...prev, isListening: true, error: null }));
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message ?? String(err) }));
    }
  }, [opts.enabled, isPrivacyHour, opts.onWake]);

  const stopListening = useCallback(async () => {
    if (porcupineRef.current) {
      await porcupineRef.current.stop();
      await porcupineRef.current.delete();
      porcupineRef.current = null;
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // Start/stop based on enabled and app state
  useEffect(() => {
    if (opts.enabled) {
      startListening();
    } else {
      stopListening();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && opts.enabled && !porcupineRef.current) {
        startListening();
      } else if (nextState === 'background') {
        // Keep listening in background on Android
        if (Platform.OS === 'ios') stopListening();
      }
    });

    return () => {
      sub.remove();
      stopListening();
    };
  }, [opts.enabled]);

  return { ...state, startListening, stopListening };
}
```

---

## 4. Voice Capture Hook (after wake)

```typescript
// carinaMobile/src/hooks/useVoiceCapture.ts  (new file)

import { useState, useCallback } from 'react';
import Voice from '@react-native-voice/voice';

export function useVoiceCapture() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCapture = useCallback(async () => {
    try {
      await Voice.start('en-GB');
      setIsRecording(true);
      setTranscript('');
      setError(null);

      Voice.onSpeechResults = (e) => {
        const text = e.value?.[0] ?? '';
        setTranscript(text);
      };

      Voice.onSpeechEnd = () => {
        setIsRecording(false);
      };

      Voice.onSpeechError = (e) => {
        setError(e.error?.message ?? 'Voice capture error');
        setIsRecording(false);
      };
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const stopCapture = useCallback(async () => {
    await Voice.stop();
    Voice.destroy();
    setIsRecording(false);
  }, []);

  return { transcript, isRecording, error, startCapture, stopCapture };
}
```

---

## 5. Voice Wake Screen

```tsx
// carinaMobile/src/screens/VoiceWakeScreen.tsx  (new file)

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';
import { useVoiceWake } from '../hooks/useVoiceWake';
import { useVoiceCapture } from '../hooks/useVoiceCapture';
import { sendMessageToAgent } from '../api/agent';

export function VoiceWakeScreen() {
  const [captureMode, setCaptureMode] = useState(false);
  const pulseAnim = new Animated.Value(1);

  const { isListening, isWoken, wakeCount, error: wakeError } = useVoiceWake({
    enabled: true,
    privacyHoursStart: 22,  // 10pm
    privacyHoursEnd: 7,     // 7am
    onWake: () => {
      setCaptureMode(true);
      startCapture();
    },
  });

  const { transcript, isRecording, stopCapture, startCapture } = useVoiceCapture();

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  async function handleSend() {
    if (!transcript) return;
    await stopCapture();
    setCaptureMode(false);
    await sendMessageToAgent(transcript);
  }

  if (captureMode) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.orb, { transform: [{ scale: pulseAnim }] }]} />
        <Text style={styles.transcript}>{transcript || 'Listening...'}</Text>
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => { stopCapture(); setCaptureMode(false); }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.orb, isListening && styles.orbListening]} />
      <Text style={styles.label}>
        {isListening ? 'Say "Hey Carina"' : 'Wake word disabled'}
      </Text>
      {wakeError && <Text style={styles.error}>{wakeError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a' },
  orb: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1a1a2e' },
  orbListening: { backgroundColor: '#0d3b6e' },
  label: { color: '#888', marginTop: 24, fontSize: 16 },
  transcript: { color: '#fff', fontSize: 18, textAlign: 'center', paddingHorizontal: 32, marginTop: 32 },
  sendButton: { marginTop: 24, backgroundColor: '#0a84ff', padding: 16, borderRadius: 12 },
  sendText: { color: '#fff', fontSize: 16 },
  cancelButton: { marginTop: 12, padding: 16 },
  cancelText: { color: '#888', fontSize: 14 },
  error: { color: 'red', marginTop: 8 },
});
```

---

## 6. Settings: Voice Wake Toggle

```tsx
// carinaMobile/src/screens/settings/VoiceSettingsScreen.tsx  (new file)

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function VoiceSettingsScreen() {
  const [enabled, setEnabled] = React.useState(true);
  const [privacyStart, setPrivacyStart] = React.useState(22);
  const [privacyEnd, setPrivacyEnd] = React.useState(7);

  React.useEffect(() => {
    AsyncStorage.getItem('voice-wake-enabled').then(v => {
      if (v !== null) setEnabled(v === 'true');
    });
  }, []);

  async function toggle(val: boolean) {
    setEnabled(val);
    await AsyncStorage.setItem('voice-wake-enabled', String(val));
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Wake word ("Hey Carina")</Text>
        <Switch value={enabled} onValueChange={toggle} />
      </View>
      <Text style={styles.hint}>
        Carina passively listens for your wake word. Audio is processed on-device only.
      </Text>
      <Text style={styles.sectionLabel}>Privacy hours (no listening)</Text>
      <Text style={styles.hint}>
        {privacyStart}:00 - {privacyEnd}:00 (wake word disabled overnight)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0a0a0a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: '#fff', fontSize: 16 },
  hint: { color: '#888', fontSize: 13, marginBottom: 16 },
  sectionLabel: { color: '#fff', fontSize: 15, marginTop: 16, marginBottom: 4 },
});
```

---

## Files to Create

```
carinaMobile/plugins/withVoiceWake.js
carinaMobile/src/hooks/useVoiceWake.ts
carinaMobile/src/hooks/useVoiceCapture.ts
carinaMobile/src/screens/VoiceWakeScreen.tsx
carinaMobile/src/screens/settings/VoiceSettingsScreen.tsx
```

## Files to Modify

```
carinaMobile/app.config.js          add withVoiceWake plugin
carinaMobile/app/(tabs)/index.tsx   embed VoiceWakeScreen or link from main tab
carinaMobile/app/settings.tsx       link to VoiceSettingsScreen
```

---

## Done When

- [ ] App requests microphone and speech recognition permissions on first launch
- [ ] Saying "Hey Carina" (or configured keyword) wakes the app from background
- [ ] After wake, voice capture starts automatically and transcript appears on screen
- [ ] Tapping Send sends the transcript to the agent and shows response
- [ ] Privacy hours setting stops wake word listening during the configured window
- [ ] Voice wake can be disabled entirely from settings
- [ ] iOS: porcupine stops when app goes to background (power saving)
- [ ] Android: porcupine continues in background (foreground service keeps it alive)
- [ ] Error states (no microphone permission, Picovoice key missing) show clear UI message
- [ ] Wake count is tracked and visible in settings (for debugging)
- [ ] Unit test: isPrivacyHour returns true for hours in the privacy window