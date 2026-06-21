# Prompt 01: Mobile Audio Foundation


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The voice agent requires mobile audio capture before anything else. This is Phase 1 of
the 5-phase voice roadmap in `CARINA_VOICE_AGENT_ROADMAP.md`. All subsequent voice
prompts build on the audio pipeline created here.

The mobile companion lives at `carinaMobile/` (Expo Router + React Native).

## What to Build

### 1. Audio permission screen

Before using the microphone for the first time, show a permission rationale screen:
```tsx
// carinaMobile/app/(voice)/permission.tsx
export default function MicPermissionScreen() {
  const [status, requestPermission] = Audio.usePermissions();

  if (status?.granted) {
    router.replace('/(voice)/active');
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Microphone Access</Text>
      <Text style={styles.body}>
        Carina needs microphone access to hear your voice commands.
        Your audio is processed securely and never stored.
      </Text>
      <Pressable style={styles.button} onPress={requestPermission}>
        <Text style={styles.buttonText}>Allow Microphone</Text>
      </Pressable>
    </View>
  );
}
```

### 2. Audio capture class

Create `carinaMobile/src/audio/AudioCapture.ts`:
```typescript
import { Audio } from 'expo-av';

export class AudioCapture {
  private recording: Audio.Recording | null = null;

  async start(): Promise<void> {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync({
      android: {
        extension: '.opus',
        outputFormat: Audio.AndroidOutputFormat.OGG,
        audioEncoder: Audio.AndroidAudioEncoder.OPUS,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 32000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.LOW,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 32000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {},
    });

    this.recording = recording;
  }

  async stop(): Promise<string | null> {
    if (!this.recording) return null;
    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    this.recording = null;
    return uri;
  }
}
```

### 3. Voice button component

Create `carinaMobile/src/components/VoiceButton.tsx`:
```tsx
export function VoiceButton({ onRecord }: { onRecord: (audioUri: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const capture = useRef(new AudioCapture());
  const scale = useSharedValue(1);

  // Pulse animation while recording
  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(withSequence(
        withTiming(1.15, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ), -1, false);
    } else {
      scale.value = withTiming(1);
    }
  }, [isRecording]);

  const handlePress = async () => {
    if (!isRecording) {
      setIsRecording(true);
      await capture.current.start();
    } else {
      const uri = await capture.current.stop();
      setIsRecording(false);
      if (uri) onRecord(uri);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={handlePress} style={[styles.button, isRecording && styles.recording]}>
        <Text style={styles.icon}>{isRecording ? 'STOP' : 'MIC'}</Text>
      </Pressable>
    </Animated.View>
  );
}
```

### 4. Audio upload to gateway

```typescript
export async function sendAudioToGateway(audioUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const resp = await fetch(`${CARINA_API_URL}/api/voice/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ audio: base64, encoding: 'opus', sampleRate: 16000 }),
  });

  const { transcript } = await resp.json();
  return transcript;
}
```

### 5. TTS playback

```typescript
export async function playTtsResponse(text: string): Promise<void> {
  const ttsResp = await fetch(`${CARINA_API_URL}/api/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ text, voice: 'rachel' }),  // ElevenLabs voice
  });

  const audioUrl = (await ttsResp.json()).audioUrl;
  const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
  await sound.playAsync();
}
```

## Verification Checklist

- [ ] Permission screen appears on first voice screen visit
- [ ] Granting permission navigates to voice active screen
- [ ] Tapping mic button starts recording (VoiceButton shows pulse animation)
- [ ] Tapping again stops recording and logs audio URI
- [ ] `sendAudioToGateway` posts to `/api/voice/transcribe` and returns transcript
- [ ] TTS audio plays through speaker after text response

## Files to Create or Modify

- CREATE `carinaMobile/app/(voice)/permission.tsx`
- CREATE `carinaMobile/app/(voice)/active.tsx`
- CREATE `carinaMobile/src/audio/AudioCapture.ts`
- CREATE `carinaMobile/src/components/VoiceButton.tsx`
- CREATE `carinaMobile/src/api/voice.ts`
- MODIFY `carinaMobile/app.json` - add microphone permission descriptions
