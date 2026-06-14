# SPEC: On-Device Inference (Phase 10); Carina Mobile

**Status:** Spec only. Claude to implement.
**Base:** `carina/carinaMobile/` (Expo SDK 52, React Native 0.76, TypeScript 5.7)
**Target:** Android first. iOS secondary (same code, different model constraints).

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────┐
│                  useChatSession                       │
│                                                      │
│  sendMessage(text)                                   │
│    │                                                 │
│    ├── NetInfo.isConnected === true                  │
│    │   └── streamChat(baseUrl, ...)  ← unchanged     │
│    │                                                 │
│    └── NetInfo.isConnected === false                 │
│        └── localInference(text)     ← NEW            │
│            │                                         │
│            ├── Model loaded? ──No──→ return error     │
│            │                                         │
│            └── Yes                                   │
│                ├── Build prompt (system + history)    │
│                ├── llama.completion(prompt)           │
│                ├── Fake SSE chunks for streaming UI   │
│                └── Return full response               │
└──────────────────────────────────────────────────────┘
```

**Key principles:**
- Online path is **untouched**. If connected → server. If not → local model.
- Local model is read-only inference. No tools, no cron, no subagents.
- Model is downloaded on-demand, not bundled in APK (size: ~2 GB).
- Local chat sessions are saved to AsyncStorage (same session system as online).

---

## 2. Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "react-native-llama": "^0.3.0",
    "expo-file-system": "~18.0.0",
    "expo-network": "~7.0.0"
  }
}
```

| Package | Purpose | License |
|---------|---------|---------|
| `react-native-llama` | llama.cpp bindings for RN. Runs GGUF models on-device. | MIT |
| `expo-file-system` | Read/write model files in app documents directory. | MIT |
| `expo-network` | More reliable connectivity check than NetInfo alone. | MIT |

**Install command:**
```bash
cd carina/carinaMobile
pnpm add react-native-llama expo-file-system expo-network
```

**Build note:** `react-native-llama` requires Android NDK and has native C++ code. EAS build will handle this automatically. Local dev builds need `npx expo prebuild --clean` after adding.

---

## 3. Model Selection & Management

### 3.1 Recommended model

**Google Gemma 2 2B Instruct; Q4_K_M quant**

| Property | Value |
|----------|-------|
| File | `gemma-2-2b-it-Q4_K_M.gguf` |
| Size | ~1.6 GB |
| RAM needed | ~2.5 GB (fits most Android phones from 2020+) |
| Quality | GPT-3.5-level instruction following |
| Context window | 8192 tokens |
| Source | HuggingFace: `bartowski/gemma-2-2b-it-GGUF` |
| License | Gemma license (free for commercial use) |

**Fallback option (smaller):** Llama 3.2 1B Instruct Q4_K_M (~700 MB, lower quality but fits older devices).

### 3.2 Model download strategy

**Do NOT bundle the model in the APK.** It would bloat the binary to 2 GB. Instead:

1. **First launch:** Show a "Download AI Model" card in Settings > Local AI
2. **Download:** Fetch `.gguf` from `https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf`
3. **Storage:** Save to `FileSystem.documentDirectory + 'models/'` 
4. **Resume:** Use `expo-file-system` download resumable API (survives app backgrounding)
5. **Verification:** SHA256 hash check after download
6. **Progress:** Show percentage + MB downloaded in UI

**Model metadata persisted to AsyncStorage:**
```typescript
interface LocalModelMeta {
  modelId: string; // 'gemma-2-2b-it-q4km'
  filePath: string; // absolute path
  fileSizeBytes: number;
  sha256: string;
  downloadedAt: string; // ISO timestamp
  version: number; // increment to force re-download on update
}
```

### 3.3 Model update strategy

- `src/config/local-model.ts` holds `CURRENT_MODEL_VERSION = 1`
- On app launch, compare stored version. If mismatch → prompt user to re-download.
- Old `.gguf` deleted before new download starts to save space.

---

## 4. New Files

### 4.1 `src/config/local-model.ts`

Constants for the local model:

```typescript
// Model identity
export const LOCAL_MODEL_ID = 'gemma-2-2b-it-q4km';
export const LOCAL_MODEL_VERSION = 1;
export const LOCAL_MODEL_DISPLAY_NAME = 'Gemma 2B (on-device)';

// Download
export const LOCAL_MODEL_URL =
  'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf';
export const LOCAL_MODEL_SHA256 =
  '...'; // SHA256 of the .gguf file; fetch from HF or compute once

// Inference
export const LOCAL_MODEL_CONTEXT_SIZE = 4096; // tokens; lower than max to save RAM
export const LOCAL_MODEL_MAX_TOKENS = 1024;
export const LOCAL_MODEL_TEMPERATURE = 0.7;
```

### 4.2 `src/lib/local-inference.ts`

Core inference engine. Wraps `react-native-llama`.

**API:**
```typescript
import type { ChatMessage } from '@/api/types';

// Call once on app launch or when model downloaded
export async function initLocalModel(modelPath: string): Promise<boolean>;

// Returns true if model is loaded and ready
export function isLocalModelReady(): boolean;

// Free model from memory (call when switching to online or app backgrounding)
export async function unloadLocalModel(): Promise<void>;

// Run inference. Messages are the conversation history (last N messages to fit context).
// Returns the model's text response. No streaming in v1; we'll fake it.
export async function localChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string>;
```

**Internal prompt format (Gemma instruct):**
```
<start_of_turn>user
You are Carina, an AI assistant running locally on this device.
You have limited capabilities compared to the full cloud version.
You cannot run code, send emails, manage files, or access the internet.
Answer concisely and honestly. If you cannot do something, say so.

Recent conversation:
[User's earlier messages...]

Current message: {latest user message}
<end_of_turn>
<start_of_turn>model
```

**Faking streaming:** The `useChatSession` hook expects `onChunk` callbacks. Since `react-native-llama` completion is synchronous (returns full text), we need a wrapper that yields characters/words on a timer:

```typescript
// In local-inference.ts
export async function* localChatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const full = await localChat(messages, signal);
  // Yield word-by-word with 20ms delay to simulate streaming
  const words = full.split(/(\s+)/);
  for (const word of words) {
    if (signal?.aborted) break;
    yield word;
    await new Promise(r => setTimeout(r, 20));
  }
}
```

### 4.3 `src/lib/local-model-manager.ts`

Handles download, verification, storage, and cleanup.

**API:**
```typescript
export type DownloadState = 
  | 'not_started' 
  | 'downloading' 
  | 'verifying' 
  | 'ready' 
  | 'error';

export interface DownloadProgress {
  state: DownloadState;
  bytesDownloaded: number;
  totalBytes: number;
  error?: string;
}

// Get current download progress (reactive; call from hook)
export function getDownloadProgress(): DownloadProgress;

// Start/resume model download. Returns true when complete and verified.
export async function downloadModel(
  onProgress: (progress: DownloadProgress) => void,
): Promise<boolean>;

// Check if model exists and is valid
export async function isModelDownloaded(): Promise<boolean>;

// Delete model to free space
export async function deleteModel(): Promise<void>;

// Get stored model metadata
export async function getModelMeta(): Promise<LocalModelMeta | null>;
```

**Implementation notes:**
- Use `FileSystem.createDownloadResumable` for the download so it survives app backgrounding.
- After download: compute SHA256 of file, compare to `LOCAL_MODEL_SHA256`.
- Store `LocalModelMeta` to AsyncStorage key `carina.local-model`.
- Models directory: `FileSystem.documentDirectory + 'models/'`. Create if missing.

### 4.4 `src/hooks/useLocalModel.ts`

React hook for the UI layer.

```typescript
export function useLocalModel(): {
  // State
  downloadProgress: DownloadProgress;
  isReady: boolean;
  modelName: string | null;

  // Actions
  startDownload: () => Promise<void>;
  deleteModel: () => Promise<void>;
};
```

On mount: check if model downloaded → if yes, call `initLocalModel()`. If no, expose `startDownload`.

### 4.5 `src/hooks/useLocalChat.ts`

Thin wrapper that mirrors `useChatStream` but routes to local model.

```typescript
export function useLocalChat(): {
  streaming: boolean;
  error: string | null;
  partial: string;
  send: (message: string, history: ChatMessage[]) => Promise<string>;
  cancel: () => void;
};
```

