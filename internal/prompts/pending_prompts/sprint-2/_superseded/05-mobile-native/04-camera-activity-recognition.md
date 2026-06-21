# Prompt 04: Camera Access and QR Scanning


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Mobile context features that enhance Carina's usefulness: QR code scanning (link physical
assets to digital records), photo capture for document parsing (scan paper invoices,
whiteboards, code errors), and basic activity context (walking vs sitting influences
response verbosity).

## What to Build

### 1. QR code scanner

```bash
npx expo install expo-camera expo-barcode-scanner
```

In `carinaMobile/src/screens/ScanScreen.tsx`:
```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';

export function ScanScreen({ onScan }: { onScan: (data: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View>
        <Text>Camera needed for QR scanning</Text>
        <Button title="Grant permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      onBarcodeScanned={({ data }) => onScan(data)}
      barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13'] }}
    />
  );
}
```

Use cases:
- Scan asset QR code -> send to Carina: "Tell me about asset QR-1234"
- Scan network device label -> run nmap on the IP
- Scan document barcode -> look up record in ABBIS or project

### 2. Photo capture for document parsing

In `carinaMobile/src/screens/PhotoScreen.tsx`:
```tsx
import * as ImagePicker from 'expo-image-picker';

export async function captureAndSend(sessionId: string): Promise<void> {
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    base64: true,
  });

  if (!result.canceled && result.assets[0].base64) {
    wsManager.send('chat.image', {
      sessionId,
      type: 'image/jpeg',
      data: result.assets[0].base64,
      prompt: 'What does this show? Summarize for my notes.',
    });
  }
}
```

The gateway forwards the image + prompt to the LLM (Claude is the primary model for
vision tasks; DeepSeek-V3 is text-only). The response is a text summary or structured
extraction (e.g., invoice data as JSON).

Add a camera icon to the chat input bar that triggers `captureAndSend`.

### 3. Activity context (optional, opt-in)

Use the device's accelerometer to detect the user's activity level:
```bash
npx expo install expo-sensors
```

```typescript
import { Accelerometer } from 'expo-sensors';

type ActivityLevel = 'still' | 'walking' | 'active';

export function startActivityMonitor(onActivity: (level: ActivityLevel) => void): void {
  Accelerometer.setUpdateInterval(1000);
  Accelerometer.addListener(({ x, y, z }) => {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    if (magnitude < 1.05) onActivity('still');
    else if (magnitude < 1.5) onActivity('walking');
    else onActivity('active');
  });
}
```

Activity level is sent as context to the agent:
```
System context: User is [walking/still]. Keep responses brief for walking, detailed for still.
```

This is opt-in: the user enables "Activity-aware responses" in Settings -> Voice.

## Verification Checklist

- [ ] Camera icon in chat input opens camera scanner
- [ ] Scan a QR code - content appears as a message in chat ("QR code: <data>")
- [ ] Take a photo of a whiteboard - Carina returns a text summary
- [ ] Activity detection shows "walking" when phone is shaken, "still" when held steady
- [ ] Camera permission denied: feature is hidden, no crash

## Files to Create or Modify

- CREATE `carinaMobile/src/screens/ScanScreen.tsx`
- CREATE `carinaMobile/src/screens/PhotoScreen.tsx`
- CREATE `carinaMobile/src/services/ActivityMonitor.ts`
- MODIFY `carinaMobile/src/screens/ChatScreen.tsx` - add camera icon to input
- MODIFY `carinaMobile/app.json` - add camera and media library permissions
