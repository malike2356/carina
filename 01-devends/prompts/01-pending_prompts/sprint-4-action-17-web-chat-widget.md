# Sprint 4 - Prompt 17: Embeddable Web Chat Widget

**Sprint:** 4
**Prompt number:** 17
**Primary agent:** Claude Code (backend + widget bundle) + Cursor (snippet UI in portal)
**Estimated hours:** 8-10 h
**Depends on:** 12-channel-infrastructure.md must be merged; the widget is the `web` channel adapter

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/action/`.

---

## Read First

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - `logActivity`, `processAivaMessage` or equivalent; widget calls these
2. `backends/servers/core.carinaai.uk/src/db/migrations/` - find the highest-numbered migration to know which file to add the `widget_sessions` table to
3. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/workers/[id]/AivaDetailClient.tsx` - the Channels tab; you will add the embed snippet here
4. `backends/servers/core.carinaai.uk/src/server.ts` - where to mount the static widget.js route and the `/api/widget/*` router

---

## Context

The web chat widget is a self-contained JavaScript bundle that workspace customers paste on their
own website with a single `<script>` tag. It renders a floating launcher button in the bottom-right
corner. Clicking it opens a branded chat panel. Messages go to the Aiva brain; responses stream
back token by token.

The widget runs on arbitrary third-party websites. It must not conflict with the host page's CSS
or JavaScript. Shadow DOM is mandatory for isolation. The bundle has zero external dependencies and
is built with Vite to a single IIFE file.

---

## Step 1: Database - widget_sessions table

Add to the next available migration file:

```sql
CREATE TABLE IF NOT EXISTS widget_sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id      UUID        NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id   UUID        NOT NULL,
  session_token  TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  contact_id     TEXT        NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON widget_sessions(session_token);
CREATE INDEX ON widget_sessions(worker_id, last_active_at DESC);
```

`contact_id` is the stable anonymous identifier for this visitor within the channel threading
system. It persists for the life of the session token (stored in `localStorage` on the visitor's
browser).

---

## Step 2: Core backend - widget API routes

Create `src/widget/widget-router.ts`. Mount at `/api/widget` in `server.ts`.

Apply `cors({ origin: '*' })` to every route in this router and NOWHERE ELSE. Do not apply
wildcard CORS globally.

```
GET  /api/widget/:workerId/config          Public; returns display config
POST /api/widget/:workerId/session         Create or resume a visitor session
POST /api/widget/:workerId/message         Send message, stream SSE response
```

**`GET /api/widget/:workerId/config`:**

```typescript
// No auth, no session required.
// Returns the display configuration for this Aiva's widget.
// Reads from ai_workers.settings JSONB column under key 'widget' if present; falls back to defaults.
// Returns: {
//   workerName: string,         -- e.g. "Aria"
//   workerRole: string,         -- e.g. "Customer service"
//   welcomeMessage: string,     -- default: "Hi! How can I help you today?"
//   accentColor: string,        -- hex, default '#1a5f7a' (Carina teal)
//   workspaceName: string,
//   poweredByLabel: string,     -- default: 'Powered by VERLOX'
// }
// If workerId does not exist OR ai_workers.status != 'active': return 404.
// This prevents the widget from rendering for paused or dismissed Aivas.
```

**`POST /api/widget/:workerId/session`:**

```typescript
// Body: { sessionToken?: string }
// If sessionToken provided: look up existing widget_sessions row.
//   If found and worker_id matches: UPDATE last_active_at; return existing token.
//   If not found: create new session (token provided may have expired; ignore it).
// If no sessionToken: create new session.
// UPDATE ai_workers.settings to note last widget_session_at (optional, for analytics).
// Returns: { sessionToken: string, workerName: string, expiresAt: string }
// Rate limit: 10 session creates per IP per hour.
```

**`POST /api/widget/:workerId/message`:**

