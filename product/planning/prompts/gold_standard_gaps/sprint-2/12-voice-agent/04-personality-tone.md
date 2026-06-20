# Prompt 04: Voice Personality and Tone Engine

## Context

Phase 4 of the voice roadmap. Voice interactions have different requirements than text:
responses must be shorter, more conversational, and free of markdown/code blocks.
The personality engine adapts Carina's output to the voice context.

## What to Build

### 1. Voice mode system prompt overlay

Create `src/agents/voice-overlay.ts`:
```typescript
export const VOICE_MODE_OVERLAY = `
VOICE MODE ACTIVE. Respond as if speaking, not writing.
Rules:
- Never use markdown formatting (no **, no #, no code blocks, no lists with -/*)
- Keep responses under 3 sentences unless specifically asked for detail
- Speak numbers naturally: "twenty three" not "23" for context, but "twenty-three percent" for data
- Spell out abbreviations: "CVE" becomes "C V E", "URL" becomes "you are el"
- Avoid technical jargon unless the user used it first
- Use natural connectors: "Got it,", "Sure,", "Here's what I found:"
- Never say "Certainly!" or "Of course!" - respond directly
- End with a brief question if clarification would help, otherwise end cleanly
`;
```

Apply this overlay when `channel === 'voice'`:
```typescript
if (session.channel === 'voice') {
  systemPrompt = `${systemPrompt}\n\n${VOICE_MODE_OVERLAY}`;
}
```

### 2. Response post-processor

Strip markdown from voice responses that accidentally include formatting:
```typescript
export function stripMarkdownForVoice(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')           // headers
    .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
    .replace(/\*(.+?)\*/g, '$1')           // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // code blocks and inline code
    .replace(/^\s*[-*+]\s+/gm, '')         // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '')         // ordered lists
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> just text
    .replace(/\n{3,}/g, '\n\n')            // excessive newlines
    .trim();
}
```

### 3. Voice persona

Voice persona is distinct from text mode - warmer and more conversational:
```typescript
export const VOICE_PERSONA = {
  name: 'Carina',
  greeting: {
    morning: "Good morning, ready when you are.",
    afternoon: "Afternoon. How can I help?",
    evening: "Good evening. What do you need?",
  },
  acknowledgements: ['Got it', 'Sure', 'On it', 'All right', 'Here you go'],
  thinking: ['Let me check', 'One moment', 'Looking that up'],
  error: "I didn't quite catch that, could you say it again?",
  noResult: "I couldn't find anything on that. Want me to try a different approach?",
};
```

### 4. Speaking speed and pause injection

For ElevenLabs, inject SSML-like timing hints for natural pauses:
```typescript
export function formatForTts(text: string): string {
  // Add brief pause after sentences
  return text.replace(/([.!?]) ([A-Z])/g, '$1 $2');
}
```

When the agent is "thinking" (waiting for tool response), play an audio indicator:
```typescript
if (toolCallPending) {
  await playThinkinAudio(); // pre-generated 1-second "hmm" or tone
}
```

### 5. Voice response length limiting

If the agent response is over 200 words in voice mode, truncate and offer to continue:
```typescript
export function truncateVoiceResponse(text: string, wordLimit = 200): string {
  const words = text.split(/\s+/);
  if (words.length <= wordLimit) return text;

  const truncated = words.slice(0, wordLimit).join(' ');
  return `${truncated}... I have more detail. Want me to continue?`;
}
```

## Verification Checklist

- [ ] Voice session response contains no markdown formatting (no **, no #)
- [ ] Response is under 3 sentences for a simple factual question
- [ ] `stripMarkdownForVoice("**Hello** [world](url)")` returns "Hello world"
- [ ] Voice greeting matches time of day: "Good morning" before noon, "Good evening" after 6 PM
- [ ] Response over 200 words is truncated with continuation offer

## Files to Create or Modify

- CREATE `src/agents/voice-overlay.ts`
- CREATE `src/agents/voice-post-processor.ts` (stripMarkdownForVoice, truncateVoiceResponse, formatForTts)
- MODIFY `src/agents/CarinaAgent.ts` - apply voice overlay when channel === 'voice'
- MODIFY `src/api/voice.ts` - run post-processor on agent response before TTS
- CREATE `carinaMobile/src/audio/thinking-audio.ts` - play thinking indicator
