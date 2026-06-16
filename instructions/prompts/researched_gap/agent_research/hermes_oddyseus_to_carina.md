# 
---

## Prompt 2: Full Email Assistant (IMAP Fetch + SMTP Compose + AI Draft)

### Context

The current email implementation is inbound-webhook-only:
- src/gateway/email-store.ts stores emails pushed via POST /webhooks/email/inbound (Resend webhook)
- src/gateway/email-api.ts provides list, get, patch (mark read), archive, spam routes
- packages/web/assets/web/email.html + email.js provide triage UI with urgency badges

What is missing:
1. IMAP fetch: pull from any IMAP mailbox, not just inbound webhooks
2. SMTP compose: send new emails
3. AI draft: call Carina to write a draft reply for a selected email
4. Reply flow in the UI

The Resend config is already in src/config/index.ts as config.resend.apiKey. For SMTP send, use Nodemailer with Resend SMTP or a generic SMTP config.

### Tasks

#### 1. Add IMAP and SMTP config to src/config/index.ts

Add to the config object after the resend block:
```typescript
imap: {
  host: process.env.IMAP_HOST ?? '',
  port: parseInt(process.env.IMAP_PORT ?? '993', 10),
  user: process.env.IMAP_USER ?? '',
  password: process.env.IMAP_PASSWORD ?? '',
  tls: process.env.IMAP_TLS !== 'false',
},
smtp: {
  host: process.env.SMTP_HOST ?? 'smtp.resend.com',
  port: parseInt(process.env.SMTP_PORT ?? '465', 10),
  user: process.env.SMTP_USER ?? 'resend',
  password: process.env.SMTP_PASSWORD ?? process.env.RESEND_API_KEY ?? '',
  from: process.env.SMTP_FROM ?? process.env.RESEND_FROM ?? 'hello@carinaai.uk',
  tls: process.env.SMTP_TLS !== 'false',
},
```

#### 2. Create src/gateway/imap-fetcher.ts

Uses the imapflow npm package (add it if not present: pnpm add imapflow).

```typescript
import { config } from '../config/index.js';
import { upsertInboundEmail } from './email-store.js';

export async function fetchImapEmails(limit = 50): Promise<number> {
  if (!config.imap.host || !config.imap.user) return 0;
  const { ImapFlow } = await import('imapflow');
  const client = new ImapFlow({
    host: config.imap.host, port: config.imap.port, secure: config.imap.tls,
    auth: { user: config.imap.user, pass: config.imap.password }, logger: false,
  });
  await client.connect();
  let count = 0;
  await client.mailboxOpen('INBOX');
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for await (const msg of client.fetch({ seen: false, since }, { uid: true, envelope: true, source: true })) {
    const text = msg.source?.toString() ?? '';
    const bodyStart = text.indexOf('\r\n\r\n');
    const bodyText = bodyStart > -1 ? text.slice(bodyStart + 4).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 10000) : '';
    await upsertInboundEmail({
      message_id: msg.envelope.messageId ?? String(msg.uid),
      from_address: msg.envelope.from?.[0]?.address ?? 'unknown',
      to_address: msg.envelope.to?.[0]?.address ?? config.imap.user,
      subject: msg.envelope.subject ?? null,
      body_text: bodyText || null,
      received_at: (msg.envelope.date ?? new Date()).toISOString(),
    });
    if (++count >= limit) break;
  }
  await client.logout();
  return count;
}
```

Add upsertInboundEmail to src/gateway/email-store.ts:
```typescript
export async function upsertInboundEmail(fields: {
  message_id: string; from_address: string; to_address: string;
  subject: string | null; body_text: string | null; received_at: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO inbound_emails (id, from_address, to_address, subject, body_text, message_id, urgency, triage_status, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,'normal','inbox',$7)
     ON CONFLICT (message_id) DO NOTHING`,
    [fields.message_id, fields.from_address, fields.to_address, fields.subject, fields.body_text, fields.message_id, fields.received_at],
  );
}
```

#### 3. Create src/gateway/smtp-sender.ts

Uses nodemailer (add if needed: pnpm add nodemailer @types/nodemailer).

```typescript
import { config } from '../config/index.js';

export interface SendEmailOptions {
  to: string; subject: string; text: string; html?: string; inReplyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId: string }> {
  const { createTransport } = await import('nodemailer');
  const transport = createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.tls,
    auth: { user: config.smtp.user, pass: config.smtp.password },
  });
  const info = await transport.sendMail({
    from: config.smtp.from, to: opts.to, subject: opts.subject,
    text: opts.text, html: opts.html, inReplyTo: opts.inReplyTo,
  });
  return { messageId: String(info.messageId) };
}
```

#### 4. Add new routes to src/gateway/email-api.ts

```typescript
import { fetchImapEmails } from './imap-fetcher.js';
import { sendEmail } from './smtp-sender.js';