```typescript
// Body: { sessionToken: string; message: string }
// Returns: text/event-stream
//
// 1. Validate session token against widget_sessions WHERE worker_id = $workerId
// 2. Rate limit: 20 messages per session per hour (in-memory counter per sessionToken)
//    On breach: send SSE error event and end stream.
// 3. Set SSE headers: Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive
// 4. res.flushHeaders() before any async work (so the browser sees the stream immediately)
// 5. Log inbound: logActivity({ workerId, workspaceId, actionType: 'message_received',
//                               summary: message.slice(0,200), contactId: session.contactId, channel: 'web' })
// 6. Stream response from Aiva brain:
//    - If processAivaMessageStream exists: pipe tokens as SSE events
//    - Otherwise: wrap processAivaMessage in an async generator that yields the full response once
// 7. Each token: res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
// 8. On complete: res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`); res.end()
// 9. Log outbound: logActivity({ actionType: 'message_sent', summary: fullResponse.slice(0,200), ... })
// 10. On any error: res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong.' })}\n\n`); res.end()
//
// CORS: wildcard origin already set by router-level cors() middleware
```

---

## Step 3: Serve the built widget bundle

In `server.ts`, serve the built bundle at a stable URL:

```typescript
app.use('/widget.js', express.static(
  path.join(__dirname, '../widget/dist/widget.js'),
  {
    maxAge: '1h',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/javascript');
    },
  }
));
```

The embed URL is: `https://core.carinaai.uk/widget.js`

Add to `deploy-core.sh` after the backend build step:
```bash
cd "$REPO_DIR/frontends/widget" && npm ci && npm run build
rsync -a "$REPO_DIR/frontends/widget/dist/" "$RELEASE_DIR/widget/dist/"
```

---

## Step 4: Widget bundle - project structure

Create `frontends/widget/`:

```
frontends/widget/
  src/
    index.ts          Auto-init entry point
    widget.ts         CarinaWidget class (logic)
    ui.ts             Shadow DOM construction and CSS
    api.ts            fetch wrappers for backend
    store.ts          localStorage session persistence
  package.json
  tsconfig.json
  vite.config.ts
```

`package.json`:
```json
{
  "name": "carina-widget",
  "private": true,
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.4.0"
  }
}
```

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CarinaWidget',
      fileName: 'widget',
      formats: ['iife'],
    },
    minify: true,
    outDir: 'dist',
  },
});
```

---

## Step 5: `src/index.ts` - auto-init

```typescript
import { CarinaWidget } from './widget';

const script = document.currentScript as HTMLScriptElement | null;
const workerId = script?.dataset.aivaId ?? (window as Record<string, unknown>).CARINA_AIVA_ID as string;

if (workerId) {
  const overrides: Record<string, string> = {};
  if (script?.dataset.accentColor) overrides.accentColor = script.dataset.accentColor;
  if (script?.dataset.widgetName)  overrides.widgetName  = script.dataset.widgetName;

  const widget = new CarinaWidget(workerId, {
    apiBase: 'https://core.carinaai.uk',
    overrides,
  });
  widget.init();
}
```

Data attributes on the script tag override the config from the API (used by white-label customers
in prompt 28):
```html
<script src="https://core.carinaai.uk/widget.js"
  data-aiva-id="[workerId]"
  data-accent-color="#0f766e"
  data-widget-name="Support">
</script>
```

---

## Step 6: `src/api.ts`

```typescript
export interface WidgetConfig {
  workerName: string;
  workerRole: string;
  welcomeMessage: string;
  accentColor: string;
  poweredByLabel: string;
}

