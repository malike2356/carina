# Platform Admin - Chat Tab (Carina SSE Integration)

**Working directory:** `/opt/lampp/htdocs/VERLOX/Carina-ai/ops.carinaai.uk/`
**Depends on:** Carina agent running at `CARINA_API_URL` (default `http://localhost:3333`)
**Purpose:** Fix and complete the Chat tab so it streams responses from the running Carina instance using SSE, shows VERLOX quick-action buttons, and handles the provider indicator correctly. The Chat tab is the primary way you talk to Carina from within the admin panel.

---

## What already exists (do not recreate)

- `routes/chat.ts` - basic route that renders chat.ejs with carinaApiUrl and quickActions
- `lib/constants.ts` - VERLOX_QUICK_ACTIONS array
- `views/chat.ejs` - exists but likely incomplete

Read each before modifying.

---

## Files to modify

### `lib/constants.ts`

Ensure VERLOX_QUICK_ACTIONS contains these (add or replace):

```typescript
export const VERLOX_QUICK_ACTIONS = [
  { label: 'Analyse BTL deal',       prompt: 'I need to analyse a buy-to-let deal. Purchase price: £[PRICE]. Monthly rent: £[RENT]. Location: [AREA]. Walk me through the numbers including gross yield, net yield, and whether this stacks.' },
  { label: 'HMO compliance check',   prompt: 'Check HMO compliance for a [N]-bedroom property in [AREA]. What licensing do I need, what are the room size requirements, and what fire safety measures are mandatory?' },
  { label: 'Area research',          prompt: 'Research [AREA] for property investment. Give me average yields, price trends, demand indicators, and any risks I should know about.' },
  { label: 'BRR analysis',           prompt: 'Help me run a BRR analysis. Purchase price: £[PRICE]. Estimated refurb cost: £[REFURB]. Expected GDV: £[GDV]. Target rental: £[RENT]/month.' },
  { label: 'Draft investor update',  prompt: 'Draft a professional update for property investors. Portfolio performance this month, any notable deals or exits, and outlook for next quarter. Professional but warm tone.' },
  { label: 'Bridging finance',       prompt: 'Explain bridging finance options for a £[PRICE] purchase that needs [REFURB] of refurb work. What rates should I expect, what are the exit requirements, and what are the risks?' },
  { label: 'Yield calculator',       prompt: 'Calculate gross and net yield for: Purchase price £[PRICE], monthly rent £[RENT], monthly costs (mortgage, insurance, management, maintenance) £[COSTS].' },
  { label: 'Legal check',            prompt: 'What legal and compliance checks do I need to complete before exchanging on a [PROPERTY_TYPE] at [AREA]? Include title checks, searches, and any tenancy-specific requirements.' },
];
```

---

### `views/chat.ejs`

