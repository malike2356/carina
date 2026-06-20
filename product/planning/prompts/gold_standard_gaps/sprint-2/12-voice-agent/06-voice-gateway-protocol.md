# Prompt 06: Voice Gateway Protocol

## Context

The voice gateway is the abstraction layer between transport (mobile mic, WebSocket,
Twilio PSTN) and the Carina agent. Without it, voice-specific code is scattered across
API routes. The gateway protocol defines a clean interface that any voice transport can
implement, and routes all voice interactions through the same agent pipeline.

## What to Build

### 1. Gateway protocol interface

Create `src/gateway/voice-gateway.ts`:
```typescript
export interface VoiceTransport {
  id: string;
  name: string; // 'mobile', 'twilio-pstn', 'webrtc', 'desktop'
  onAudio: (handler: (audio: AudioChunk) => void) => void;
  sendAudio: (audio: Buffer) => Promise<void>;
  onDisconnect: (handler: () => void) => void;
  close: () => void;
}

export type AudioChunk = {
  data: Buffer;
  encoding: 'pcm16' | 'mulaw' | 'opus';
  sampleRate: number;
  channelCount: 1 | 2;
};

export class VoiceGateway {
  private sessions = new Map<string, VoiceGatewaySession>();

  async registerTransport(transport: VoiceTransport, tenantId: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session = new VoiceGatewaySession(transport, tenantId, sessionId);
    this.sessions.set(sessionId, session);
    transport.onDisconnect(() => {
      session.end();
      this.sessions.delete(sessionId);
    });
    await session.start();
    return sessionId;
  }
}
```

### 2. Gateway session

Create `src/gateway/voice-gateway-session.ts`:
```typescript
export class VoiceGatewaySession {
  private vad: SilenceDetector;
  private audioBuffer: Buffer[] = [];
  private agentSession: CarinaSession;

  constructor(private transport: VoiceTransport, tenantId: string, id: string) {
    this.agentSession = agent.createSession({ channel: 'voice', tenantId });
    this.vad = new SilenceDetector({
      silenceThresholdMs: 1000,
      onSilence: () => this.processBuffer(),
    });
  }

  async start(): Promise<void> {
    this.transport.onAudio(async (chunk) => {
      const pcm = await this.normalizeAudio(chunk);
      this.audioBuffer.push(pcm);
      const level = computeAudioLevel(pcm);
      this.vad.onAudioLevel(level);
    });
  }

  private async processBuffer(): Promise<void> {
    if (this.audioBuffer.length === 0) return;
    const audio = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];

    const transcript = await stt(audio);
    if (!transcript.trim()) return;

    const response = await this.agentSession.chat(transcript);
    const audioResponse = await tts(response);
    await this.transport.sendAudio(audioResponse);
  }
}
```

### 3. Mobile transport adapter

Create `src/gateway/transports/mobile-transport.ts`:
```typescript
export class MobileTransport implements VoiceTransport {
  id = 'mobile';
  name = 'mobile';
  private wsClient: WebSocket;

  constructor(ws: WebSocket) {
    this.wsClient = ws;
  }

  onAudio(handler: (audio: AudioChunk) => void): void {
    this.wsClient.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'audio') {
        handler({
          data: Buffer.from(msg.payload, 'base64'),
          encoding: msg.encoding,
          sampleRate: msg.sampleRate,
          channelCount: 1,
        });
      }
    });
  }

  async sendAudio(audio: Buffer): Promise<void> {
    this.wsClient.send(JSON.stringify({
      type: 'audio',
      payload: audio.toString('base64'),
    }));
  }

  onDisconnect(handler: () => void): void {
    this.wsClient.on('close', handler);
  }

  close(): void {
    this.wsClient.close();
  }
}
```

### 4. Twilio transport adapter

Create `src/gateway/transports/twilio-transport.ts`:
```typescript
export class TwilioTransport implements VoiceTransport {
  id = 'twilio-pstn';
  name = 'twilio-pstn';
  private ws: WebSocket;

  // Twilio sends mulaw 8kHz in base64 chunks
  onAudio(handler: (audio: AudioChunk) => void): void {
    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.event === 'media') {
        handler({
          data: Buffer.from(msg.media.payload, 'base64'),
          encoding: 'mulaw',
          sampleRate: 8000,
          channelCount: 1,
        });
      }
    });
  }
}
```

### 5. Audio normalization (all transports -> PCM16 16kHz)

```typescript
async function normalizeAudio(chunk: AudioChunk): Promise<Buffer> {
  if (chunk.encoding === 'pcm16' && chunk.sampleRate === 16000) return chunk.data;
  return convertAudio(chunk.data, { from: chunk.encoding, fromRate: chunk.sampleRate, toRate: 16000 });
}
```

Use `ffmpeg` (via `fluent-ffmpeg`) for conversion: it handles mulaw->pcm16, opus->pcm16.

## Verification Checklist

- [ ] Mobile WebSocket connects, sends opus audio, receives audio response
- [ ] Twilio PSTN call routes through TwilioTransport adapter
- [ ] VoiceGateway.sessions.size === 2 when two concurrent calls active
- [ ] Session cleaned up when transport disconnects (no memory leak)
- [ ] mulaw 8kHz audio normalized to pcm16 16kHz before STT (verify via pcm level logs)

## Files to Create or Modify

- CREATE `src/gateway/voice-gateway.ts`
- CREATE `src/gateway/voice-gateway-session.ts`
- CREATE `src/gateway/transports/mobile-transport.ts`
- CREATE `src/gateway/transports/twilio-transport.ts`
- CREATE `src/gateway/audio-normalizer.ts`
- MODIFY `src/server.ts` - mount WebSocket handler for mobile voice at /api/voice/ws
- MODIFY `src/api/telephony-ws.ts` - delegate to TwilioTransport and VoiceGateway