Calls `localChatStream()` with a `ChatMessage[]` history.

### 4.6 `src/components/LocalModelManager.tsx`

UI component for Settings/More tab.

**States:**
1. **Not downloaded:** "AI Model; Not installed" + "Download (1.6 GB)" button
2. **Downloading:** Progress bar with percentage + MB/s + cancel button
3. **Verifying:** "Verifying model integrity..." spinner
4. **Ready:** "Gemma 2B; Ready" + green dot + "Delete model" button
5. **Error:** Red banner with error message + "Retry" button

**Visual match:** Use existing theme tokens (`src/theme/tokens.ts`). Teal accent for progress, ink background.

---

## 5. Modified Files

### 5.1 `src/hooks/useChatSession.ts`; **CRITICAL: minimal changes**

The `sendMessage` function already checks `NetInfo.isConnected` and queues offline messages. **Replace the queue behavior** with local inference when the model is ready:

```typescript
// Current (line ~181-188):
const network = await NetInfo.fetch();
if (!network.isConnected) {
  const userMessage = createMessage('user', text);
  setMessages((prev) => [...prev, userMessage]);
  await enqueueOfflineMessage(text);
  setStreamError('Offline. Message queued for send.');
  return;
}

// REPLACE WITH:
const network = await NetInfo.fetch();
if (!network.isConnected) {
  // Try local model first
  if (isLocalModelReady()) {
    // ... proceed with local inference path
  } else {
    // Fall back to queue behavior (unchanged)
    const userMessage = createMessage('user', text);
    setMessages((prev) => [...prev, userMessage]);
    await enqueueOfflineMessage(text);
    setStreamError('Offline; model not downloaded. Message queued.');
    return;
  }
}
```

**Local inference path (inside the offline branch):**

```typescript
// Create user message
const userMessage = createMessage('user', text);
setMessages((prev) => [...prev, userMessage]);

const assistantId = `assistant-${Date.now()}`;
const assistantMsg: ChatMessage = {
  id: assistantId,
  role: 'assistant',
  content: '',
  createdAt: new Date().toISOString(),
  status: 'streaming',
  provider: LOCAL_MODEL_DISPLAY_NAME,  // NEW: show 'Gemma 2B (on-device)' in UI
};

setMessages((prev) => [...prev, assistantMsg]);
setStreaming(true);
setStreamError(null);
setActiveTools([]);

try {
  const history = messages.slice(-20); // Last 20 messages for context
  let streamBuffer = '';
  
  for await (const token of localChatStream(history, controller.signal)) {
    streamBuffer += token;
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: streamBuffer }
          : msg,
      ),
    );
  }

  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantId
        ? { ...msg, content: streamBuffer, status: 'done' as const }
        : msg,
    ),
  );
} catch (err) {
  // Handle abort / model error
  setMessages((prev) =>
    prev.map((msg) =>
      msg.id === assistantId
        ? { ...msg, content: 'Local model error: ' + (err.message || 'unknown'), status: 'error' as const }
        : msg,
    ),
  );
} finally {
  setStreaming(false);
}
```

**Provider display:** `LOCAL_MODEL_DISPLAY_NAME` ('Gemma 2B (on-device)') shown in `ChatMessageBubble` provider badge. Already handles a `provider` string; no UI change needed.

**What stays identical:** The online path (line 232-344), slash commands, `/clear`, session persistence, task tracking. ZERO changes to those.

### 5.2 `src/store/instance-store.ts`; add local model ready flag

Add to `InstanceConfig` (in types.ts, below):

```typescript
export interface InstanceConfig {
  mode: InstanceMode;
  baseUrl: string;
  sessionId: string;
  localModelReady?: boolean; // NEW
}
```

Not persisted as part of instance config; it's transient state. But adding here avoids creating a separate store. **Actually:** better to keep it separate. Create `src/store/local-model-store.ts` instead.

### 5.3 NEW: `src/store/local-model-store.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'carina.local-model.enabled';

