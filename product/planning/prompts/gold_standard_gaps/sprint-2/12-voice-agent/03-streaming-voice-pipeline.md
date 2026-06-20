# Prompt 03: Streaming Voice Pipeline

## Context

Phase 3 of the voice roadmap. After capturing audio, the pipeline is:
1. Audio -> Whisper STT (transcription)
2. Transcript -> Carina agent (LLM reasoning)
3. Agent response -> ElevenLabs TTS (speech)
4. Audio plays back to user

The streaming aspect: start playing TTS audio as soon as the first sentence is generated,
without waiting for the full response. This reduces perceived latency from 5-8 seconds
to 1-2 seconds.

## What to Build

### 1. Whisper STT endpoint

In `src/api/voice.ts`, add the transcription endpoint:
```typescript
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/api/voice/transcribe', async (req, res) => {
  const { audio, encoding, sampleRate } = req.body;

  // Decode base64 audio
  const audioBuffer = Buffer.from(audio, 'base64');
  const tempFile = `/tmp/voice-${Date.now()}.${encoding === 'opus' ? 'opus' : 'wav'}`;
  await fs.writeFile(tempFile, audioBuffer);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: createReadStream(tempFile),
      model: 'whisper-large-v3',
      language: 'en',
      response_format: 'json',
    });

    res.json({ transcript: transcription.text });
  } finally {
    await fs.unlink(tempFile);
  }
});
```

Use Groq for Whisper (fastest inference, 400ms latency).

### 2. Streaming TTS endpoint

Create a streaming endpoint that generates TTS sentence by sentence:
```typescript
router.post('/api/voice/stream', async (req, res) => {
  const { text } = req.body;

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');

  const elevenLabsStream = await elevenLabs.generate({
    voice: process.env.ELEVENLABS_VOICE_ID ?? 'rachel',
    text,
    model_id: 'eleven_turbo_v2',
    stream: true,
  });

  for await (const chunk of elevenLabsStream) {
    res.write(chunk);
  }
  res.end();
});
```

### 3. Voice conversation endpoint

The full voice pipeline in one endpoint (for simplicity on mobile):
```typescript
router.post('/api/voice/converse', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  const { audio, encoding, sessionId } = req.body;

  // Step 1: Transcribe
  const transcript = await transcribeAudio(audio, encoding);
  res.write(JSON.stringify({ type: 'transcript', text: transcript }) + '\n');

  // Step 2: Get agent response (streaming)
  const agentStream = agent.streamChat(transcript, { sessionId });
  let fullResponse = '';
  let pendingSentence = '';

  for await (const token of agentStream) {
    fullResponse += token;
    pendingSentence += token;

    // Stream TTS for each complete sentence
    if (/[.!?]/.test(pendingSentence) && pendingSentence.length > 20) {
      const ttsUrl = await generateTtsAudio(pendingSentence.trim());
      res.write(JSON.stringify({ type: 'audio', url: ttsUrl, text: pendingSentence }) + '\n');
      pendingSentence = '';
    }
  }

  // Flush remaining text
  if (pendingSentence.trim()) {
    const ttsUrl = await generateTtsAudio(pendingSentence.trim());
    res.write(JSON.stringify({ type: 'audio', url: ttsUrl, text: pendingSentence }) + '\n');
  }

  res.write(JSON.stringify({ type: 'done', fullText: fullResponse }) + '\n');
  res.end();
});
```

### 4. Mobile streaming playback

In `carinaMobile/src/api/voice.ts`:
```typescript
export async function converseVoice(audioUri: string, sessionId: string, onSentence: (url: string) => void): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(audioUri, { encoding: FileSystem.EncodingType.Base64 });

  const resp = await fetch(`${CARINA_API_URL}/api/voice/converse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ audio: base64, encoding: 'opus', sessionId }),
  });

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      const event = JSON.parse(line);
      if (event.type === 'audio') {
        onSentence(event.url); // play audio chunk immediately
      }
      if (event.type === 'done') fullText = event.fullText;
    }
  }

  return fullText;
}
```

### 5. Sequential sentence playback

On mobile, play audio chunks in sequence without overlap:
```typescript
const audioQueue: string[] = [];
let isPlaying = false;

async function playNext() {
  if (isPlaying || audioQueue.length === 0) return;
  isPlaying = true;
  const url = audioQueue.shift()!;
  const { sound } = await Audio.Sound.createAsync({ uri: url });
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.didJustFinish) {
      isPlaying = false;
      playNext();
    }
  });
  await sound.playAsync();
}

// Called by onSentence callback
audioQueue.push(sentenceAudioUrl);
playNext();
```

## Verification Checklist

- [ ] POST /api/voice/transcribe returns transcript within 600ms (Groq Whisper latency)
- [ ] POST /api/voice/converse streams NDJSON with transcript, audio, and done events
- [ ] First audio chunk starts playing before LLM finishes full response
- [ ] Two audio chunks play sequentially without overlap or gap > 200ms
- [ ] GROQ_API_KEY and ELEVENLABS_API_KEY are in .env.example

## Files to Create or Modify

- CREATE `src/api/voice.ts` - transcribe, TTS stream, converse endpoints
- MODIFY `src/server.ts` - mount voice routes
- MODIFY `carinaMobile/src/api/voice.ts` - converseVoice with streaming reader
- MODIFY `carinaMobile/src/audio/VoiceSession.ts` - call converseVoice and queue audio
- MODIFY `.env.example` - add GROQ_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
