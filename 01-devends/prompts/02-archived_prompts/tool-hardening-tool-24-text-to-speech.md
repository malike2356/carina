# Cursor Task: Fix and test text-to-speech (#24) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are hardening the 27 Hermes tools one by one. This task covers tool #24:
`text-to-speech`.

Read these files in full before touching anything:
- `src/tools/text-to-speech.ts` (the only source file to change)
- `src/utils/tts.ts` (read only - understand what `generateSpeech` throws)

Do NOT modify any file except `src/tools/text-to-speech.ts` and the new test file.

---

## Bug: `generateSpeech` can throw but there is no try/catch

The `execute` function calls `generateSpeech(text)` which throws in several
well-documented cases: the TTS provider is unsupported, `edge-tts` CLI is not
installed, the OpenAI API returns an error, or the file system write fails.

Because there is no try/catch in `execute`, any of these errors propagates out as
an unhandled rejection instead of returning `{ error: string }`.

### Fix: wrap `generateSpeech` in try/catch

```typescript
execute: async (params) => {
  const text = String(params.text ?? '').trim();
  if (!text) return { error: 'text is required.' };
  try {
    const { filePath } = await generateSpeech(text);
    return { media: filePath, format: 'mp3', message: `MEDIA: ${filePath}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
},
```

That is the only code change in `text-to-speech.ts`.

---

## Improvement: update the description

Replace the current description with:

```
'Convert text to speech and return a path to the generated MP3. Provider is set by config.tts.provider: "edge" uses the edge-tts CLI (pip3 install edge-tts) with the voice from config.tts.voice; "openai" uses OpenAI tts-1 with the nova voice. Text is cleaned (markdown stripped) and truncated to 4000 characters before synthesis. Returns { media, format, message } where message starts with "MEDIA:" so Telegram and other media-capable channels deliver it as an audio file. Returns { error } if the provider is misconfigured or the CLI is not installed.'
```

---

## Create `src/tools/text-to-speech.test.ts`

No test file exists. Create it. Mock `../utils/tts.js` using `vi.hoisted`.

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { generateSpeechMock } = vi.hoisted(() => {
  const generateSpeechMock = vi.fn();
  return { generateSpeechMock };
});

vi.mock('../utils/tts.js', () => ({
  generateSpeech: generateSpeechMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('text-to-speech tool', () => {
  it('returns error when text is empty', async () => {
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: '' }) as { error?: string };
    expect(result.error).toBe('text is required.');
    expect(generateSpeechMock).not.toHaveBeenCalled();
  });

  it('returns error when text is whitespace only', async () => {
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: '   ' }) as { error?: string };
    expect(result.error).toBe('text is required.');
  });

  it('returns media path on success', async () => {
    generateSpeechMock.mockResolvedValue({
      filePath: 'data/tts/abc123.mp3',
      cleanup: vi.fn(),
    });
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: 'Hello world' }) as {
      media?: string;
      format?: string;
      message?: string;
    };
    expect(result.media).toBe('data/tts/abc123.mp3');
    expect(result.format).toBe('mp3');
    expect(result.message).toMatch(/^MEDIA:/);
  });

  it('calls generateSpeech with the trimmed input text', async () => {
    generateSpeechMock.mockResolvedValue({ filePath: 'data/tts/x.mp3', cleanup: vi.fn() });
    const { textToSpeechTool } = await import('./text-to-speech.js');
    await textToSpeechTool.execute({ text: '  hello  ' });
    expect(generateSpeechMock).toHaveBeenCalledWith('hello');
  });

  it('returns error when generateSpeech throws (edge-tts not installed)', async () => {
    generateSpeechMock.mockRejectedValue(
      new Error('TTS generation failed: edge-tts CLI not found. Run: pip3 install edge-tts'),
    );
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: 'hello' }) as { error?: string };
    expect(result.error).toContain('edge-tts');
  });

  it('returns error when generateSpeech throws (unsupported provider)', async () => {
    generateSpeechMock.mockRejectedValue(new Error('Unsupported TTS provider: whisper'));
    const { textToSpeechTool } = await import('./text-to-speech.js');
    const result = await textToSpeechTool.execute({ text: 'hello' }) as { error?: string };
    expect(result.error).toContain('Unsupported TTS provider');
  });
});
```

---

## What NOT to change

- Do not change `src/utils/tts.ts`.
- Do not change the parameter schema.
- Do not add `dangerous: true` or `requiresConfirmation` - this tool has neither.

---

## General rules

- TypeScript only. No `any` unless unavoidable.
- No em dashes, no emojis anywhere.
- Run `npx tsc --noEmit` after changes and fix all errors before moving on.

---

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/text-to-speech.test.ts` - all 6 tests pass
- [ ] `generateSpeech` call in `execute` is wrapped in try/catch returning `{ error: string }`
- [ ] Description updated
- [ ] Regression: `npx vitest run src/tools/send-message.test.ts src/tools/cronjob.test.ts src/tools/code.test.ts` - all pass