// User toggle: enable/disable local model (default: true)
export async function isLocalModelEnabled(): Promise<boolean> { ... }
export async function setLocalModelEnabled(enabled: boolean): Promise<void> { ... }
```

### 5.4 `src/api/types.ts`; minimal additions

Add to `ChatMessage`:
```typescript
export interface ChatMessage {
  // ... existing fields ...
  inferenceType?: 'cloud' | 'local'; // NEW; distinguishes server vs on-device responses
}
```

This lets the UI show a small "on-device" label on locally-generated messages.

### 5.5 `src/components/ChatMessageBubble.tsx`

If `message.inferenceType === 'local'`, render a subtle teal "on-device" badge next to the provider badge. Use existing `ProviderBadge` component pattern.

### 5.6 `src/components/ChatComposer.tsx`

When offline AND local model ready: change placeholder text from "Message Carina..." to "Message Carina (on-device)...".

When offline AND model NOT ready: keep existing behavior (queue indicator).

---

## 6. App-Level Integration

### 6.1 App root initialization

In `app/_layout.tsx` (or wherever the app initializes):

```typescript
useEffect(() => {
  // If model was previously downloaded, pre-load it
  isModelDownloaded().then(downloaded => {
    if (downloaded) {
      const meta = await getModelMeta();
      if (meta) await initLocalModel(meta.filePath);
    }
  });
}, []);
```

### 6.2 AppState handling

When app backgrounds → `unloadLocalModel()` to free RAM.
When app foregrounds → re-initialize if model downloaded.

This prevents the model from sitting in RAM when not in use.

### 6.3 Memory pressure

Android can kill the app under memory pressure. The model ~2.5 GB RAM is significant. The `react-native-llama` library should handle this, but we add a safety net:

```typescript
// In AppState listener:
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'background') {
    unloadLocalModel();
  }
});
```

---

## 7. UI Screens

### 7.1 Settings > Local AI (new screen)

**Route:** `app/(tabs)/more/local-model.tsx`

**Layout:**
```
┌─────────────────────────────────┐
│ ← Local AI Model                │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ ○ Gemma 2B (on-device)    │  │
│  │   Ready                   │  │
│  │   Size: 1.6 GB            │  │
│  │   [Delete Model]          │  │
│  └───────────────────────────┘  │
│                                 │
│  ── OR ──                       │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ○ Gemma 2B (on-device)    │  │
│  │   Not installed           │  │
│  │   1.6 GB download         │  │
│  │   [Download Model]        │  │
│  └───────────────────────────┘  │
│                                 │
│  ── Settings ──                 │
│                                 │
│  Enable local AI    [toggle]    │
│  Auto-download      [toggle]    │
│  (Wi-Fi only by default)        │
│                                 │
│  ── About ──                    │
│                                 │
│  Local AI runs a small language │
│  model directly on your device. │
│  No internet needed. Responses  │
│  are private. Quality is lower  │
│  than the cloud version.        │
└─────────────────────────────────┘
```

### 7.2 Download progress overlay

When download starts, show a modal or bottom sheet with:
- Progress bar (percentage)
- Transfer speed (MB/s)
- Estimated time remaining
- Cancel button

If app backgrounds during download, `expo-file-system` resumable download continues.

### 7.3 ConnectionStatusChip upgrade

The existing `ConnectionStatusChip` shows online/offline. Upgrade to show:
- **Online** → green dot + provider name (unchanged)
- **Offline + model ready** → teal dot + "On-device"
- **Offline + no model** → red dot + "Offline"

---

## 8. Build Configuration

### 8.1 `eas.json`; no changes needed

EAS handles native modules automatically.

### 8.2 `app.config.ts`; add plugin

```typescript
plugins: [
  // ... existing plugins ...
  [
    'react-native-llama',
    {
      // No special config needed; defaults work
    },
  ],
],
```

### 8.3 Android permissions (already exist, verify)

- `INTERNET`; for model download (already in manifest)
- `RECORD_AUDIO`; already declared for voice input

### 8.4 App size

| Component | Size |
|-----------|------|
| APK (without model) | ~60 MB |
| Model (downloaded post-install) | ~1.6 GB |
| Total device storage needed | ~2 GB free |

Google Play limit is 200 MB per APK. Model is downloaded separately → no Play Store issue.

### 8.5 ProGuard rules (if minification enabled)

Add to `android/app/proguard-rules.pro`:
```
-keep class com.rnllama.** { *; }
```

---

## 9. Limitations & Disclaimers (for UI)

The settings screen should clearly communicate:

> **What local AI can do:**
> - Basic conversation and questions
> - Simple advice and explanations
> - Works without internet
> - Private; data stays on device
>
> **What local AI cannot do:**
> - Run code or terminal commands
> - Send emails or messages
> - Access files, contacts, or calendar
> - Execute cron jobs or subagents
> - Use tools (camera analysis excepted)
>
> For full capabilities, connect to Carina Cloud or a self-hosted gateway.

---

## 10. Testing

### 10.1 Unit tests (vitest)

New test files:
- `src/lib/local-inference.test.ts`; mock `react-native-llama`, test prompt construction
- `src/lib/local-model-manager.test.ts`; mock `expo-file-system`, test download/resume/verify flows
- `src/hooks/useLocalChat.test.ts`; test streaming wrapper

### 10.2 Manual QA on device

| Test | Expected |
|------|----------|
| Download model on Wi-Fi | Progress bar, success |
| Download model on cellular | Should warn if > 100 MB (OS handles) |
| Send message offline with model loaded | Response in < 10s, "Gemma 2B (on-device)" badge |
| Send message offline without model | Queue behavior (unchanged) |
| Background app during download | Resume on foreground |
| Background app during chat | Model unloaded, re-loaded on foreground |
| Switch to online | Online path works, no interference |
| Delete model | Frees storage, state resets |

---

## 11. File Manifest

### New files (10)
```
src/config/local-model.ts
src/lib/local-inference.ts
src/lib/local-model-manager.ts
src/hooks/useLocalModel.ts
src/hooks/useLocalChat.ts
src/store/local-model-store.ts
src/components/LocalModelManager.tsx
app/(tabs)/more/local-model.tsx
src/lib/local-inference.test.ts
src/lib/local-model-manager.test.ts
```

### Modified files (6)
```
package.json; add 3 deps
app.config.ts; add react-native-llama plugin
src/api/types.ts; add inferenceType to ChatMessage
src/hooks/useChatSession.ts; add local inference fallback in sendMessage
src/components/ChatMessageBubble.tsx; render 'on-device' badge
src/components/ConnectionStatusChip.tsx; upgrade status states
```

### Untouched files
- `src/api/chat-stream.ts`; online streaming unchanged
- `src/api/carina-client.ts`; server API unchanged
- `src/store/auth-store.tsx`; auth unchanged
- `src/store/instance-store.ts`; instance config unchanged
- All other screens, hooks, components

---

## 12. Build Order (for Claude)

1. Add dependencies (`pnpm add ...`)
2. Create `src/config/local-model.ts` (constants)
3. Create `src/lib/local-model-manager.ts` (download/verify)
4. Create `src/lib/local-inference.ts` (llama wrapper + streaming generator)
5. Create `src/store/local-model-store.ts` (enable/disable toggle)
6. Create `src/hooks/useLocalModel.ts` (UI hook)
7. Create `src/hooks/useLocalChat.ts` (inference hook)
8. Modify `src/hooks/useChatSession.ts` (offline fallback; **MOST DELICATE CHANGE**)
9. Modify `src/api/types.ts` (add `inferenceType`)
10. Create `src/components/LocalModelManager.tsx` (settings UI)
11. Create `app/(tabs)/more/local-model.tsx` (settings screen)
12. Modify `src/components/ChatMessageBubble.tsx` (on-device badge)
13. Modify `src/components/ConnectionStatusChip.tsx` (status upgrade)
14. Write tests
15. `pnpm typecheck`; must pass
16. `pnpm test`; must pass
17. `npx expo prebuild --clean`; regenerate native projects
18. EAS build: `eas build --profile preview --platform android`

---

## 13. Out of Scope (not in this phase)

- iOS Metal/MPS acceleration (Android CPU inference only for Phase 10)
- Tool use via local model (no function calling in 2B model)
- Multi-model support (download different models)
- Model fine-tuning on-device
- Offline task execution
- Local voice STT fallback (already online via expo-speech-recognition)
