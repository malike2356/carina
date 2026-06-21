# Prompt 10: Compare and Research Workspace

You are working in the Carina mono-repo at `core.carinaai.uk/`.

## What already exists

Both workspace pages are live but thin. The base infrastructure is complete; this prompt adds the missing features to make them real tools.

**Compare:**
- `packages/web/assets/web/compare.html` (87 lines) - HTML shell with form and grid
- `packages/web/assets/web/compare.js` (170 lines) - IIFE with history, render, POST /api/compare/run
- `src/api/compare-api.ts` - router with POST /run and GET /stream
- `src/agents/compare.ts` - exports `runCompare`, `queryProvider`, `defaultCompareProviders`, `formatCompareMarkdown`

**Research:**
- `packages/web/assets/web/research.html` (71 lines) - HTML shell with form and output div
- `packages/web/assets/web/research.js` (158 lines) - IIFE with history (localStorage) and SSE streaming
- `src/api/research-api.ts` - router with POST /run and GET /stream
- `src/agents/deep-research.ts` - exports `runDeepResearch`, `renderReportMarkdown`, `renderReportHtml`

**Route registration** (already done in `packages/web/src/web-server.ts`):
- compare.html and research.html are loaded via `decoratePageHtml` and served at `/compare` and `/research`
- `WorkspacePageId` already includes `'compare'` and `'research'`
- `WORKSPACE_NAV_ITEMS` already has entries for both

## What is missing and must be built

### Compare page gaps

**1. Provider selector UI**

The compare form has no provider checkboxes. The user cannot pick which providers to compare. GET /api/compare/providers must return the configured providers.

Add to `src/api/compare-api.ts`:

```typescript
compareApiRouter.get('/providers', (_req: Request, res: Response) => {
  const configured = defaultCompareProviders();
  const all = Object.keys(PROVIDER_MAP);
  res.json({
    configured,
    all,
    active: llm.current().name,
  });
});
```

Add to `packages/web/assets/web/compare.html` inside the form, after the textarea:

```html
<div id="provider-select-wrap" style="display:flex;flex-wrap:wrap;gap:0.5rem;font-size:0.8rem;"></div>
<p id="provider-hint" style="font-size:0.75rem;color:var(--muted);margin:0;"></p>
```

In `compare.js`, on load fetch `/api/compare/providers` and render checkbox per provider. Pass checked providers as `providers` array in the POST body.

**2. System prompt field**

Add an optional collapsible system prompt field above the main textarea:

```html
<details style="margin-bottom:0.5rem;">
  <summary style="font-size:0.8rem;cursor:pointer;color:var(--muted)">System prompt (optional)</summary>
  <textarea id="compare-system" placeholder="You are a helpful assistant." style="margin-top:0.4rem;min-height:60px;resize:vertical;width:100%;..."></textarea>
</details>
```

Pass `systemPrompt: systemEl.value.trim() || undefined` in the POST body.

**3. Token count and latency bar per card**

`compare-api.ts` returns `tokenCount` and `latencyMs` per `CompareResponseItem`. The JS currently ignores them.

In `compare.js` `renderCard()`, append below `.compare-body`:

```javascript
'<div style="font-size:0.68rem;color:var(--muted);padding:0.4rem 0.75rem;border-top:1px solid var(--border);display:flex;gap:0.75rem;">' +
  (item.tokenCount ? item.tokenCount + ' tokens' : '') +
  (item.latencyMs ? ' | ' + (item.latencyMs / 1000).toFixed(2) + 's' : '') +
'</div>'
```

**4. Copy-all button after results render**

After `runCompare` returns in `compare.js`, add a "Copy all as Markdown" button that calls:

```javascript
async function copyAllMarkdown() {
  const data = await fetch('/api/compare/run', { ... }).then(r => r.json());
  await navigator.clipboard.writeText(data.markdown || '');
}
```

Or render the markdown received from the API and put it in a hidden textarea users can copy from.

**5. Skeleton loading state**

Before the POST completes, fill the grid with skeleton cards equal to the number of selected providers:

```javascript
gridEl.innerHTML = providers.map(() =>
  '<div class="compare-card"><div class="skeleton" style="height:160px;border-radius:10px;"></div></div>'
).join('');
```

### Research page gaps

**1. Source citations panel**

`runDeepResearch` returns a `DeepResearchReport` with `sources: SourceCitation[]`. The research page renders only the body text, not the sources.

Add to `research.html` after `#research-output`:

