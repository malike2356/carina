# Sprint 4 - Prompt c/01: Embeddable Web Chat Widget

**Sprint:** 4 - Foundation
**Prompt number:** c/01
**Name:** Embeddable JavaScript chat widget, backend SSE stream, snippet generation
**Primary agent:** Claude Code (backend + widget bundle) + Cursor (widget UI)
**Estimated hours:** 8-10 h
**Depends on:** b/01 (channel infrastructure); the widget is the 'web' channel adapter

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/c/`.

---

## Context

The web chat widget is an embeddable script tag that customers paste on their website.
It renders a floating chat button (bottom-right corner). Clicking it opens a chat panel.
Messages are sent to the Aiva brain and responses stream back in real time via SSE.

The widget is NOT a Next.js component. It is a self-contained JavaScript bundle that runs
on third-party websites. It must not depend on any VERLOX frontend framework.

---

## Step 1: Widget backend routes

Add to core backend (no auth required - widget runs on third-party sites):

```
POST /api/widget/:workerId/session    Create or resume a visitor session
POST /api/widget/:workerId/message    Send a message and get a response (streaming SSE)
GET  /api/widget/:workerId/history    Get conversation history for a session (optional, v1)
GET  /api/widget/:workerId/config     Get widget display config (name, color, welcome message)
```

**`POST /api/widget/:workerId/session`:**

```typescript
// Body: {} or { sessionToken: string }  (resume existing session)
// Creates a new visitor session OR resumes an existing one.
// Session: a UUID stored in a widget_sessions table.
// Response: { sessionToken: string, expiresAt: string, workerName: string }
```

Add to migration `010-channels.sql`:
```sql
CREATE TABLE IF NOT EXISTS widget_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID        NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL,
  session_token   TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  contact_id      TEXT        NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    -- anonymous contact ID, stable for this session, used as contactId in channel_threads
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON widget_sessions(session_token);
CREATE INDEX ON widget_sessions(worker_id, last_active_at DESC);
```

**`POST /api/widget/:workerId/message`:**

```typescript
// Body: { sessionToken: string; message: string }
// Returns: text/event-stream (SSE)
// Validates session token -> finds workerId + workspaceId -> runs Aiva brain
// Streams response tokens as SSE events:
//   data: {"type":"token","content":"Hello"}
//   data: {"type":"done"}
//   data: {"type":"error","message":"..."}