Full rewrite of the chat view. Renders inside `layout.ejs` (just the body content, no `<html>` tags).

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  Quick actions (horizontal scroll row)                    │
│  [Analyse BTL] [HMO check] [Area research] [BRR] ...    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Message history (scrollable, fills remaining height)    │
│  User messages: right-aligned, cyan background           │
│  Carina messages: left-aligned, dark card background     │
│  Tool events ([using web-search...]): italic, grey       │
│  Code blocks: monospace, dark bg                        │
│                                                           │
├──────────────────────────────────────────────────────────┤
│  [Provider: deepseek ▾]  [Input field...........] [Send]│
└──────────────────────────────────────────────────────────┘
```

**Quick actions:** Horizontal scrollable row at top. Each button is a small chip. Clicking prefills the input with the prompt text (with [PLACEHOLDERS] left in for the user to fill). If `prefill` was passed from the URL query param, pre-populate the input on load.

**Message history:**
- Container: `max-height: calc(100vh - 280px)`, `overflow-y: auto`, auto-scrolls to bottom on new message
- User turn: right-aligned bubble, cyan (#06b6d4) text on dark card
- Carina turn: left-aligned, green (#22c55e) label "Carina:", then text in default colour
- Tool events (lines starting with `[using `): italic, grey, smaller font
- Markdown rendering: use `marked.parse()` from `https://cdn.jsdelivr.net/npm/marked/marked.min.js` CDN for Carina responses. Render into innerHTML of the message div.
- Code blocks from marked: add syntax highlighting class, dark background, monospace font.
- Timestamps: small grey text below each message.

**Provider indicator:** `GET /api/providers` on the Carina API (`carinaApiUrl`) returns `{ providers: string[], active: string }`. Show a small dropdown/badge showing the active provider. Clicking lets you switch via a `POST` to the provider switch endpoint - or just show it as read-only info.

**Input area:**
- Textarea (not input) - auto-grows to max 4 lines, Enter submits, Shift+Enter is newline
- Send button disabled while streaming
- "Carina is thinking..." indicator while waiting for first token

**SSE streaming:**
Connect to `<%= carinaApiUrl %>/api/chat/stream?message=...&sessionId=...`.

Session ID: generate a UUID v4 on first load, store in `localStorage` under key `carina-admin-session`. Persist across page refreshes so memory context is maintained within admin sessions.

On SSE chunk received:
- Append to the current Carina message div
- Re-render markdown (call `marked.parse()` on the accumulated text)
- Auto-scroll the history container

On SSE `[DONE]`: mark message complete, re-enable input.

On SSE error: show inline error in the message stream, re-enable input.

```javascript
async function sendMessage(content) {
  if (!content.trim()) return;

  appendMessage('user', content);
  clearInput();
  disableSend();

  const carinaDiv = appendMessage('carina', '');
  let accumulated = '';

  const url = new URL(`${carinaApiUrl}/api/chat/stream`);
  url.searchParams.set('message', content);
  url.searchParams.set('sessionId', getSessionId());

  const es = new EventSource(url.toString());
  es.onmessage = (e) => {
    if (e.data === '[DONE]') { es.close(); enableSend(); return; }
    try {
      const chunk = JSON.parse(e.data);
      if (typeof chunk === 'string') {
        accumulated += chunk;
        carinaDiv.innerHTML = marked.parse(accumulated);
        scrollToBottom();
      }
    } catch { /* raw chunk */ }
  };
  es.onerror = () => { es.close(); enableSend(); appendError('Connection lost.'); };
}
```

**Clear session button:** Small link below the input: "Clear session memory". POSTs to `<%= carinaApiUrl %>/api/clear` with `{ sessionId }`. Clears `localStorage` session ID and reloads.

**Carina offline handling:** If the initial provider fetch fails, show a banner:
```
Carina is not running at <%= carinaApiUrl %>. Start it with: pnpm dev
```

---

### `routes/chat.ts`

Add a provider proxy endpoint so the browser can switch providers without CORS:

```typescript
chatRouter.post('/provider', async (req, res) => {
  const { provider } = req.body as { provider: string };
  const carinaUrl = process.env.CARINA_API_URL ?? 'http://localhost:3333';
  try {
    const r = await fetch(`${carinaUrl}/api/providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await r.json();
    res.json(data);
  } catch {
    res.status(503).json({ error: 'Carina offline' });
  }
});
```

---

## Test cases

1. Load `/chat` with Carina running → quick actions appear, provider badge shows "deepseek"
2. Click "Analyse BTL deal" → prompt prefills with template text
3. Type "say hello" → SSE streams → "Hello" appears word by word in Carina message div
4. Markdown in response (bold, code block) → renders correctly
5. Carina offline → offline banner shown, input disabled with message "Start Carina first"
6. Session persists across page refresh → `localStorage` session ID preserved
7. "Clear session memory" → confirmation, session cleared, fresh context
8. `?prefill=Hello` in URL → input pre-populated on load
9. Shift+Enter in input → newline, Enter → sends
10. Projects page "Ask Carina" button → links to `/chat?prefill=...` with project context
