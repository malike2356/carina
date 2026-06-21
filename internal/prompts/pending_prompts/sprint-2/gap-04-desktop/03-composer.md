# Gap 04 - Prompt 03: Desktop Composer

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.


**Agent:** Cursor (fallback: Claude Code)
**Estimated hours:** 4-5 hrs
**Depends on:** 01-tauri-scaffold.md done, 02-chat-engine.md done

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

```
carina-desktop/src/components/chat/        (from 02-chat-engine.md)
carina-desktop/src/store/                  (nanostores atoms)
carina-desktop/src/lib/gateway-client.ts   (RPC methods)
core.carinaai.uk/src/cli/registry.ts       (24KB - existing slash commands to expose)
hermes-agent/apps/desktop/src/app/chat/composer/index.tsx
hermes-agent/apps/desktop/src/app/chat/composer/hooks/use-slash-completions.ts
hermes-agent/apps/desktop/src/app/chat/composer/hooks/use-mic-recorder.ts
```

---

## What Exists

```
carina-desktop/
  src/components/chat/   (MessageList, AssistantMessage, StreamingMessage, etc.)
  src/store/             (chat.ts, session.ts, connection.ts)
  src/lib/gateway-client.ts
```

## What to Build

A full-featured composer at `src/components/composer/` covering:
- Rich text input with slash command autocomplete
- @-mention autocomplete
- Voice recording
- File drag-and-drop + attachment previews
- Draft persistence
- Queue panel for batched sends

---

## Implementation

### 1. Composer Root (`src/components/composer/Composer.tsx`)

Main composer wrapper. Owns the input state, coordinates all sub-components.

```tsx
interface ComposerProps {
  sessionId: string;
  onSubmit: (content: string, attachments: Attachment[]) => void;
  disabled?: boolean;
}

// State:
// - text: string (controlled input value)
// - attachments: Attachment[] (files/URLs queued)
// - voiceRecording: boolean
// - queuedMessages: string[] (batch queue)
// - showSlashMenu: boolean
// - showAtMenu: boolean
// - slashQuery: string
// - atQuery: string

// Draft persistence: on every text change,
//   localStorage.setItem(`carina-draft-${sessionId}`, text)
// On mount: restore from localStorage

// Submit logic:
//   - single mode: call onSubmit immediately
//   - queue mode: push to queuedMessages[], show queue panel
```

### 2. Input Area (`src/components/composer/ComposerInput.tsx`)

Contenteditable div (not textarea) for rich behavior:

```tsx
// Use a contenteditable div with:
// - onKeyDown: Enter = submit (prevent default), Shift+Enter = newline
// - onInput: detect '/' at word start → setShowSlashMenu(true), setSlashQuery(text after /)
// - onInput: detect '@' at word start → setShowAtMenu(true), setAtQuery(text after @)
// - onInput: update draft localStorage
// - onPaste: strip HTML, plain text only (unless file paste → add to attachments)
// - Placeholder text: "Message Carina... (/ for commands, @ to mention)"
// - Auto-resize: increase height as content grows, max 200px then scroll

// On slash menu item selected: replace /query with the selected command trigger
// On @ menu item selected: replace @query with @mention-name
```

### 3. Slash Command Autocomplete (`src/components/composer/SlashMenu.tsx`)

```tsx
// Props: query: string, onSelect: (command: SlashCommand) => void, onClose: () => void

// Data source: call gateway-client.getCommands() on mount, cache in store
// Filter: fuzzy match query against command.name and command.description
// Limit displayed: max 8 items, scroll if more

// Each item shows:
//   /<name>   <description>   [category badge]

// Keyboard: ArrowUp/Down navigate, Enter selects, Escape closes
// Position: floating panel above the input (bottom-anchored)

// Categories to show (from cli/registry.ts):
//   Built-ins (always shown at top): /new, /resume, /model, /help
//   Skills: skills loaded from gateway
//   Quick commands: /search, /memory, /task, /research
```

Hook: `src/hooks/use-slash-completions.ts`

```typescript
// Fetches commands from gateway, caches for 5 minutes
// Returns: { commands: SlashCommand[], loading: boolean }
// Filter function: fuzzyFilter(commands, query) → sorted results
```

### 4. @-Mention Autocomplete (`src/components/composer/AtMenu.tsx`)

```tsx
// Mention targets:
//   sessions:  @session-name → links to session
//   agents:    @subagent-name → references active subagent
//   skills:    @skill-name → references installed skill

// Fetch from gateway:
//   GET /sessions → list sessions for mention
//   GET /agents/active → list running agents
//   GET /skills → list installed skills

// Display: avatar/icon + name + type badge
// On select: insert @name as a styled span (visual highlight, plain text on submit)
```

### 5. Voice Recorder (`src/components/composer/VoiceRecorder.tsx`)

