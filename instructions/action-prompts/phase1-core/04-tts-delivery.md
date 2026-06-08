# Action: Text-to-Speech Delivery (New Feature, Standalone Carina)

## Goal
Build a text-to-speech module that converts Carina's text replies into MP3 audio using the `edge-tts` CLI, with a Telegram delivery path, so users can receive spoken versions of long-form output (e.g. briefings, summaries).

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports (`.js` specifiers), pnpm, Vitest.
- This is a genuine gap: there is currently NO text-to-speech code anywhere in this repo (`grep -ri 'tts\|edge-tts\|speech' src/` returns nothing except an unrelated UI string). The original Laravel spec (`TextToSpeechService.php`) does not apply - build this fresh, in TypeScript, following this project's conventions.
- Conventions to mirror (read these files first):
  - `src/tools/shell.ts` - shows the project's pattern for spawning external processes, logging to `data/logs/*.log` via `fs/promises` + `path.dirname` + `mkdir(... { recursive: true })`, and timeout handling
  - `src/tools/sandbox.ts` - shows `python3 -c '...'` style invocation with `escaped` shell-arg handling - mirror this care around shell-escaping for the `edge-tts` invocation (use `execFile`, NOT `exec`, so arguments are never shell-interpolated; this avoids needing `escapeshellarg`-style escaping entirely)
  - `src/gateway/router.ts` - shows `uuidv4()` from the `uuid` package for generating unique IDs (use this for output filenames, exactly as the old spec wanted: `{uuid}.mp3`)
  - `src/config/index.ts` - add a `tts` config block here following the existing pattern (see `telegram`/`resend` blocks): `provider` (default `'edge'`), `voice` (default `'en-GB-SoniaNeural'`), read from `TTS_PROVIDER` / `TTS_VOICE` env vars
- Functions under ~20 lines, classes under ~200 lines, no comments unless explaining non-obvious WHY, Vitest, no em dashes/emojis.

## Files to create
- `src/utils/tts.ts` - the TTS generation module
- `src/utils/tts.test.ts` - Vitest tests
- `data/tts/` - output directory (create via `mkdir(..., { recursive: true })` at generation time, same as `shell.ts` does for `data/logs`; do not commit a placeholder, the directory is created at runtime)

## Files to modify
- `src/config/index.ts` - add the `tts` config block described above
- `.env.production.example` - document `TTS_PROVIDER` and `TTS_VOICE`
- `src/gateway/telegram.ts` - add an audio delivery helper (see step 5)
- `package.json` - no new npm dependency needed; `edge-tts` is a Python CLI tool (`pip3 install edge-tts`), document this as a system dependency in the module's top-level comment-free design (put it in README/docs, not a code comment)

## Step-by-step

1. Create `src/utils/tts.ts` exporting an async function `generateSpeech(text: string): Promise<{ filePath: string; cleanup: () => Promise<void> }>`:
   - Clean the input text first (see step 2) before passing it to the CLI.
   - Generate `const id = uuidv4()` and `const filePath = path.join('data', 'tts', `${id}.mp3`)`.
   - Ensure the directory exists: `await fs.mkdir(path.dirname(filePath), { recursive: true })`.
   - Spawn `edge-tts` via Node's `child_process.execFile` (promisified with `util.promisify` or `node:util`'s `promisify(execFile)`), with arguments as an array - NEVER string-interpolate the text into a shell command:
     ```ts
     await execFileAsync('edge-tts', ['--voice', config.tts.voice, '--text', cleaned, '--write-media', filePath], { timeout: 30_000 });
     ```
   - On failure (CLI missing, non-zero exit, timeout), throw a clear `Error` (e.g. `'TTS generation failed: edge-tts CLI not found - run: pip3 install edge-tts'` if `ENOENT`).
   - Return `{ filePath, cleanup: () => fs.rm(filePath, { force: true }) }` so callers can always clean up, mirroring the "best-effort cleanup, never crash" pattern described in the original spec.

2. Implement text cleaning as a separate, independently-testable function `cleanForSpeech(text: string): string`:
   - Strip markdown symbols: `*`, `_`, `` ` ``, `#` (use a single regex pass, e.g. `text.replace(/[*_`#]/g, '')`)
   - Replace bullet markers (`-`, `•`, numbered list prefixes like `1.`) at line starts with `, ` so the speech flows naturally
   - Collapse repeated whitespace/newlines into single spaces
   - Truncate to 4000 characters max (edge-tts / Telegram audio practical limit) - truncate at a word boundary, not mid-word
   - This function takes a plain string and returns a plain string - no I/O, trivially testable without mocks

