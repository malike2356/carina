# Prompt 07: Scout Voice Monitoring


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Voice interactions introduce new security risks: voice injection (a third party speaking
into the microphone), prompt injection via audio (attacker crafts audio containing
malicious instructions), and unauthorized PSTN calls. Scout must monitor voice sessions
with the same rigor as text sessions.

## What to Build

### 1. Voice-specific Scout event types

Add to Scout's event type registry:
```typescript
export const VOICE_EVENT_TYPES = {
  'voice.session.start': 'Voice session started',
  'voice.session.end': 'Voice session ended',
  'voice.injection.detected': 'Potential voice injection detected',
  'voice.prompt.injection': 'Prompt injection detected in transcribed audio',
  'voice.pstn.call': 'Incoming PSTN call',
  'voice.pstn.unknown': 'PSTN call from unknown/blocked number',
  'voice.tts.error': 'TTS generation failed',
  'voice.transcript.empty': 'Repeated empty transcripts (possible dead air attack)',
};
```

### 2. Voice session events

In `src/gateway/voice-gateway-session.ts`, emit Scout events:
```typescript
// On session start
await scoutEmit('voice.session.start', {
  sessionId: this.id,
  transport: this.transport.name,
  tenantId: this.tenantId,
});

// On session end
await scoutEmit('voice.session.end', {
  sessionId: this.id,
  durationSeconds: Math.round((Date.now() - this.startTime.getTime()) / 1000),
  utteranceCount: this.utteranceCount,
  transcriptWords: this.totalWords,
});
```

### 3. Prompt injection detection in audio

After transcription, run the transcribed text through the RASP prompt injection detector:
```typescript
const rasResult = await promptInjectionDetector.check(transcript);
if (rasResult.score > 0.6) {
  await scoutEmit('voice.prompt.injection', {
    sessionId: this.id,
    transcript,
    score: rasResult.score,
    matchedPatterns: rasResult.patterns,
  });
  // Block the utterance - respond with "I didn't catch that"
  await this.transport.sendAudio(await tts("Sorry, I couldn't process that request."));
  return;
}
```

### 4. PSTN call screening

For Twilio PSTN calls, screen the incoming number:
```typescript
export async function screenPstnCall(fromNumber: string, tenantId: string): Promise<'allow' | 'block'> {
  // Check blocklist
  const blocked = await db.query('SELECT 1 FROM pstn_blocklist WHERE number = $1 AND tenant_id = $2', [fromNumber, tenantId]);
  if (blocked.rows.length > 0) {
    await scoutEmit('voice.pstn.unknown', { fromNumber, reason: 'blocklisted', tenantId });
    return 'block';
  }

  // Check if number is in contacts allowlist (optional mode: allowlist-only)
  const isAllowlistMode = await getOrgConfig(tenantId, 'pstn_allowlist_only');
  if (isAllowlistMode) {
    const allowed = await db.query('SELECT 1 FROM pstn_allowlist WHERE number = $1 AND tenant_id = $2', [fromNumber, tenantId]);
    if (allowed.rows.length === 0) {
      await scoutEmit('voice.pstn.unknown', { fromNumber, reason: 'not-in-allowlist', tenantId });
      return 'block';
    }
  }

  return 'allow';
}
```

### 5. Voice anomaly detection

Detect unusual voice session patterns:
```typescript
// Detect dead-air attacks: repeated empty transcripts
let emptyTranscriptCount = 0;
function onTranscript(text: string): void {
  if (!text.trim()) {
    emptyTranscriptCount++;
    if (emptyTranscriptCount >= 5) {
      scoutEmit('voice.transcript.empty', { sessionId, count: emptyTranscriptCount });
      closeSession('dead-air-suspected');
    }
  } else {
    emptyTranscriptCount = 0;
  }
}

// Detect extremely long sessions (possible forgotten open mic)
const SESSION_MAX_MINUTES = 60;
setTimeout(() => {
  if (this.isActive) {
    scoutEmit('voice.session.end', { sessionId, reason: 'max-duration-exceeded' });
    closeSession('timeout');
  }
}, SESSION_MAX_MINUTES * 60000);
```

### 6. Voice events in Scout dashboard

Add a "Voice" filter to the Scout event feed in `console.labyrinthscout.com/public/dashboard.html`:
- Filter button: [All] [Security] [Voice] [Auth]
- Voice events show with a mic icon indicator in the feed
- Prompt injection events are highlighted in red

## Verification Checklist

- [ ] Starting a voice session emits `voice.session.start` to Scout
- [ ] Transcript containing "ignore all previous instructions" triggers `voice.prompt.injection` event
- [ ] Blocked PSTN number gets rejected (TwiML returns busy tone) and `voice.pstn.unknown` emitted
- [ ] 5 empty transcripts in a row closes the session and emits `voice.transcript.empty`
- [ ] Voice events appear in Scout dashboard under Voice filter

## Files to Create or Modify

- MODIFY `src/gateway/voice-gateway-session.ts` - emit Scout events at key points
- MODIFY `src/api/telephony.ts` - add PSTN call screening
- CREATE `src/gateway/voice-anomaly-detector.ts`
- MODIFY `console.labyrinthscout.com/public/dashboard/js/widgets/event-feed.js` - add voice filter
- MODIFY `docker/postgres/init.sql` - add pstn_blocklist and pstn_allowlist tables