```tsx
// Mic button in composer toolbar
// On click: start recording via Tauri audio (or Web Audio API in webview)
// Recording state: animated red ring around mic icon, elapsed timer
// On stop: transcribe via gateway (POST /voice/transcribe with audio blob)
// On transcript received: insert text into composer input
// On error: show "Voice not available" tooltip

// useMediaRecorder hook:
//   navigator.mediaDevices.getUserMedia({ audio: true })
//   MediaRecorder → collect chunks → Blob on stop
//   Send blob to gateway transcription endpoint
```

### 6. Attachments (`src/components/composer/AttachPanel.tsx` + `AttachmentPreview.tsx`)

```tsx
// Trigger: paperclip button OR drag-and-drop onto composer area

// Attachment types:
//   file:  accept any file, show name + size + type icon
//   image: show thumbnail preview
//   url:   input dialog → fetch title/og-image for preview

// On file drop (Tauri file drop event):
//   listen for tauri://file-drop event
//   add dropped files to attachments[]
//   show AttachPanel with previews

// AttachmentPreview: 
//   image: thumbnail (max 80x80)
//   file:  icon + filename + size
//   url:   favicon + domain + page title
//   remove button (x) on each

// On submit: include attachments in the message payload
//   gateway-client.submitPrompt(text, { attachments: [...] })
```

Drop zone indicator:
```tsx
// src/components/composer/DropOverlay.tsx
// Shows when file is dragged over the window
// Full-window overlay: "Drop to attach"
// Use Tauri's onFileDropHover / onFileDropCancelled events
```

### 7. Queue Panel (`src/components/composer/QueuePanel.tsx`)

```tsx
// Activated by: toolbar button or keyboard shortcut (Ctrl+Q)
// When active: Enter adds to queue instead of sending
// Queue panel shows: ordered list of queued messages
//   - drag to reorder
//   - click to edit
//   - x to remove
// "Send All" button: sends queued messages sequentially with 500ms delay between
// "Clear" button: empty queue
// Message count badge on queue button when items queued
```

### 8. Context Menu (`src/components/composer/ContextMenu.tsx`)

Right-click on the composer input:
```
Cut
Copy
Paste
──────────
Clear draft
──────────
Enable queue mode
Toggle voice input
```

### 9. URL Dialog (`src/components/composer/UrlDialog.tsx`)

```tsx
// Triggered by: link icon in toolbar
// Modal with URL input
// On submit:
//   1. Fetch URL metadata (title, description, favicon) via gateway
//   2. Add to attachments as type: 'url'
//   3. Optionally: insert URL inline in text too
```

### 10. Toolbar (`src/components/composer/ComposerToolbar.tsx`)

```tsx
// Left side:
//    Attach file (opens file dialog)
//    Attach URL (opens UrlDialog)
//    Voice record
//    Queue mode toggle

// Right side:
//   Character/token count
//   ▶ Send button (disabled when empty)
//   Ctrl+Enter tooltip

// Keyboard shortcuts:
//   Enter = send
//   Shift+Enter = newline
//   Ctrl+/ = focus slash menu
//   Ctrl+Q = toggle queue
//   Ctrl+M = toggle mic
//   Escape = close any open menu
```

---

## Files to Create

```
carina-desktop/src/
├── components/composer/
│   ├── Composer.tsx              (root composer with all sub-components)
│   ├── ComposerInput.tsx         (contenteditable input)
│   ├── ComposerToolbar.tsx       (toolbar with buttons)
│   ├── SlashMenu.tsx             (slash command autocomplete popover)
│   ├── AtMenu.tsx                (@-mention autocomplete popover)
│   ├── VoiceRecorder.tsx         (mic button + recording state)
│   ├── AttachPanel.tsx           (attachment list with previews)
│   ├── AttachmentPreview.tsx     (single attachment item)
│   ├── DropOverlay.tsx           (full-window file drop indicator)
│   ├── QueuePanel.tsx            (message queue panel)
│   ├── ContextMenu.tsx           (right-click menu)
│   └── UrlDialog.tsx             (URL attachment dialog)
└── hooks/
    ├── use-slash-completions.ts  (fetch + cache + filter commands)
    ├── use-at-completions.ts     (fetch sessions/agents/skills)
    ├── use-voice-recorder.ts     (media recorder hook)
    └── use-file-drop-zone.ts     (Tauri file drop events)
```

## Files to Modify

```
carina-desktop/src/app/chat/ChatPage.tsx   → replace placeholder input with <Composer>
carina-desktop/src/store/chat.ts           → add draft: string, queue: string[], attachments: Attachment[]
```

---

## Done When

- [ ] Typing "/" shows slash menu with filtered commands from gateway
- [ ] Selecting a slash command inserts trigger text into composer
- [ ] Typing "@" shows mention menu with sessions/agents/skills
- [ ] Draft text survives app reload (localStorage persistence)
- [ ] Dragging a file onto the window shows drop overlay and adds to attachments
- [ ] Voice button records, transcribes, and inserts text
- [ ] Queue mode accumulates messages and sends them in order
- [ ] Enter sends, Shift+Enter newlines
- [ ] Submit includes attachment payload in gateway call