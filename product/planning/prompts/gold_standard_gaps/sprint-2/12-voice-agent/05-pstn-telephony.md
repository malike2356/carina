# Prompt 05: PSTN Telephony via Twilio Voice API

## Context

Phase 5 of the voice roadmap. PSTN (Public Switched Telephone Network) integration means
Carina can be called like a phone number and respond with AI voice. This enables enterprise
use cases: receptionist bots, appointment booking bots, and automated IVR replacements.

Uses Twilio Voice API with TwiML for call control.

## What to Build

### 1. Twilio Voice webhook

Create `src/api/telephony.ts`:
```typescript
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

// Twilio calls this URL when someone dials the Carina phone number
router.post('/api/voice/incoming', (req, res) => {
  const twiml = new VoiceResponse();

  // Greet and start streaming
  const connect = twiml.connect();
  connect.stream({
    url: `wss://${process.env.CARINA_PUBLIC_HOST}/api/voice/stream-ws`,
    track: 'both_tracks',
  });

  res.type('text/xml');
  res.send(twiml.toString());
});
```

### 2. WebSocket audio bridge

Twilio streams audio via WebSocket using mulaw encoding at 8kHz.
Create `src/api/telephony-ws.ts`:
```typescript
import { WebSocket } from 'ws';

export function handleTwilioStream(ws: WebSocket): void {
  let callSid: string;
  let audioBuffer: Buffer[] = [];

  ws.on('message', async (data: string) => {
    const msg = JSON.parse(data);

    if (msg.event === 'start') {
      callSid = msg.start.callSid;
    }

    if (msg.event === 'media') {
      const chunk = Buffer.from(msg.media.payload, 'base64');
      audioBuffer.push(chunk);

      // VAD: detect silence to segment utterances
      if (isSilence(chunk) && audioBuffer.length > 10) {
        const audio = Buffer.concat(audioBuffer);
        audioBuffer = [];

        // Convert mulaw 8kHz to WAV 16kHz for Whisper
        const wav = convertMulawToWav(audio, 8000, 16000);
        const transcript = await transcribeAudio(wav.toString('base64'), 'wav');

        if (transcript.trim()) {
          const response = await getAgentResponse(callSid, transcript);
          const ttsAudio = await generateTtsAudioMulaw(response); // mulaw for Twilio
          sendAudioToTwilio(ws, callSid, ttsAudio);
        }
      }
    }

    if (msg.event === 'stop') {
      endCallSession(callSid);
    }
  });
}
```

### 3. Call session management

```typescript
const callSessions = new Map<string, { agentSession: CarinaSession; startTime: Date }>();

function getAgentSession(callSid: string): CarinaSession {
  if (!callSessions.has(callSid)) {
    const session = agent.createSession({ channel: 'voice', provider: 'twilio-pstn' });
    callSessions.set(callSid, { agentSession: session, startTime: new Date() });
  }
  return callSessions.get(callSid)!.agentSession;
}

function endCallSession(callSid: string): void {
  const sessionData = callSessions.get(callSid);
  if (sessionData) {
    sessionData.agentSession.end();
    callSessions.delete(callSid);
    logCallEnded(callSid, sessionData.startTime);
  }
}
```

### 4. Required Twilio setup

Required environment variables:
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+441234567890   # UK number for UK market
CARINA_PUBLIC_HOST=core.carinaai.uk
```

The Twilio phone number webhook must be configured:
- Voice Request URL: `https://core.carinaai.uk/api/voice/incoming` (HTTP POST)
- WebSocket streaming URL: `wss://core.carinaai.uk/api/voice/stream-ws`

### 5. Call logs in ops admin

Log all PSTN calls to the database:
```sql
CREATE TABLE pstn_calls (
  call_sid TEXT PRIMARY KEY,
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  transcript TEXT,
  session_id UUID REFERENCES sessions(id)
);
```

Show call log in ops admin under a "Telephony" tab.

## Verification Checklist

- [ ] Call Twilio phone number - hears greeting within 2 seconds
- [ ] Say a question - transcribed and answered via TTS within 3 seconds
- [ ] Call ends (hangup) - session cleaned up from callSessions map
- [ ] Call log entry created in pstn_calls table with transcript
- [ ] Ops admin Telephony tab shows recent calls with duration

## Files to Create or Modify

- CREATE `src/api/telephony.ts` - incoming call webhook
- CREATE `src/api/telephony-ws.ts` - WebSocket audio bridge
- MODIFY `src/server.ts` - mount telephony routes, register WebSocket handler for /api/voice/stream-ws
- MODIFY `.env.example` - add TWILIO_* variables
- MODIFY `docker/postgres/init.sql` - add pstn_calls table
- MODIFY `ops.carinaai.uk/views/` - add Telephony tab