```html
<div id="sources-panel" hidden style="margin-top:1rem;">
  <div style="font-size:0.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.35rem;">Sources</div>
  <div id="sources-list" style="display:flex;flex-direction:column;gap:0.35rem;"></div>
</div>
```

In `research.js`, after receiving the result JSON, render sources:

```javascript
function renderSources(sources) {
  const panel = document.getElementById('sources-panel');
  const list = document.getElementById('sources-list');
  if (!sources || !sources.length) { panel.hidden = true; return; }
  panel.hidden = false;
  list.innerHTML = sources.map(function(s, i) {
    return '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener" ' +
      'style="font-size:0.78rem;color:var(--accent);text-decoration:none;display:block;padding:0.3rem 0;">' +
      '[' + (i+1) + '] ' + escapeHtml(s.title || s.url) +
      '</a>';
  }).join('');
}
```

**2. Save to notes button**

Add a "Save to Notes" button below the output that appears after a result is shown:

```html
<button id="save-to-notes" hidden style="margin-top:0.75rem;">Save to Notes</button>
```

On click, POST to `/api/notes` with:
```javascript
{ title: query.slice(0, 80), body: markdownOutput, format: 'note' }
```

**3. Server-side research history**

The current research page stores history only in localStorage. Add an API endpoint in `src/api/research-api.ts`:

```typescript
import { llm } from '../brain/llm.js';
import { CARINA_HOME } from '../config/env.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const historyFile = () => path.join(CARINA_HOME, 'research-history.json');

researchApiRouter.get('/history', async (_req, res) => {
  try {
    const raw = await fs.readFile(historyFile(), 'utf-8').catch(() => '[]');
    res.json({ items: JSON.parse(raw) });
  } catch {
    res.json({ items: [] });
  }
});
```

After each research run, append `{ id, query, summary: markdown.slice(0,200), createdAt }` to the JSON file and refresh the history panel.

**4. Streaming progress display**

The SSE stream endpoint at `GET /api/research/stream` already exists in `research-api.ts`. The `onProgress` callback in `DeepResearchOptions` emits lines like `"Searching: <query>"` and `"Synthesising..."`.

In `research.js`, use `EventSource` to connect to the stream:

```javascript
const sse = new EventSource('/api/research/stream?q=' + encodeURIComponent(query));
sse.onmessage = function(e) {
  progressEl.textContent = e.data;
};
sse.onerror = function() { sse.close(); };
```

Show progress in `#research-progress` and clear it when done.

**5. Research round count selector**

Add a `maxRounds` select input to `research.html`:

```html
<select id="research-rounds" style="...">
  <option value="3">3 rounds (fast)</option>
  <option value="6" selected>6 rounds (balanced)</option>
  <option value="10">10 rounds (thorough)</option>
</select>
```

Pass `maxRounds: Number(roundsEl.value)` in the POST body.

## API mounts

Both routers are already mounted. Check `packages/web/src/web-server.ts` for:

```typescript
import { compareApiRouter } from '#core/api/compare-api.js';
import { researchApiRouter } from '#core/api/research-api.js';
// ...
app.use('/api/compare', express.json(), requireAuth, compareApiRouter);
app.use('/api/research', express.json(), requireAuth, researchApiRouter);
```

If these lines are missing, add them in `createWebServer()` alongside the other API mounts.

Verify also that `compare.js` is served:
```typescript
app.get('/compare.js', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(WEB_STATIC, 'compare.js'));
});
```
This already exists at line 899 of `web-server.ts`.

## Tests

Add to `src/api/compare-api.test.ts`:
- GET /providers returns `{ configured: string[], all: string[], active: string }`
- POST /run with empty providers returns 400
- POST /run with valid prompt and providers returns `{ prompt, responses, generatedAt, markdown }`
- POST /run with blind:true returns no providerId in response

Add to `src/api/research-api.test.ts`:
- GET /history returns `{ items: [] }` when no history exists
- POST /run with valid query returns `{ report: { title, sections, sources } }`
- Progress stream sends `text/event-stream` content-type

## Acceptance criteria

- The compare page shows checkboxes for each configured provider; unchecked providers are skipped.
- Blind mode hides provider labels until the "Reveal" button is clicked.
- Each compare card shows token count and latency.
- The research page streams progress updates line by line.
- Sources are listed with numbered links below the result.
- "Save to Notes" creates a note and shows a toast.
- Both pages have server-side history browsable from the top of the form.