3. Add the `tts` block to `src/config/index.ts`:
   ```ts
   tts: {
     provider: process.env.TTS_PROVIDER ?? 'edge',
     voice: process.env.TTS_VOICE ?? 'en-GB-SoniaNeural',
   },
   ```
   Place it alongside the other service config blocks (near `telegram`/`resend`), following the exact same object-literal style already used there.

4. Guard the whole feature behind `config.tts.provider`. If a future provider is added (`openai`, `elevenlabs`), `generateSpeech` should branch on `config.tts.provider` - for Phase 1, only implement `'edge'` and throw `Error('Unsupported TTS provider: ${provider}')` for anything else. This keeps the module open to extension without speculative abstraction (no factory classes for a single implementation).

5. Add a delivery helper to `src/gateway/telegram.ts` (or a new small `src/gateway/telegram-audio.ts` if `telegram.ts` is already at its size limit - check its current line count first and keep functions under ~20 lines):
   - `async function sendSpokenReply(bot: TelegramBot, chatId: number, text: string, caption?: string): Promise<void>`
   - Calls `generateSpeech`, then `bot.sendAudio(chatId, filePath, { caption })`, then ALWAYS calls `cleanup()` in a `finally` block (audio failure must never crash the caller - wrap the whole thing in `try { ... } catch (err) { console.warn(...) }` so a TTS failure degrades to "text was already sent, audio silently skipped", matching the "audio is best-effort" requirement from the original spec).
   - Do not wire this into every message - it should be an opt-in helper that other features (e.g. a future scheduled-briefing feature, see `03-daily-briefing.md`) can call. Do not add a `/speak` command or auto-TTS-everything in this prompt; that's scope creep beyond "build the TTS module and a delivery path."

6. Write `src/utils/tts.test.ts` (Vitest, mirror `src/tools/http.test.ts` conventions):
   - Test `cleanForSpeech` strips markdown symbols, converts bullets to commas, collapses whitespace, and truncates at 4000 chars on a word boundary (no mocks needed - pure function).
   - Test `generateSpeech` by mocking `child_process.execFile` (via `vi.mock('node:child_process', ...)` or by injecting the exec function) - test the success path returns `{ filePath, cleanup }`, the `ENOENT` path throws the "CLI not found" message, and `cleanup()` removes the file.
   - Do NOT make tests depend on the real `edge-tts` binary being installed - that belongs in a manual/integration check, not the unit suite that CI runs.

## Expected behavior
- `generateSpeech("Good morning. Your day looks clear.")` produces a valid MP3 at `data/tts/{uuid}.mp3` using the `en-GB-SoniaNeural` voice.
- Calling `cleanup()` removes the file; nothing accumulates in `data/tts/` after normal use.
- `sendSpokenReply` delivers ONLY audio with a caption (the caller is responsible for sending text separately if both are wanted), and never throws even if `edge-tts` is missing or fails - it should log a warning and return silently.
- Markdown-heavy text (bullet lists, headers, bold) is converted into natural-sounding spoken text, not read aloud literally ("asterisk asterisk hello asterisk asterisk").

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/utils/tts.test.ts
pnpm test
pnpm build
```
Manual check (requires `pip3 install edge-tts`):
```bash
node -e "
import('./dist/utils/tts.js').then(async ({ generateSpeech }) => {
  const { filePath, cleanup } = await generateSpeech('Good morning. Your portfolio looks healthy today.');
  console.log('Generated:', filePath);
  await cleanup();
});
"
# Play the MP3 before cleanup runs (comment out the cleanup() call temporarily to listen)
```

## Dependencies
- `edge-tts` Python CLI installed on the host (`pip3 install edge-tts`) - this is a system dependency, not an npm package; document it in the relevant README/setup docs
- `TTS_PROVIDER=edge` and `TTS_VOICE=en-GB-SoniaNeural` set in `.env` (defaults cover this if unset)
- `uuid` package (already a dependency - confirmed in `package.json`)
- No new npm packages required (uses Node's built-in `child_process`/`fs`)
