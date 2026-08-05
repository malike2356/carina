# Prompt 02: Wake Word Detection and Voice Activity Detection


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Phase 2 of the voice roadmap. Instead of tapping a button to start recording, the user
should be able to say "Hey Carina" to activate the agent hands-free. Voice Activity
Detection (VAD) then automatically stops recording when the user finishes speaking,
eliminating the need to tap again.

Uses Porcupine for wake word (local, on-device) and WebRTC VAD for silence detection.

## What to Build

### 1. Porcupine wake word integration

Install: `pnpm add @picovoice/porcupine-react-native`

The wake word model file for "Hey Carina" must be trained at console.picovoice.ai.
Store the `.ppn` model file at `carinaMobile/assets/hey-carina.ppn`.

Create `carinaMobile/src/audio/WakeWordDetector.ts`:
```typescript
import { PorcupineManager } from '@picovoice/porcupine-react-native';

export class WakeWordDetector {
  private manager: PorcupineManager | null = null;
  private onWakeWord: () => void;

  constructor(onWakeWord: () => void) {
    this.onWakeWord = onWakeWord;
  }

  async start(): Promise<void> {
    this.manager = await PorcupineManager.fromBuiltInKeywords(
      process.env.EXPO_PUBLIC_PORCUPINE_ACCESS_KEY!,
      ['hey-carina'],  // requires custom keyword model - fall back to 'hey siri' for testing
      (keywordIndex) => {
        if (keywordIndex === 0) this.onWakeWord();
      },
    );
    await this.manager.start();
  }

  async stop(): Promise<void> {
    await this.manager?.stop();
    await this.manager?.delete();
    this.manager = null;
  }
}
```

### 2. WebRTC VAD for silence detection

Install: `pnpm add @ricky0123/vad-react` (works in React Native via reanimated)

Create `carinaMobile/src/audio/SilenceDetector.ts`:
```typescript
// Simplified VAD using audio level monitoring
// Full WebRTC VAD requires a native module - use expo-av metering for MVP

export class SilenceDetector {
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly silenceThresholdMs: number;
  private readonly minSpeechMs: number;
  private onSilence: () => void;
  private speechStarted = false;

  constructor(opts: { silenceThresholdMs?: number; minSpeechMs?: number; onSilence: () => void }) {
    this.silenceThresholdMs = opts.silenceThresholdMs ?? 1200;
    this.minSpeechMs = opts.minSpeechMs ?? 400;
    this.onSilence = opts.onSilence;
  }

  onAudioLevel(db: number): void {
    const isSpeaking = db > -50; // dB threshold for speech vs silence

    if (isSpeaking) {
      this.speechStarted = true;
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.speechStarted && !this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        this.onSilence();
      }, this.silenceThresholdMs);
    }
  }

  reset(): void {
    this.speechStarted = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
  }
}
```

Feed metering data from `expo-av` recording status updates:
```typescript
recording.setOnRecordingStatusUpdate((status) => {
  if (status.metering !== undefined) {
    silenceDetector.onAudioLevel(status.metering);
  }
});
await recording.startAsync();
```

### 3. Always-on listening mode

Create `carinaMobile/src/audio/VoiceSession.ts`:
```typescript
export type VoiceSessionState = 'idle' | 'listening-for-wake' | 'recording' | 'processing';

export class VoiceSession {
  private state: VoiceSessionState = 'idle';
  private wakeDetector: WakeWordDetector;
  private silenceDetector: SilenceDetector;
  private capture: AudioCapture;

  constructor(private onTranscript: (text: string) => void) {
    this.wakeDetector = new WakeWordDetector(() => this.startRecording());
    this.silenceDetector = new SilenceDetector({ onSilence: () => this.stopAndTranscribe() });
    this.capture = new AudioCapture();
  }

  async enable(): Promise<void> {
    await this.wakeDetector.start();
    this.state = 'listening-for-wake';
  }

  async disable(): Promise<void> {
    await this.wakeDetector.stop();
    this.state = 'idle';
  }

  private async startRecording(): Promise<void> {
    this.state = 'recording';
    await this.capture.start();
    this.silenceDetector.reset();
  }

  private async stopAndTranscribe(): Promise<void> {
    this.state = 'processing';
    const uri = await this.capture.stop();
    if (uri) {
      const transcript = await sendAudioToGateway(uri);
      this.onTranscript(transcript);
    }
    // Re-enable wake word detection
    this.state = 'listening-for-wake';
  }
}
```

### 4. Battery-friendly listening

Always-on microphone drains battery. Implement a smart mode:
- Active listening: full-time wake word detection
- Background mode: check microphone every 2 seconds (reduces CPU by 80%)
- Sleeping mode: no microphone (off by default, enabled when phone is plugged in)

Toggle in settings: "Listen while app is in background" toggle (off by default).

## Verification Checklist

- [ ] Say "Hey Carina" - recording starts within 500ms (visual feedback in UI)
- [ ] Say "What's the weather?" then stop talking - recording stops automatically after 1.2s silence
- [ ] Ambient noise (below -50dB) does not trigger silence timer
- [ ] Porcupine does not trigger on "Hey Cortana" or "Hey Siri" (cross-wake test)
- [ ] Disabling always-on mode stops microphone (check via iOS/Android battery screen)

## Files to Create or Modify

- CREATE `carinaMobile/src/audio/WakeWordDetector.ts`
- CREATE `carinaMobile/src/audio/SilenceDetector.ts`
- CREATE `carinaMobile/src/audio/VoiceSession.ts`
- MODIFY `carinaMobile/src/components/VoiceButton.tsx` - add always-on mode toggle
- MODIFY `carinaMobile/app/(voice)/active.tsx` - integrate VoiceSession
- MODIFY `carinaMobile/app.json` - add background microphone capability