// POST /api/email/sync
emailApiRouter.post('/sync', async (_req, res) => {
  try {
    const count = await fetchImapEmails(100);
    res.json({ synced: count });
  } catch (err) {
    res.status(503).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/email/send  body: { to, subject, text, inReplyTo? }
emailApiRouter.post('/send', async (req, res) => {
  const { to, subject, text, html, inReplyTo } = req.body as Record<string, string>;
  if (!to || !subject || !text) { res.status(400).json({ error: 'to, subject, text required' }); return; }
  try {
    const result = await sendEmail({ to, subject, text, html, inReplyTo });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /api/email/:id/ai-draft
emailApiRouter.post('/:id/ai-draft', async (req, res) => {
  const { id } = req.params;
  const row = await pool.query('SELECT * FROM inbound_emails WHERE id=$1', [id]);
  if (!row.rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  const email = row.rows[0];
  const prompt = `Draft a professional email reply to this message.

From: ${email.from_address}
Subject: ${email.subject ?? '(no subject)'}
Body:
${(email.body_text ?? '').slice(0, 3000)}

Output ONLY the reply body text. No subject line, no salutation unless natural, no signature.`;

  try {
    const { getRouter } = await import('./router.js');
    const router = getRouter();
    const chunks: string[] = [];
    for await (const chunk of router.handle({
      id: String(Date.now()), sessionId: 'email-draft-' + id,
      content: prompt, source: 'api', timestamp: new Date(),
    })) { chunks.push(chunk); }
    res.json({ draft: chunks.join('') });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

#### 5. Update packages/web/assets/web/email.html

Add to the toolbar area:
```html
<button type="button" id="btn-compose">Compose</button>
<button type="button" id="btn-sync">Sync IMAP</button>
```

Add to the email detail action buttons:
```html
<button type="button" id="btn-ai-draft">AI draft reply</button>
```

Add compose modal before the workspace end marker:
```html
<div id="compose-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:200;align-items:center;justify-content:center">
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;width:min(520px,95vw);display:flex;flex-direction:column;gap:0.75rem">
    <h2 style="font-size:0.95rem;margin:0">Compose</h2>
    <form id="compose-form" style="display:flex;flex-direction:column;gap:0.5rem">
      <input id="compose-to" type="email" placeholder="To" required style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:0.5rem 0.65rem;font-size:0.84rem">
      <input id="compose-subject" type="text" placeholder="Subject" required style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:0.5rem 0.65rem;font-size:0.84rem">
      <input id="compose-reply-id" type="hidden">
      <textarea id="compose-body" rows="8" placeholder="Message..." style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:0.5rem 0.65rem;font-size:0.84rem;font-family:inherit;resize:vertical"></textarea>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end">
        <button type="button" id="compose-cancel" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:7px;padding:0.5rem 0.85rem;font-size:0.82rem;cursor:pointer">Cancel</button>
        <button type="submit" style="background:var(--accent);color:#0d0d0f;border:none;border-radius:7px;padding:0.5rem 0.85rem;font-size:0.82rem;font-weight:600;cursor:pointer">Send</button>
      </div>
    </form>
  </div>
</div>
```

#### 6. Update packages/web/assets/web/email.js

Add handlers after existing code:

```javascript
var composeModal = document.getElementById('compose-modal');
document.getElementById('btn-compose').addEventListener('click', function() {
  document.getElementById('compose-to').value = '';
  document.getElementById('compose-subject').value = '';
  document.getElementById('compose-body').value = '';
  document.getElementById('compose-reply-id').value = '';
  composeModal.style.display = 'flex';
});
document.getElementById('compose-cancel').addEventListener('click', function() {
  composeModal.style.display = 'none';
});
document.getElementById('compose-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var to = document.getElementById('compose-to').value.trim();
  var subject = document.getElementById('compose-subject').value.trim();
  var text = document.getElementById('compose-body').value.trim();
  var inReplyTo = document.getElementById('compose-reply-id').value || undefined;
  fetch('/api/email/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, subject, text, inReplyTo }) })
    .then(function(r) { return r.ok ? r.json() : r.json().then(function(d) { throw new Error(d.error || 'Send failed'); }); })
    .then(function() { composeModal.style.display = 'none'; })
    .catch(function(err) { alert('Send failed: ' + err.message); });
});
document.getElementById('btn-sync').addEventListener('click', function() {
  fetch('/api/email/sync', { method: 'POST' })
    .then(function(r) { return r.json(); })
    .then(function(d) { loadEmails && loadEmails(); })
    .catch(function() {});
});
var btnAiDraft = document.getElementById('btn-ai-draft');
if (btnAiDraft) {
  btnAiDraft.addEventListener('click', function() {
    if (!activeId) return;
    fetch('/api/email/' + activeId + '/ai-draft', { method: 'POST' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        document.getElementById('compose-body').value = d.draft || '';
        composeModal.style.display = 'flex';
      })
      .catch(function(err) { alert('Draft failed: ' + err.message); });
  });
}
```

Note: activeId is expected to already be tracked by the existing email.js when an email is selected.

### Verification

- POST /api/email/sync with IMAP configured returns { synced: N }
- POST /api/email/send with { to, subject, text } sends email via SMTP
- POST /api/email/:id/ai-draft returns { draft: "..." }
- Compose button opens modal
- AI draft button pre-fills compose modal with generated reply

---

## Prompt 3: Learning Loop - 7-Day Curator Cycle (Beats Hermes)

### Context

The skill curator runs but defaults to 1 day (CARINA_CURATOR_INTERVAL_DAYS ?? '1'). Hermes runs a 7-day cycle. Carina's goal is to beat Hermes by:
1. 7-day default (matches Hermes)
2. Run-if-overdue on startup, not run-always-on-restart (better than Hermes)
3. Domain-aware merging: skills tagged domain:borehole-africa never merge with domain:devops
4. Eval harness: consolidated skill must pass eval before promotion
5. Cross-agent skill propagation to all named agent workspaces
6. Curator report surfaced in the packs workspace page

Files involved:
- src/skills/curator-scheduler.ts - change default interval
- src/skills/curator.ts - add domain-awareness, eval, propagation
- src/api/ - add curator API

### Tasks

#### 1. Change default in src/skills/curator-scheduler.ts

Find line:
```typescript
const days = Number(process.env.CARINA_CURATOR_INTERVAL_DAYS ?? '1');
```
Change to:
```typescript
const days = Number(process.env.CARINA_CURATOR_INTERVAL_DAYS ?? '7');
```

Also, replace the immediate startup run with a run-if-overdue check. Find the line that does an immediate runCuratorCycle() call and replace with:

```typescript
import fs from 'fs';
import path from 'path';
// ...
const lastRunFile = path.join(process.env.CARINA_HOME ?? process.env.HOME ?? '/tmp', '.carina', 'data', 'curator-last-run.txt');
const lastRunMs = fs.existsSync(lastRunFile) ? fs.statSync(lastRunFile).mtimeMs : 0;
const isOverdue = Date.now() - lastRunMs > ms;
if (isOverdue) {
  void runCuratorCycle().then(() => {
    try { fs.mkdirSync(path.dirname(lastRunFile), { recursive: true }); fs.writeFileSync(lastRunFile, new Date().toISOString()); } catch { /* ignore */ }
  });
}
```

At the end of runCuratorCycle(), also write the last-run file so the check works.

#### 2. Add domain-aware merging to src/skills/curator.ts

Find the function that decides whether to merge or consolidate two skills. Before merging, add:

```typescript
function sameDomain(a: Skill, b: Skill): boolean {
  const da = a.tags?.find((t) => t.startsWith('domain:'));
  const db = b.tags?.find((t) => t.startsWith('domain:'));
  if (!da && !db) return true;
  return da === db;
}
```

In the merge loop, guard: if (!sameDomain(skillA, skillB)) continue;

#### 3. Add eval-before-promote

Before promoting a consolidated skill, call the existing eval harness if it exists, or add a lightweight one:

```typescript
async function evalSkillCandidate(skill: Skill): Promise<boolean> {
  // Check if full eval harness exists
  try {
    const { evalSkill } = await import('./eval/runner.js');
    const result = await evalSkill(skill);
    return result.pass;
  } catch {
    // Lightweight fallback: skill must have name, description, at least one step
    return Boolean(skill.name && skill.description && (skill.steps?.length ?? 0) > 0);
  }
}

// In promotion code:
const passes = await evalSkillCandidate(consolidated);
if (!passes) {
  console.log('[curator] skipped "' + consolidated.name + '": failed eval');
  continue;
}
await promoteSkill(consolidated);
```

#### 4. Add cross-agent skill propagation

After the curator cycle finishes consolidating skills for the default agent, propagate general-purpose (non-domain-tagged) skills to all named agents:

```typescript
async function propagateToAllAgents(generalSkills: Skill[]): Promise<void> {
  try {
    const { listWorkspaces } = await import('../workspaces/index.js');
    const workspaces = await listWorkspaces();
    for (const ws of workspaces) {
      if (!ws.id || ws.id === 'default') continue;
      for (const skill of generalSkills) {
        const alreadyHas = ws.skills?.some((s: Skill) => s.name === skill.name);
        if (!alreadyHas) {
          await addSkillToWorkspace(ws.id, skill);
        }
      }
    }
  } catch { /* optional feature - silently skip if workspaces not available */ }
}
```

Call propagateToAllAgents(consolidatedGeneralSkills) at the end of runFullCuratorCycle().

#### 5. Create src/api/curator-api.ts

```typescript
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const curatorApiRouter = Router();

const DATA_DIR = path.join(process.env.CARINA_HOME ?? process.env.HOME ?? '/tmp', '.carina', 'data');

curatorApiRouter.get('/last-run', (_req, res) => {
  const file = path.join(DATA_DIR, 'curator-last-run.txt');
  if (!fs.existsSync(file)) { res.json({ lastRun: null }); return; }
  res.json({ lastRun: fs.readFileSync(file, 'utf-8').trim() });
});

curatorApiRouter.get('/report', (_req, res) => {
  const dir = process.env.CARINA_SKILL_CURATOR_REPORT_DIR ?? path.join(DATA_DIR, 'curator-reports');
  if (!fs.existsSync(dir)) { res.json({ reports: [] }); return; }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 5);
  const reports = files.map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; }
  }).filter(Boolean);
  res.json({ reports });
});
```

Mount in web-server.ts:
```typescript
import { curatorApiRouter } from '#core/api/curator-api.js';
app.use('/api/curator', curatorApiRouter);
```

#### 6. Show curator report in packs page

At the bottom of packages/web/assets/web/packs.html, before the end marker, add:

```html
<section style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid var(--border)">
  <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--muted);margin-bottom:0.65rem">Learning loop</div>
  <div id="curator-info" style="font-size:0.82rem;color:var(--muted)">Checking...</div>
</section>
<script>
fetch('/api/curator/last-run').then(function(r){return r.json();}).then(function(d){
  var el=document.getElementById('curator-info');
  if(!d.lastRun){el.textContent='No curator run recorded yet.';return;}
  var ago=Math.round((Date.now()-new Date(d.lastRun).getTime())/3600000);
  el.textContent='Last run: '+d.lastRun.slice(0,10)+' ('+ago+'h ago). Next run in 7 days.';
});
</script>
```

### Verification

- Default CARINA_CURATOR_INTERVAL_DAYS is now 7 (log shows "Skill curator enabled (every 168h)")
- Restart Carina twice quickly: curator does NOT re-run the second time (run-if-overdue works)
- GET /api/curator/last-run returns last run timestamp
- GET /api/curator/report returns array of reports (may be empty on fresh install)
- Packs page footer shows "Learning loop" section with last run date

---

## Prompt 4: SearXNG Self-Hosted Search Integration

### Context

src/tools/web-search-provider.ts supports only 'brave' and 'tavily'. SearchProvider type is 'brave' | 'tavily'.
SearXNG is a self-hosted metasearch engine aggregating Google, Bing, DuckDuckGo, and others.
Integration gives Carina a free, privacy-preserving, self-hosted search option.

SearXNG JSON API: GET http://<SEARXNG_URL>/search?q=<query>&format=json&categories=general
Response shape: { results: [{ title, url, content, engine }] }

### Tasks

#### 1. Add SearXNG config to src/config/index.ts

After the tavily block, add:
```typescript
searxng: {
  url: process.env.SEARXNG_URL ?? '',
},
```

Update the search.provider block to accept 'searxng':
```typescript
search: {
  provider: (() => {
    const raw = (process.env.SEARCH_PROVIDER ?? '').trim().toLowerCase();
    if (raw === 'brave' || raw === 'tavily' || raw === 'searxng') return raw;
    return 'auto' as const;
  })(),
},
```

#### 2. Update src/tools/web-search-provider.ts

Change SearchProvider type:
```typescript
export type SearchProvider = 'brave' | 'tavily' | 'searxng';
```

Update resolveSearchProvider() to auto-detect SearXNG before Tavily:
```typescript
export function resolveSearchProvider(): SearchProvider {
  const pref = config.search.provider;
  if (pref === 'brave') return 'brave';
  if (pref === 'tavily') return 'tavily';
  if (pref === 'searxng') return 'searxng';
  // Auto-detect: SearXNG first (self-hosted = free), then Tavily, then Brave
  if (config.searxng.url) return 'searxng';
  if (config.tavily.apiKey) return 'tavily';
  if (config.brave.apiKey) return 'brave';
  throw new Error(
    'No search provider configured. Options: ' +
    'SEARCH_PROVIDER=searxng + SEARXNG_URL=http://localhost:8888, ' +
    'or TAVILY_API_KEY, or BRAVE_SEARCH_API_KEY.',
  );
}
```

Update searchProviderName():
```typescript
export function searchProviderName(provider: SearchProvider): string {
  if (provider === 'tavily') return 'Tavily';
  if (provider === 'brave') return 'Brave Search';
  return 'SearXNG';
}
```

#### 3. Add SearXNG search function

```typescript
export async function searchSearxng(query: string): Promise<Array<{ title: string; url: string; content: string }>> {
  if (!config.searxng.url) throw new Error('SEARXNG_URL is not configured');
  const url = new URL('/search', config.searxng.url);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', 'general');
  url.searchParams.set('language', 'en');
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error('SearXNG error: HTTP ' + res.status);
  const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
  return (data.results ?? []).slice(0, 10).map((r) => ({
    title: r.title ?? '', url: r.url ?? '', content: r.content ?? '',
  }));
}
```

#### 4. Wire SearXNG into the search dispatcher

Find the function in src/tools/web-search.ts (or wherever brave/tavily are dispatched). Add:
```typescript
if (provider === 'searxng') {
  const results = await searchSearxng(query);
  return results.map((r) => r.title + '\n' + r.url + '\n' + r.content).join('\n\n---\n\n');
}
```

#### 5. Update buildSearchProviderContext() in web-search-provider.ts

Add a SearXNG branch:
```typescript
if (provider === 'searxng') {
  return 'Web search is configured (SearXNG self-hosted). Use the web-search tool for any current information lookup. Results include title, url, and snippet from multiple engines.';
}
```

#### 6. Docker Compose entry (add to docker-compose.yml in core.carinaai.uk)

```yaml
  searxng:
    image: searxng/searxng:latest
    ports:
      - "8888:8080"
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888
    volumes:
      - ./docker/searxng:/etc/searxng
    restart: unless-stopped
```

Create docker/searxng/settings.yml:
```yaml
use_default_settings: true
server:
  secret_key: "change-me-in-production"
  bind_address: "0.0.0.0:8080"
search:
  safe_search: 0
  formats:
    - html
    - json
```

Add to .env.production.example:
```
# SearXNG self-hosted search (alternative to Tavily/Brave - free and private)
SEARXNG_URL=
```

### Verification

- SEARCH_PROVIDER=searxng SEARXNG_URL=http://localhost:8888 pnpm dev
- Ask Carina a factual question: it uses SearXNG
- resolveSearchProvider() returns 'searxng' when SEARXNG_URL is set and SEARCH_PROVIDER is unset
- searchProviderName('searxng') returns 'SearXNG'
- Docker: docker-compose up searxng starts SearXNG on port 8888

---

## Prompt 5: Trello Integration Tool

### Context

Carina has no Trello tool. Add a trello tool to src/tools/ following the same pattern as other tools in the directory. The tool will list boards, list cards, create cards, move cards, add comments, and archive cards.

Trello API base: https://api.trello.com/1/
Auth: key=<TRELLO_API_KEY>&token=<TRELLO_TOKEN> appended as query params.

### Tasks

#### 1. Add to src/config/index.ts

```typescript
trello: {
  apiKey: process.env.TRELLO_API_KEY ?? '',
  token: process.env.TRELLO_TOKEN ?? '',
},
```

#### 2. Create src/tools/trello.ts

```typescript
import { config } from '../config/index.js';

const BASE = 'https://api.trello.com/1';

function auth() { return 'key=' + config.trello.apiKey + '&token=' + config.trello.token; }

async function tGet(path: string): Promise<unknown> {
  const res = await fetch(BASE + path + '?' + auth(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error('Trello HTTP ' + res.status + ' on ' + path);
  return res.json();
}

async function tPost(path: string, body: Record<string, string>): Promise<unknown> {
  const p = new URLSearchParams({ ...body, key: config.trello.apiKey, token: config.trello.token });
  const res = await fetch(BASE + path, { method: 'POST', body: p, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error('Trello HTTP ' + res.status + ' on POST ' + path);
  return res.json();
}

async function tPut(path: string, body: Record<string, string>): Promise<unknown> {
  const p = new URLSearchParams({ ...body, key: config.trello.apiKey, token: config.trello.token });
  const res = await fetch(BASE + path, { method: 'PUT', body: p, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error('Trello HTTP ' + res.status + ' on PUT ' + path);
  return res.json();
}

export const trelloTool = {
  name: 'trello',
  description: 'Interact with Trello. Actions: list-boards, list-lists, list-cards, get-card, create-card, move-card, add-comment, archive-card.',
  parameters: {
    type: 'object' as const,
    properties: {
      action: { type: 'string', enum: ['list-boards','list-lists','list-cards','get-card','create-card','move-card','add-comment','archive-card'] },
      boardId: { type: 'string' },
      listId: { type: 'string' },
      cardId: { type: 'string' },
      name: { type: 'string' },
      desc: { type: 'string' },
      text: { type: 'string' },
    },
    required: ['action'] as const,
  },
  confirmationRequired: (p: Record<string, string>) =>
    ['create-card','move-card','archive-card','add-comment'].includes(p.action),

  async execute(p: Record<string, string>): Promise<string> {
    if (!config.trello.apiKey || !config.trello.token) {
      return 'Trello is not configured. Set TRELLO_API_KEY and TRELLO_TOKEN. Get them at https://trello.com/app-key';
    }
    switch (p.action) {
      case 'list-boards': {
        const boards = await tGet('/members/me/boards?fields=id,name,url') as Array<{ id: string; name: string; url: string }>;
        return boards.map((b) => b.name + ' (' + b.id + '): ' + b.url).join('\n');
      }
      case 'list-lists': {
        if (!p.boardId) return 'boardId required';
        const lists = await tGet('/boards/' + p.boardId + '/lists?fields=id,name') as Array<{ id: string; name: string }>;
        return lists.map((l) => l.name + ' (' + l.id + ')').join('\n');
      }
      case 'list-cards': {
        if (!p.listId) return 'listId required';
        const cards = await tGet('/lists/' + p.listId + '/cards?fields=id,name,due,url') as Array<{ id: string; name: string; due?: string; url: string }>;
        return cards.map((c) => c.name + ' (' + c.id + ')' + (c.due ? ' due:' + c.due.slice(0, 10) : '') + '\n  ' + c.url).join('\n');
      }
      case 'get-card': {
        if (!p.cardId) return 'cardId required';
        const c = await tGet('/cards/' + p.cardId + '?fields=id,name,desc,due,url,idList') as Record<string, string>;
        return 'Name: ' + c.name + '\nID: ' + c.id + '\nList: ' + c.idList + '\nDesc: ' + (c.desc || '(none)') + '\nDue: ' + (c.due || 'none') + '\nURL: ' + c.url;
      }
      case 'create-card': {
        if (!p.listId || !p.name) return 'listId and name required';
        const c = await tPost('/cards', { idList: p.listId, name: p.name, desc: p.desc ?? '' }) as Record<string, string>;
        return 'Created: ' + c.name + ' (' + c.id + ') at ' + c.url;
      }
      case 'move-card': {
        if (!p.cardId || !p.listId) return 'cardId and listId (destination) required';
        await tPut('/cards/' + p.cardId, { idList: p.listId });
        return 'Card ' + p.cardId + ' moved to list ' + p.listId;
      }
      case 'add-comment': {
        if (!p.cardId || !p.text) return 'cardId and text required';
        await tPost('/cards/' + p.cardId + '/actions/comments', { text: p.text });
        return 'Comment added to card ' + p.cardId;
      }
      case 'archive-card': {
        if (!p.cardId) return 'cardId required';
        await tPut('/cards/' + p.cardId, { closed: 'true' });
        return 'Card ' + p.cardId + ' archived';
      }
      default: return 'Unknown action: ' + p.action;
    }
  },
};
```

#### 3. Register in src/tools/index.ts

Find where other tools are registered. Add:
```typescript
import { trelloTool } from './trello.js';
registry.register(trelloTool);
```

#### 4. Add to .env.production.example

```
# Trello (optional)
TRELLO_API_KEY=
TRELLO_TOKEN=
```

### Verification

- Ask Carina: "list my Trello boards"
- Ask Carina: "create a card called Fix login bug in list <listId>"
- Ask Carina: "add a comment 'Started investigation' to Trello card <cardId>"
- trelloTool.execute({ action: 'list-boards' }) returns formatted board list

---

## Prompt 6: Workspace Polish - PWA, Mobile Bottom Nav, Touch Swipe, Empty States

### Context

The Carina workspace is functional but visually behind Odysseus on mobile and polish.
Target: PWA offline, mobile bottom nav, touch swipe sidebar, loading skeletons, empty states.

No new frameworks. All vanilla JS and CSS within existing HTML files.

### Tasks

#### 1. Replace or augment packages/web/assets/web/service-worker.js

Add a cache-first strategy for workspace shells:

```javascript
var CACHE = 'carina-ws-v2';
var SHELLS = [
  '/', '/workspace', '/notes', '/calendar', '/documents', '/images',
  '/email', '/memory', '/kanban', '/webhooks', '/packs', '/cookbook',
  '/compare', '/research', '/manifest.json', '/icon.svg',
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(SHELLS); }).then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/acp/')) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(cached) {
    if (cached) return cached;
    return fetch(e.request).then(function(res) {
      if (res.ok && e.request.method === 'GET') {
        var clone = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
      }
      return res;
    });
  }));
});
```

#### 2. Update packages/web/src/workspace-chrome.ts

In the CSS returned by workspaceThemeCss() or equivalent, append:

```css
/* Mobile bottom nav */
.carina-ws-bottom-nav {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--surface); border-top: 1px solid var(--border);
  justify-content: space-around; padding: 6px 0 max(6px, env(safe-area-inset-bottom)); z-index: 50;
}
@media (max-width: 640px) {
  .carina-ws-bottom-nav { display: flex; }
  .carina-ws-sidebar {
    transform: translateX(-100%); position: fixed; top: 0; bottom: 0; left: 0; z-index: 60;
    transition: transform .2s ease;
  }
  .carina-ws-sidebar.mobile-open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.5); }
  .carina-ws-main { padding-bottom: 60px; }
}
.carina-ws-bottom-nav a {
  display: flex; flex-direction: column; align-items: center; font-size: 0.6rem;
  color: var(--muted); text-decoration: none; gap: 2px; padding: 2px 8px;
}
.carina-ws-bottom-nav a.active { color: var(--accent); }
/* Card hover lift */
.ws-card { transition: transform .12s, box-shadow .12s; }
.ws-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
/* Loading skeleton */
.skeleton {
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3,#2a2a3a) 50%, var(--surface-2) 75%);
  background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 6px;
}
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
```

In workspaceSidebarHtml() or the equivalent function that generates sidebar HTML, append a mobile bottom nav:

```typescript
const mobileNav = `<nav class="carina-ws-bottom-nav">
  <a href="/">Chat</a>
  <a href="/notes">Notes</a>
  <a href="/documents">Docs</a>
  <a href="/cookbook">Cookbook</a>
  <a href="/workspace">More</a>
</nav>`;
// Return existing html + mobileNav
```

#### 3. Update packages/web/assets/web/workspace-prefs.js

After the existing theme setup, add:

```javascript
(function() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js').catch(function() {});
    });
  }

  // Touch swipe to open sidebar on mobile
  var touchStartX = 0;
  var touchStartY = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
      var sidebar = document.querySelector('.carina-ws-sidebar');
      if (!sidebar) return;
      if (dx > 0 && touchStartX < 32) sidebar.classList.add('mobile-open');
      else if (dx < 0) sidebar.classList.remove('mobile-open');
    }
  }, { passive: true });

  // Mark current nav item active
  var currentPath = window.location.pathname;
  document.querySelectorAll('.carina-ws-nav a, .carina-ws-bottom-nav a').forEach(function(a) {
    if (a.getAttribute('href') === currentPath) a.classList.add('active');
  });
})();
```

#### 4. Add skeleton render helpers to each workspace JS file

At the top of notes.js, documents.js, email.js (and any others), add:

```javascript
function renderSkeleton(container, count) {
  container.innerHTML = Array.from({ length: count }, function() {
    return '<div class="skeleton" style="height:60px;margin-bottom:8px;"></div>';
  }).join('');
}
```

Call renderSkeleton(listContainer, 4) before the first fetch in each file, then replace with real content when data arrives.

#### 5. Add empty states in each workspace page

In the render function of each page, when the data array is empty:

Notes:
```javascript
if (!notes.length) {
  container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted)"><p style="font-size:1.05rem;font-weight:600;margin-bottom:0.5rem">No notes yet</p><p style="font-size:0.82rem">Ask Carina to create a note or click New note</p></div>';
}
```

Documents:
```javascript
if (!docs.length) {
  container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted)"><p style="font-size:1.05rem;font-weight:600;margin-bottom:0.5rem">No documents yet</p><p style="font-size:0.82rem">Ask Carina to draft a document or click Upload</p></div>';
}
```

Email:
```javascript
if (!emails.length) {
  container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted)"><p style="font-size:1.05rem;font-weight:600;margin-bottom:0.5rem">No emails</p><p style="font-size:0.82rem">Configure IMAP_HOST in .env and click Sync IMAP, or connect a Resend inbound webhook</p></div>';
}
```

### Verification

- Resize browser to 480px wide: bottom nav appears, sidebar hides
- Swipe right from left edge on mobile: sidebar slides in
- Swipe left: sidebar closes
- Empty notes page: helpful prompt appears
- Loading: skeleton cards appear before data
- Service worker: check DevTools > Application > Service Workers shows registered
- Offline: workspace shells load from cache

---

## Prompt 7: Agent-Authored Themes

### Context

Carina has dark/light themes. Odysseus has customizable themes. This prompt adds:
1. A theme tool so Carina (or the operator) can define custom themes via chat
2. POST /api/theme API to store custom themes
3. Application of custom themes via CSS variables from localStorage

### Tasks

#### 1. Create src/api/theme-api.ts

```typescript
import { Router } from 'express';

export interface WorkspaceTheme {
  name: string; bg: string; surface: string; text: string;
  muted: string; accent: string; border: string; createdAt: string;
}

const operatorThemes = new Map<string, WorkspaceTheme>();

export const themeApiRouter = Router();

themeApiRouter.get('/', (_req, res) => {
  res.json({ themes: Array.from(operatorThemes.values()) });
});

themeApiRouter.post('/', (req, res) => {
  const { name, bg, accent, surface, text, muted, border } = req.body as Partial<WorkspaceTheme>;
  if (!name || !bg || !accent) { res.status(400).json({ error: 'name, bg, accent required' }); return; }
  const theme: WorkspaceTheme = {
    name, bg, surface: surface ?? bg, text: text ?? '#e4e4e9',
    muted: muted ?? '#575768', accent, border: border ?? 'rgba(255,255,255,0.07)',
    createdAt: new Date().toISOString(),
  };
  operatorThemes.set(name, theme);
  res.json({ theme });
});

themeApiRouter.delete('/:name', (req, res) => {
  operatorThemes.delete(req.params.name);
  res.json({ ok: true });
});
```

Mount in web-server.ts: app.use('/api/theme', themeApiRouter);

#### 2. Create src/tools/theme.ts

```typescript
import { config } from '../config/index.js';

export const themeTool = {
  name: 'theme',
  description: 'Set, list, or reset the workspace color theme. Use when the operator asks to change the look of the workspace. Actions: set, list, reset.',
  parameters: {
    type: 'object' as const,
    properties: {
      action: { type: 'string', enum: ['set', 'list', 'reset'] },
      name: { type: 'string', description: 'Theme name' },
      bg: { type: 'string', description: 'Background color hex, e.g. #0a0a14' },
      accent: { type: 'string', description: 'Accent color hex, e.g. #7c6aff' },
      surface: { type: 'string', description: 'Surface color hex' },
      text: { type: 'string', description: 'Text color hex' },
    },
    required: ['action'] as const,
  },
  async execute(p: Record<string, string>): Promise<string> {
    const port = config.server.port;
    const base = 'http://localhost:' + port;
    if (p.action === 'list') {
      const r = await fetch(base + '/api/theme');
      const d = await r.json() as { themes: Array<{ name: string }> };
      if (!d.themes.length) return 'No custom themes. Use action="set" with name, bg, and accent to create one.';
      return d.themes.map((t) => t.name).join(', ');
    }
    if (p.action === 'set') {
      if (!p.name || !p.bg || !p.accent) return 'name, bg, and accent are required.';
      await fetch(base + '/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.name, bg: p.bg, accent: p.accent, surface: p.surface, text: p.text }),
      });
      return 'Theme "' + p.name + '" saved. Accent: ' + p.accent + ', Background: ' + p.bg + '. The workspace applies it when the user selects it in the theme picker.';
    }
    if (p.action === 'reset') {
      if (!p.name) return 'Provide name to delete.';
      await fetch(base + '/api/theme/' + encodeURIComponent(p.name), { method: 'DELETE' });
      return 'Theme "' + p.name + '" removed.';
    }
    return 'Unknown action: ' + p.action;
  },
};
```

Register in src/tools/index.ts.

#### 3. Update packages/web/assets/web/workspace-prefs.js

Add after the existing theme toggle:

```javascript
// Apply custom operator theme if active
(function() {
  var active = localStorage.getItem('carina:active-theme');
  if (!active) return;
  fetch('/api/theme').then(function(r) { return r.json(); }).then(function(d) {
    var theme = (d.themes || []).find(function(t) { return t.name === active; });
    if (!theme) return;
    var s = document.documentElement.style;
    s.setProperty('--bg', theme.bg);
    s.setProperty('--surface', theme.surface || theme.bg);
    s.setProperty('--text', theme.text || '#e4e4e9');
    s.setProperty('--muted', theme.muted || '#575768');
    s.setProperty('--accent', theme.accent);
    s.setProperty('--border', theme.border || 'rgba(255,255,255,0.07)');
    s.setProperty('--accent-dim', theme.accent + '22');
  }).catch(function() {});
})();

// Theme picker: add a <select> to any page that has id="ws-theme-picker"
(function() {
  var picker = document.getElementById('ws-theme-picker');
  if (!picker) return;
  fetch('/api/theme').then(function(r) { return r.json(); }).then(function(d) {
    var active = localStorage.getItem('carina:active-theme') || '';
    picker.innerHTML = '<option value="">Default dark</option>' +
      (d.themes || []).map(function(t) {
        return '<option value="' + t.name + '"' + (t.name === active ? ' selected' : '') + '>' + t.name + '</option>';
      }).join('');
    picker.onchange = function() {
      localStorage.setItem('carina:active-theme', picker.value);
      location.reload();
    };
  });
})();
```

#### 4. Add theme picker to workspace sidebar

In workspaceSidebarHtml() in workspace-chrome.ts, add at the bottom of the sidebar:

```typescript
const themePicker = '<div style="padding:0.5rem 0.85rem;margin-top:auto">' +
  '<label style="font-size:0.7rem;color:var(--muted);display:block;margin-bottom:0.3rem">Theme</label>' +
  '<select id="ws-theme-picker" style="width:100%;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.3rem 0.4rem;font-size:0.78rem"></select>' +
  '</div>';
// Append to return value
```

### Verification

- Ask Carina: "set the workspace theme to deep ocean: bg #040d1a, accent #00d4ff"
- Carina calls theme(action="set", ...)
- GET /api/theme returns the new theme
- Workspace sidebar shows theme picker
- Select the new theme: page reloads with new colors

---

## Prompt 8: Named Features - Deep Research and Model Compare as First-Class Products

### Context

The /research and /compare workspace pages exist (or will after the fix-workspace-surfaces prompt). This prompt ensures they are named, branded, and surfaced prominently across the workspace.

### Tasks

#### 1. Update workspace chrome nav labels

In packages/web/src/workspace-chrome.ts, WORKSPACE_NAV_ITEMS:

- research nav item: change label to 'Deep Research', description to 'AI-powered multi-step research with citations'
- compare nav item: change label to 'Model Compare', description to 'Query all configured LLM providers side by side'
- cookbook nav item: label 'Cookbook', description 'Hardware-aware local model serving'

#### 2. Mark featured pages in workspace hub

In the function that renders workspace hub cards (packages/web/assets/web/workspace.html or workspace-chrome.ts), add a featured marker to research, compare, and cookbook:

Find the card render loop. Add logic:
```typescript
const featuredIds = ['research', 'compare', 'cookbook'];
const badge = featuredIds.includes(item.id)
  ? '<span style="font-size:0.62rem;background:var(--accent);color:#0d0d0f;padding:0.1rem 0.35rem;border-radius:4px;margin-left:0.4rem;font-weight:700;vertical-align:middle">New</span>'
  : '';
// Append badge to the card title
```

#### 3. Add first-run intro panel to research.html

Before the query form, inside the workspace markers:

```html
<div id="research-intro" style="background:rgba(25,196,154,0.06);border:1px solid rgba(25,196,154,0.18);border-radius:10px;padding:0.85rem 1rem;margin-bottom:1rem;font-size:0.82rem;line-height:1.55">
  <strong>Carina Deep Research</strong> runs a multi-step loop: web search, source evaluation, synthesis, citation. Type a question and press Enter.
  <br>Examples: "What are the top open-source LLMs in 2026?" or "Summarise the latest UK property market trends."
  <button id="dismiss-intro" style="float:right;background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.9rem">x</button>
</div>
<script>
(function(){
  if(localStorage.getItem('carina:research-intro-done')){document.getElementById('research-intro').style.display='none';}
  document.getElementById('dismiss-intro').onclick=function(){document.getElementById('research-intro').style.display='none';localStorage.setItem('carina:research-intro-done','1');};
})();
</script>
```

#### 4. Add first-run intro panel to compare.html

```html
<div id="compare-intro" style="background:rgba(25,196,154,0.06);border:1px solid rgba(25,196,154,0.18);border-radius:10px;padding:0.85rem 1rem;margin-bottom:1rem;font-size:0.82rem;line-height:1.55">
  <strong>Carina Model Compare</strong> runs the same prompt across all your configured LLM providers simultaneously. Enable blind mode to hide provider names until all results are in.
  <button id="dismiss-compare-intro" style="float:right;background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.9rem">x</button>
</div>
<script>
(function(){
  if(localStorage.getItem('carina:compare-intro-done')){document.getElementById('compare-intro').style.display='none';}
  document.getElementById('dismiss-compare-intro').onclick=function(){document.getElementById('compare-intro').style.display='none';localStorage.setItem('carina:compare-intro-done','1');};
})();
</script>
```

#### 5. Update system prompt mention in src/agents/system-prompt.ts

In buildBaseSystemPrompt(), find the line about web search mentioning Tavily. After it, add:

```typescript
'Workspace features: /notes (notes), /documents (documents), /email (email triage), /calendar (events and reminders), /cookbook (local model discovery), /research (Deep Research - multi-step cited research), /compare (Model Compare - side-by-side provider responses), /images (image generation and editing). Always tell the operator where in the workspace to find a result.'
```

Add this as a separate part in buildSystemPromptParts().

### Verification

- Navigate to /workspace: research, compare, cookbook cards have "New" badge
- Navigate to /research: intro panel appears on first visit, dismissed on x, gone on reload
- Navigate to /compare: intro panel appears on first visit
- Sidebar nav shows "Deep Research" and "Model Compare" labels

---