export async function fetchConfig(apiBase: string, workerId: string): Promise<WidgetConfig | null> {
  try {
    const res = await fetch(`${apiBase}/api/widget/${workerId}/config`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function createSession(
  apiBase: string,
  workerId: string,
  existingToken: string | null,
): Promise<string | null> {
  try {
    const body = existingToken ? { sessionToken: existingToken } : {};
    const res = await fetch(`${apiBase}/api/widget/${workerId}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sessionToken as string;
  } catch {
    return null;
  }
}

export async function* streamMessage(
  apiBase: string,
  workerId: string,
  sessionToken: string,
  message: string,
): AsyncGenerator<{ type: 'token'; content: string } | { type: 'done' } | { type: 'error'; message: string }> {
  const res = await fetch(`${apiBase}/api/widget/${workerId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, message }),
  });

  if (!res.body) {
    yield { type: 'error', message: 'No response body.' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        yield JSON.parse(line.slice(6));
      } catch {
        // malformed SSE line; skip
      }
    }
  }
}
```

---

## Step 7: `src/store.ts`

```typescript
const KEY = (workerId: string) => `carina_session_${workerId}`;

export function loadToken(workerId: string): string | null {
  try { return localStorage.getItem(KEY(workerId)); }
  catch { return null; }
}

export function saveToken(workerId: string, token: string): void {
  try { localStorage.setItem(KEY(workerId), token); }
  catch { /* storage unavailable */ }
}
```

---

## Step 8: `src/ui.ts` - Shadow DOM and CSS

```typescript
export const WIDGET_STYLES = (accent: string) => `
  :host { all: initial; font-family: system-ui, -apple-system, sans-serif; }

  /* Launcher */
  #launcher {
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    width: 56px; height: 56px; border-radius: 50%;
    background: ${accent};
    border: none; cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,0.20);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  #launcher:hover { transform: scale(1.06); box-shadow: 0 6px 20px rgba(0,0,0,0.26); }
  #launcher:active { transform: scale(0.96); }
  #launcher svg { width: 24px; height: 24px; fill: none; stroke: #fff; stroke-width: 2;
                  stroke-linecap: round; stroke-linejoin: round; transition: opacity 0.15s; }
  #launcher .icon-chat  { opacity: 1; position: absolute; }
  #launcher .icon-close { opacity: 0; position: absolute; }
  #launcher.open .icon-chat  { opacity: 0; }
  #launcher.open .icon-close { opacity: 1; }

  /* Unread badge */
  #unread {
    position: fixed; bottom: 68px; right: 20px; z-index: 2147483647;
    background: #ef4444; color: #fff;
    width: 20px; height: 20px; border-radius: 50%;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  #unread.hidden { display: none; }

  /* Panel */
  #panel {
    position: fixed; bottom: 96px; right: 24px; z-index: 2147483646;
    width: 360px; height: 520px;
    border-radius: 16px; overflow: hidden;
    background: #ffffff; color: #111827;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    display: flex; flex-direction: column;
    opacity: 0; pointer-events: none;
    transform: translateY(12px);
    transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  }
  #panel.open { opacity: 1; pointer-events: all; transform: translateY(0); }

  /* Header */
  #header {
    background: ${accent}; color: #fff;
    padding: 14px 16px 12px;
    display: flex; align-items: center; justify-content: space-between;
    shrink: 0; flex-shrink: 0;
  }
  #header-left { display: flex; align-items: center; gap: 10px; }
  #header-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: #fff; flex-shrink: 0;
  }
  #header-info { line-height: 1.2; }
  #header-name { font-size: 14px; font-weight: 600; }
  #header-role { font-size: 11px; opacity: 0.85; }
  #status-dot {
    display: inline-block; width: 7px; height: 7px; border-radius: 50%;
    background: #4ade80; margin-right: 4px;
    box-shadow: 0 0 0 2px rgba(74,222,128,0.3);
  }
  #close-btn {
    background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer;
    padding: 4px; display: flex; align-items: center; justify-content: center;
    border-radius: 6px; transition: background 0.1s;
  }
  #close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
  #close-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor;
                   stroke-width: 2; stroke-linecap: round; }

  /* Messages */
  #messages {
    flex: 1; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 2px;
    scroll-behavior: smooth;
  }
  #messages::-webkit-scrollbar { width: 4px; }
  #messages::-webkit-scrollbar-track { background: transparent; }
  #messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }

  /* Bubbles */
  .bubble-row { display: flex; flex-direction: column; margin-bottom: 2px; }
  .bubble-row.user  { align-items: flex-end; }
  .bubble-row.aiva  { align-items: flex-start; flex-direction: row; gap: 8px; }

  .bubble {
    max-width: 78%; padding: 10px 14px;
    font-size: 13px; line-height: 1.55;
    word-break: break-word; white-space: pre-wrap;
  }
  .bubble.user {
    background: ${accent}; color: #fff;
    border-radius: 18px 18px 4px 18px;
  }
  .bubble.aiva {
    background: #f3f4f6; color: #111827;
    border-radius: 18px 18px 18px 4px;
  }

  .aiva-avatar {
    width: 24px; height: 24px; border-radius: 50%;
    background: ${accent}20; color: ${accent};
    font-size: 10px; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
  }

  .bubble-ts {
    font-size: 10px; color: #9ca3af; margin-top: 2px;
    padding: 0 4px;
  }
  .bubble-row.user .bubble-ts { text-align: right; }

  /* Typing indicator */
  .typing-bubble {
    background: #f3f4f6; border-radius: 18px 18px 18px 4px;
    padding: 12px 16px;
    display: flex; align-items: center; gap: 5px;
  }
  .typing-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #9ca3af;
    animation: typing-bounce 1.4s ease-in-out infinite;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing-bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40%            { transform: translateY(-6px); opacity: 1; }
  }

  /* System event (escalation / automation) */
  .event-divider {
    display: flex; align-items: center; gap: 8px;
    margin: 10px 0; color: #9ca3af; font-size: 11px;
  }
  .event-divider::before, .event-divider::after {
    content: ''; flex: 1; height: 1px;
    border-top: 1px dashed #e5e7eb;
  }

  /* Input row */
  #input-row {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 12px 12px 12px;
    border-top: 1px solid #f3f4f6;
    background: #fff; flex-shrink: 0;
  }
  #input {
    flex: 1; border: 1px solid #e5e7eb; border-radius: 20px;
    padding: 8px 14px; font-size: 13px; line-height: 1.4;
    outline: none; resize: none; font-family: inherit;
    color: #111827; background: #fff;
    max-height: 96px; overflow-y: auto;
    transition: border-color 0.15s;
  }
  #input:focus { border-color: ${accent}; }
  #input::placeholder { color: #9ca3af; }
  #send {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: 50%;
    background: ${accent}; color: #fff; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, transform 0.1s;
  }
  #send:hover { filter: brightness(1.1); }
  #send:active { transform: scale(0.94); }
  #send svg { width: 16px; height: 16px; fill: none; stroke: #fff;
              stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  #send:disabled { opacity: 0.4; cursor: default; }

  /* Footer */
  #footer {
    text-align: center; font-size: 10px; color: #d1d5db;
    padding: 4px 0 8px; background: #fff; flex-shrink: 0;
    letter-spacing: 0.02em;
  }

  /* Mobile */
  @media (max-width: 480px) {
    #panel { left: 12px; right: 12px; width: auto; bottom: 84px; height: 60vh; max-height: 480px; border-radius: 12px; }
    #launcher { bottom: 16px; right: 16px; }
    #unread  { bottom: 60px; right: 12px; }
  }
`;

export function buildHTML(config: { workerName: string; workerRole: string; poweredByLabel: string }) {
  const initial = config.workerName.charAt(0).toUpperCase();
  return `
    <button id="launcher" aria-label="Chat with ${config.workerName}">
      <!-- Chat icon -->
      <svg class="icon-chat" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <!-- Close icon -->
      <svg class="icon-close" viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    <div id="unread" class="hidden"></div>
    <div id="panel" role="dialog" aria-label="Chat with ${config.workerName}">
      <div id="header">
        <div id="header-left">
          <div id="header-avatar">${initial}</div>
          <div id="header-info">
            <div id="header-name"><span id="status-dot"></span>${config.workerName}</div>
            <div id="header-role">${config.workerRole}</div>
          </div>
        </div>
        <button id="close-btn" aria-label="Close chat">
          <svg viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div id="messages"></div>
      <div id="input-row">
        <textarea id="input" rows="1" placeholder="Type a message..." aria-label="Message"></textarea>
        <button id="send" aria-label="Send">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div id="footer">${config.poweredByLabel}</div>
    </div>
  `;
}
```

---

## Step 9: `src/widget.ts` - CarinaWidget class

```typescript
import { fetchConfig, createSession, streamMessage, WidgetConfig } from './api';
import { loadToken, saveToken } from './store';
import { WIDGET_STYLES, buildHTML } from './ui';

export class CarinaWidget {
  private workerId: string;
  private apiBase: string;
  private overrides: Record<string, string>;
  private config: WidgetConfig | null = null;
  private sessionToken: string | null = null;
  private root: ShadowRoot | null = null;
  private isOpen = false;
  private unreadCount = 0;
  private isSending = false;

  constructor(workerId: string, options: { apiBase: string; overrides?: Record<string, string> }) {
    this.workerId = workerId;
    this.apiBase = options.apiBase;
    this.overrides = options.overrides ?? {};
  }

  async init(): Promise<void> {
    this.config = await fetchConfig(this.apiBase, this.workerId);
    if (!this.config) return; // Aiva not found or not active; render nothing

    // Apply data-attribute overrides
    if (this.overrides.accentColor) this.config.accentColor = this.overrides.accentColor;
    if (this.overrides.widgetName)  this.config.workerName  = this.overrides.widgetName;

    this.sessionToken = loadToken(this.workerId);
    const newToken = await createSession(this.apiBase, this.workerId, this.sessionToken);
    if (newToken) {
      this.sessionToken = newToken;
      saveToken(this.workerId, newToken);
    }

    this.mountUI();
    this.appendAivaMessage(this.config.welcomeMessage);
  }

  private mountUI(): void {
    const host = document.createElement('div');
    host.id = 'carina-widget-host';
    document.body.appendChild(host);
    this.root = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = WIDGET_STYLES(this.config!.accentColor);
    this.root.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML(this.config!);
    while (wrapper.firstChild) this.root.appendChild(wrapper.firstChild);

    this.root.getElementById('launcher')!.addEventListener('click', () => this.toggle());
    this.root.getElementById('close-btn')!.addEventListener('click', () => this.close());
    this.root.getElementById('send')!.addEventListener('click', () => this.handleSend());

    const textarea = this.root.getElementById('input') as HTMLTextAreaElement;
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
    });
    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
    });
  }

  private toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  private open(): void {
    this.isOpen = true;
    this.root!.getElementById('panel')!.classList.add('open');
    this.root!.getElementById('launcher')!.classList.add('open');
    this.clearUnread();
    setTimeout(() => (this.root!.getElementById('input') as HTMLElement).focus(), 200);
  }

  private close(): void {
    this.isOpen = false;
    this.root!.getElementById('panel')!.classList.remove('open');
    this.root!.getElementById('launcher')!.classList.remove('open');
  }

  private clearUnread(): void {
    this.unreadCount = 0;
    const badge = this.root!.getElementById('unread')!;
    badge.classList.add('hidden');
    badge.textContent = '';
  }

  private incrementUnread(): void {
    if (this.isOpen) return;
    this.unreadCount++;
    const badge = this.root!.getElementById('unread')!;
    badge.textContent = String(this.unreadCount);
    badge.classList.remove('hidden');
  }

  private scrollToBottom(): void {
    const msgs = this.root!.getElementById('messages')!;
    msgs.scrollTop = msgs.scrollHeight;
  }

  appendUserMessage(text: string): void {
    const container = this.root!.getElementById('messages')!;
    const row = document.createElement('div');
    row.className = 'bubble-row user';
    row.innerHTML = `
      <div class="bubble user">${this.escapeHtml(text)}</div>
      <div class="bubble-ts">${this.formatTime()}</div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
  }

  appendAivaMessage(text: string): HTMLElement {
    const container = this.root!.getElementById('messages')!;
    const initial = this.config!.workerName.charAt(0).toUpperCase();
    const row = document.createElement('div');
    row.className = 'bubble-row aiva';
    row.innerHTML = `
      <div class="aiva-avatar">${initial}</div>
      <div>
        <div class="bubble aiva">${this.escapeHtml(text)}</div>
        <div class="bubble-ts">${this.formatTime()}</div>
      </div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
    this.incrementUnread();
    return row.querySelector('.bubble.aiva') as HTMLElement;
  }

  private appendTypingIndicator(): HTMLElement {
    const container = this.root!.getElementById('messages')!;
    const row = document.createElement('div');
    row.className = 'bubble-row aiva';
    const initial = this.config!.workerName.charAt(0).toUpperCase();
    row.innerHTML = `
      <div class="aiva-avatar">${initial}</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
    return row;
  }

  private async handleSend(): Promise<void> {
    if (this.isSending) return;
    const textarea = this.root!.getElementById('input') as HTMLTextAreaElement;
    const text = textarea.value.trim();
    if (!text || !this.sessionToken) return;

    textarea.value = '';
    textarea.style.height = 'auto';
    this.isSending = true;
    (this.root!.getElementById('send') as HTMLButtonElement).disabled = true;

    this.appendUserMessage(text);

    const typingRow = this.appendTypingIndicator();
    let aivaBubble: HTMLElement | null = null;
    let fullResponse = '';

    try {
      for await (const event of streamMessage(this.apiBase, this.workerId, this.sessionToken, text)) {
        if (event.type === 'token') {
          if (!aivaBubble) {
            typingRow.remove();
            const initial = this.config!.workerName.charAt(0).toUpperCase();
            const container = this.root!.getElementById('messages')!;
            const row = document.createElement('div');
            row.className = 'bubble-row aiva';
            row.innerHTML = `
              <div class="aiva-avatar">${initial}</div>
              <div>
                <div class="bubble aiva"></div>
                <div class="bubble-ts">${this.formatTime()}</div>
              </div>
            `;
            container.appendChild(row);
            aivaBubble = row.querySelector('.bubble.aiva') as HTMLElement;
          }
          fullResponse += event.content;
          aivaBubble.textContent = fullResponse;
          this.scrollToBottom();
        } else if (event.type === 'error') {
          typingRow.remove();
          this.appendAivaMessage('Sorry, something went wrong. Please try again.');
          break;
        }
      }
      this.incrementUnread();
    } finally {
      typingRow.remove(); // in case stream ended without 'done'
      this.isSending = false;
      (this.root!.getElementById('send') as HTMLButtonElement).disabled = false;
      (this.root!.getElementById('input') as HTMLElement).focus();
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
```

---

## Step 10: Embed snippet in workspace portal - Channels tab

In `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/workers/[id]/AivaDetailClient.tsx`,
inside the Channels tab, when the `web` channel is connected, add an "Embed snippet" subsection
below the channel card:

```tsx
{/* Embed snippet - only shown when web channel is connected */}
{channels.some(ch => ch.type === 'web' && ch.active) && (
  <div className="rounded-lg border border-border bg-overlay p-4 mt-4">
    <p className="text-xs font-medium text-text-primary mb-1">Embed snippet</p>
    <p className="text-[11px] text-text-muted mb-3">
      Paste this snippet before the closing{' '}
      <code className="font-mono bg-elevated px-1 rounded">&lt;/body&gt;</code>{' '}
      tag on any page where you want this Aiva to appear.
    </p>
    <div className="relative">
      <pre className="text-[11px] font-mono bg-base rounded-lg border border-border px-4 py-3
                      overflow-x-auto text-text-secondary select-all whitespace-pre-wrap break-all">
        {`<script src="https://core.carinaai.uk/widget.js" data-aiva-id="${worker.id}"></script>`}
      </pre>
      <CopyButton text={`<script src="https://core.carinaai.uk/widget.js" data-aiva-id="${worker.id}"></script>`} />
    </div>
  </div>
)}
```

`CopyButton` component (reuse if one exists, otherwise create inline):
```tsx
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 text-[11px] px-2 py-1 rounded border border-border
                 bg-elevated text-text-muted hover:text-text-primary transition-colors"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
```

---

## Done When

**Backend:**
- [ ] `widget_sessions` table exists with correct schema and indexes
- [ ] `GET /api/widget/:workerId/config` returns correct fields; returns 404 for unknown or inactive Aiva
- [ ] `POST /api/widget/:workerId/session` creates new session; resumes existing by token; rate limited at 10/hr per IP
- [ ] `POST /api/widget/:workerId/message` streams SSE; rate limited at 20 messages per session per hour
- [ ] Widget routes have `Access-Control-Allow-Origin: *`; no other routes have wildcard CORS
- [ ] `widget.js` served at `https://core.carinaai.uk/widget.js` with correct Content-Type and CORS header
- [ ] Widget bundle included in deploy script

**Widget bundle:**
- [ ] `frontends/widget/` exists with Vite IIFE config
- [ ] `npm run build` produces `dist/widget.js` (single file, minified)
- [ ] Shadow DOM correctly isolates all CSS from host page
- [ ] Launcher button renders bottom-right with SVG chat icon (not a Unicode character)
- [ ] Launcher button switches to close icon (X) when panel is open
- [ ] Panel opens with `opacity + translateY` animation; closes in reverse
- [ ] Header shows: status dot (green), Aiva name, role, close button
- [ ] Typing indicator (three bouncing dots) appears while waiting for first token
- [ ] Response streams into the bubble token by token; typing indicator removed on first token
- [ ] User messages: right-aligned, accent-color background
- [ ] Aiva messages: left-aligned, light grey background, avatar initial to the left
- [ ] Timestamps shown below each bubble group
- [ ] Unread badge appears on launcher when panel is closed and Aiva sends a message
- [ ] Unread badge clears when panel is opened
- [ ] Session token persisted in localStorage; resumed on next page visit
- [ ] `data-accent-color` and `data-widget-name` attributes override the API config
- [ ] Mobile: panel fills viewport width with 12px inset on screens <= 480px
- [ ] Textarea auto-resizes up to 4 lines; send on Enter (Shift+Enter for newline)
- [ ] Send button disabled while a message is in flight

**Portal:**
- [ ] Embed snippet shown in Channels tab when web channel is connected and active
- [ ] Snippet is selectable/copyable; Copy button copies to clipboard and shows "Copied" for 2 seconds

**General:**
- [ ] No em dashes in widget copy, CSS comments, or TypeScript comments
- [ ] No emojis in widget UI (use SVG icons only)
