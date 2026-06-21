# Prompt 02: Microphone Access and Audio Pipeline


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Voice input requires the mobile app to capture PCM audio from the microphone, encode it
as Opus, and stream it to the Carina Gateway over the WebSocket connection built in Prompt 01.
This is the "push-to-talk" audio pipeline (Phase 1 of voice roadmap).

## What to Build

### 1. Microphone permission flow

In `carinaMobile/src/screens/VoicePermissionScreen.tsx`:
```tsx
import { Audio } from 'expo-av';

export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}
```

Show a permission rationale screen BEFORE calling the OS permission dialog:
- Title: "Carina needs the microphone for voice commands"
- Body: "Carina uses your microphone only when you are actively speaking. No audio is sent to
  the cloud without your action."
- Buttons: "Allow" (triggers OS dialog) and "Not now" (falls back to text-only mode)

If permission is denied, text mode remains fully functional.

### 2. Audio capture

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
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 256000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {},
    });
    this.recording = recording;
  }

  async stop(): Promise<string> {
    await this.recording?.stopAndUnloadAsync();
    const uri = this.recording?.getURI() ?? '';
    this.recording = null;
    return uri; // path to WAV file
  }
}
```

### 3. Audio streaming to gateway

After recording stops, read the WAV file and send as binary chunks over WebSocket:
```typescript
import * as FileSystem from 'expo-file-system';

export async function streamAudioToGateway(wavUri: string, sessionId: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(wavUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  wsManager.send('voice.audio', {
    sessionId,
    codec: 'pcm-16000',
    data: base64,
  });
}
```

### 4. Push-to-talk UI component

In `carinaMobile/src/components/VoiceButton.tsx`:
```tsx
export function VoiceButton({ sessionId }: { sessionId: string }) {
  const [recording, setRecording] = useState(false);
  const capture = useMemo(() => new AudioCapture(), []);

  const onPressIn = async () => {
    setRecording(true);
    await capture.start();
  };

  const onPressOut = async () => {
    setRecording(false);
    const uri = await capture.stop();
    await streamAudioToGateway(uri, sessionId);
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}
      style={[styles.button, recording && styles.active]}>
      <Ionicons name={recording ? 'mic' : 'mic-outline'} size={32} color="white" />
    </Pressable>
  );
}
```

The button pulses with a red glow when recording is active.

### 5. TTS audio playback

When the gateway sends `voice.tts.audio` with base64 audio:
```typescript
import { Audio } from 'expo-av';

wsManager.on('voice.tts.audio', async (msg: any) => {
  const uri = `data:audio/wav;base64,${msg.data}`;
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
});
```

## Verification Checklist

- [ ] First time: permission rationale screen appears before OS dialog
- [ ] Hold voice button - recording indicator (pulsing mic) appears
- [ ] Release voice button - audio sends to gateway (network tab shows WebSocket message)
- [ ] Gateway processes audio and sends back TTS response - plays through speaker
- [ ] Permission denied: app falls back to text chat without crashing

## Files to Create or Modify

- CREATE `carinaMobile/src/services/AudioCapture.ts`
- CREATE `carinaMobile/src/screens/VoicePermissionScreen.tsx`
- CREATE `carinaMobile/src/components/VoiceButton.tsx`
- MODIFY `carinaMobile/src/screens/ChatScreen.tsx` - add VoiceButton to input row
- MODIFY `carinaMobile/app.json` - add microphone permission strings