// Rate limiting: 20 messages per session per hour (via a simple in-memory counter per sessionToken)
// CORS: allow origin from any domain (the widget runs on third-party sites)
```

CORS for widget routes: allow `*` origin explicitly on the `/api/widget/*` routes only.
Do not apply wildcard CORS to any other routes.

**`GET /api/widget/:workerId/config`:**

```typescript
// Public, no auth, no session required
// Returns: {
//   workerName: string;
//   welcomeMessage: string;    // from ai_workers.settings or a default
//   accentColor: string;       // hex color, default '#f59e0b' (amber)
//   workspaceName: string;
// }
```

---

## Step 2: SSE streaming in the message endpoint

The Aiva brain in sprint-4 prompt 03 generates a full response. For the widget, stream the
response token by token for a better UX.

If the Aiva brain already supports streaming (via Anthropic streaming API), pipe the stream
directly to the SSE response. If it returns a complete response, emit it as a single token.

```typescript
router.post('/api/widget/:workerId/message',
  cors({ origin: '*' }),  // only here, not globally
  async (req, res) => {
    const { sessionToken, message } = req.body;
    if (!sessionToken || !message?.trim()) return res.sendStatus(400);

    const session = await validateWidgetSession(sessionToken, req.params.workerId);
    if (!session) return res.sendStatus(401);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      // Log inbound
      await logActivity({ workerId: session.workerId, workspaceId: session.workspaceId, actionType: 'message_received', summary: `Web widget message: ${message.slice(0, 100)}` });

      // Run Aiva brain (streaming if supported)
      const stream = await processAivaMessageStream({
        workerId: session.workerId,
        workspaceId: session.workspaceId,
        userMessage: message,
        channel: 'web',
        contactId: session.contactId,
      });

      let fullResponse = '';
      for await (const token of stream) {
        fullResponse += token;
        send({ type: 'token', content: token });
      }

      send({ type: 'done' });

      await logActivity({ workerId: session.workerId, workspaceId: session.workspaceId, actionType: 'message_sent', summary: `Web widget reply: ${fullResponse.slice(0, 100)}` });
    } catch (err) {
      send({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      res.end();
    }
  }
);
```

If `processAivaMessageStream` does not exist (brain returns full response), wrap it:
```typescript
async function* processAivaMessageStream(...args) {
  const response = await processAivaMessage(...args);
  yield response;
}
```

---

## Step 3: Widget JavaScript bundle

Create a new directory `frontends/widget/` (separate from client apps):

```
frontends/widget/
  src/
    index.ts          Entry point; auto-inits from script data attribute
    widget.ts         Main widget class
    ui.ts             DOM creation (shadow DOM)
    api.ts            Backend API calls
    store.ts          LocalStorage session persistence
  package.json
  tsconfig.json
  vite.config.ts      Builds to a single widget.js bundle
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
  "dependencies": {},
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.0.0"
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
    rollupOptions: {
      external: [],
    },
    minify: true,
    outDir: 'dist',
  },
});
```

**`src/index.ts`** (auto-init):
```typescript
import { CarinaWidget } from './widget';

const script = document.currentScript as HTMLScriptElement;
const workerId = script?.dataset.aivaId || (window as any).CARINA_AIVA_ID;

if (workerId) {
  const widget = new CarinaWidget(workerId, {
    apiBase: 'https://core.carinaai.uk',
  });
  widget.init();
}
```

**`src/widget.ts`** (core logic):

```typescript
export class CarinaWidget {
  private workerId: string;
  private apiBase: string;
  private sessionToken: string | null = null;
  private isOpen = false;
  private root: ShadowRoot | null = null;

  constructor(workerId: string, options: { apiBase: string }) {
    this.workerId = workerId;
    this.apiBase = options.apiBase;
  }

  async init(): Promise<void> {
    await this.loadConfig();
    this.sessionToken = localStorage.getItem(`carina_session_${this.workerId}`);
    this.createUI();
    await this.resumeOrCreateSession();
  }

  private async loadConfig() {
    const res = await fetch(`${this.apiBase}/api/widget/${this.workerId}/config`);
    this.config = await res.json();
  }

  private async resumeOrCreateSession() {
    const body = this.sessionToken ? { sessionToken: this.sessionToken } : {};
    const res = await fetch(`${this.apiBase}/api/widget/${this.workerId}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    this.sessionToken = data.sessionToken;
    localStorage.setItem(`carina_session_${this.workerId}`, this.sessionToken);
  }

  async sendMessage(text: string): Promise<void> {
    this.appendMessage('user', text);
    const thinkingEl = this.appendMessage('aiva', '...');

    const eventSource = new EventSource(
      `${this.apiBase}/api/widget/${this.workerId}/message`,
      // EventSource does not support POST; use fetch with streaming instead
    );
    // Use fetch + ReadableStream for POST SSE:
    const res = await fetch(`${this.apiBase}/api/widget/${this.workerId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: this.sessionToken, message: text }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let aivaBubble = '';
    thinkingEl.textContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === 'token') {
          aivaBubble += event.content;
          thinkingEl.textContent = aivaBubble;
        }
        if (event.type === 'done') break;
      }
    }
  }

  private createUI() {
    // Create a shadow DOM host to isolate styles from the host page
    const host = document.createElement('div');
    host.id = 'carina-widget-host';
    document.body.appendChild(host);
    this.root = host.attachShadow({ mode: 'closed' });

    this.root.innerHTML = `
      <style>
        /* All styles scoped to shadow DOM - host page styles do not bleed in */
        :host { all: initial; }
        #launcher {
          position: fixed; bottom: 24px; right: 24px;
          width: 56px; height: 56px; border-radius: 50%;
          background: ${this.config?.accentColor || '#f59e0b'};
          cursor: pointer; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: #fff; z-index: 999999;
        }
        #panel {
          position: fixed; bottom: 96px; right: 24px;
          width: 360px; height: 500px; border-radius: 16px;
          background: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          display: flex; flex-direction: column; z-index: 999998;
          font-family: system-ui, sans-serif; overflow: hidden;
          transition: opacity 0.2s, transform 0.2s;
        }
        #panel.hidden { opacity: 0; pointer-events: none; transform: translateY(8px); }
        #panel-header {
          padding: 16px; background: ${this.config?.accentColor || '#f59e0b'};
          color: #fff; font-weight: 600; font-size: 15px;
        }
        #messages {
          flex: 1; overflow-y: auto; padding: 16px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
        .bubble.user { background: ${this.config?.accentColor || '#f59e0b'}; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
        .bubble.aiva { background: #f3f4f6; color: #111; align-self: flex-start; border-bottom-left-radius: 4px; }
        #input-row { display: flex; padding: 12px; border-top: 1px solid #e5e7eb; gap: 8px; }
        #input { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 14px; outline: none; }
        #send { background: ${this.config?.accentColor || '#f59e0b'}; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 14px; }
        #powered { text-align: center; font-size: 10px; color: #9ca3af; padding: 4px 0 8px; }
      </style>
      <button id="launcher" aria-label="Open chat">&#x1F4AC;</button>
      <div id="panel" class="hidden">
        <div id="panel-header">${this.config?.workerName || 'Assistant'}</div>
        <div id="messages"></div>
        <div id="input-row">
          <input id="input" type="text" placeholder="Type a message..." />
          <button id="send">Send</button>
        </div>
        <div id="powered">Powered by VERLOX</div>
      </div>
    `;

    this.root.getElementById('launcher')!.onclick = () => this.toggle();
    this.root.getElementById('send')!.onclick = () => this.handleSend();
    const input = this.root.getElementById('input') as HTMLInputElement;
    input.onkeydown = (e) => { if (e.key === 'Enter') this.handleSend(); };

    // Show welcome message
    if (this.config?.welcomeMessage) {
      this.appendMessage('aiva', this.config.welcomeMessage);
    }
  }

  private toggle() {
    this.isOpen = !this.isOpen;
    this.root!.getElementById('panel')!.classList.toggle('hidden', !this.isOpen);
    if (this.isOpen) {
      (this.root!.getElementById('input') as HTMLInputElement).focus();
    }
  }

  private handleSend() {
    const input = this.root!.getElementById('input') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.sendMessage(text);
  }

  private appendMessage(role: 'user' | 'aiva', text: string): HTMLElement {
    const el = document.createElement('div');
    el.className = `bubble ${role}`;
    el.textContent = text;
    this.root!.getElementById('messages')!.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth' });
    return el;
  }

  private config: any = null;
}
```

---

## Step 4: Build and serve the widget

The built `dist/widget.js` must be served from a stable, CDN-friendly URL.

Options:
1. Serve from `core.carinaai.uk/widget.js` (simplest, no separate CDN needed for v1)
2. Upload to Cloudflare R2 or Backblaze B2 and serve from `cdn.carinaai.uk`

For v1: serve from core backend:
```typescript
// In server.ts, serve the built widget file statically
app.use('/widget.js', express.static(path.join(__dirname, '../widget/dist/widget.js'), {
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/javascript');
  },
}));
```

Add to `deploy-core.sh`: after building the backend, also build the widget:
```bash
cd "$REPO_DIR/frontends/widget" && npm ci && npm run build
rsync -a "$REPO_DIR/frontends/widget/dist/" "$RELEASE_DIR/widget/dist/"
```

---

## Step 5: Snippet generation in portal

In the portal Channels tab, when the 'web' channel is active, show the embed snippet:

```tsx
// In the Channels tab of the Aiva detail page (src/app/(workspace)/aiva/workers/[id]/page.tsx)
// When channel === 'web':
const snippet = `<script src="https://core.carinaai.uk/widget.js" data-aiva-id="${worker.id}"></script>`;

// Show in a <pre> block with a "Copy" button
```

---

## Done When

- [ ] `POST /api/widget/:workerId/session` creates or resumes a session; returns sessionToken
- [ ] Session persisted in `widget_sessions` table
- [ ] `POST /api/widget/:workerId/message` streams SSE response tokens
- [ ] `GET /api/widget/:workerId/config` returns worker name, welcome message, accent color without auth
- [ ] Widget routes have `Access-Control-Allow-Origin: *` CORS header (only these routes)
- [ ] `frontends/widget/` directory exists with Vite IIFE build config
- [ ] Widget renders floating button (bottom-right) on any webpage
- [ ] Clicking button opens chat panel with shadow DOM isolation
- [ ] Typing and pressing Enter or clicking Send sends a message
- [ ] Response streams into the Aiva bubble in real time
- [ ] Welcome message shown on first open
- [ ] Session token persisted in localStorage; resumed on next visit
- [ ] Widget DOES NOT break host page styles (shadow DOM correctly isolates all CSS)
- [ ] `npm run build` in `frontends/widget/` produces `dist/widget.js`
- [ ] Widget served at `https://core.carinaai.uk/widget.js` with correct Content-Type and CORS header
- [ ] Embed snippet shown in portal Channels tab with copy button
- [ ] Mobile layout: panel width adapts on small screens (max 90vw)
- [ ] No em dashes in widget copy or comments
