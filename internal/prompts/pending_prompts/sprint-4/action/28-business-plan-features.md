# Sprint 4 - Prompt h/01: Business Plan Features

**Sprint:** 4 - Foundation
**Prompt number:** h/01
**Name:** White-label portal, custom Aiva training (knowledge base), custom Scout governance rules
**Primary agent:** Cursor (white-label UI + knowledge base UI) + Claude Code (backend)
**Estimated hours:** 12-16 h
**Depends on:** sprint-4/ai-employee/03-worker-brain.md, sprint-5/aiva-billing (Business tier must exist)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/h/`.

---

## Read First

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - specifically `buildPersonaPrompt`; knowledge base is injected here
2. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/workers/[id]/page.tsx` - Aiva detail page; new "Training" tab goes here
3. `frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/` - workspace settings; white-label settings go here
4. `backends/servers/core.carinaai.uk/src/scout/scout-client.ts` - how Scout events are reported; governance rules intercept here

---

## Context

These three features are listed on the Business plan pricing card. All three must be fully
functional before the Business tier can be sold. None are "coming soon."

**White-label:** Business plan customers can serve the web chat widget and optionally the
workspace portal under their own brand (logo, primary color, custom domain for the portal).

**Custom training:** Business plan customers can upload documents and FAQ pairs that are
injected into their Aiva's context on every message, giving the Aiva specific knowledge about
their business.

**Custom Scout governance rules:** Business plan customers can override the global rogue detection
thresholds for their workspace. For example, a high-volume outreach agency can raise the
volume_spike threshold so their Aiva is not flagged for normal operating volume.

---

## Part 1: White-label

### Step 1.1: White-label settings schema

Add to migration:
```sql
CREATE TABLE IF NOT EXISTS workspace_branding (
  workspace_id      UUID    PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  logo_url          TEXT,           -- URL to uploaded logo (served from storage)
  primary_color     TEXT NOT NULL DEFAULT '#f59e0b',  -- hex color
  company_name      TEXT,           -- shown in widget header instead of Aiva name
  custom_domain     TEXT,           -- e.g. 'chat.theircustomdomain.com'
  custom_domain_verified BOOLEAN NOT NULL DEFAULT false,
  hide_verlox_attribution BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 1.2: Logo upload

Add to core backend:
```
POST /api/workspace/branding/logo    Upload a logo image (multipart/form-data)
GET  /api/workspace/branding         Get current branding settings
PATCH /api/workspace/branding        Update branding settings
```

Logo upload:
- Accept: image/png, image/jpeg, image/svg+xml, image/webp
- Max size: 2MB
- Store in: local filesystem at `/var/www/uploads/logos/{workspaceId}.{ext}` (v1)
  Serve at: `https://core.carinaai.uk/uploads/logos/{workspaceId}.{ext}`
- Thumbnail: generate a 200px version using the `sharp` library
- `npm install sharp`

Nginx config for serving uploads:
```nginx
location /uploads/ {
    root /var/www;
    expires 30d;
    add_header Cache-Control "public, immutable";
    # Security: only allow image types
    location ~* \.(png|jpg|jpeg|svg|webp)$ { try_files $uri =404; }
    location ~ { return 404; }
}
```

### Step 1.3: Widget uses branding

In `GET /api/widget/:workerId/config`, add branding:
```typescript
// Join with workspace_branding
// Returns:
// accentColor: branding.primary_color,
// companyName: branding.company_name || worker.name,
// logoUrl: branding.logo_url,
// hideAttribution: branding.hide_verlox_attribution,
```

In the widget, if `logoUrl` is set, show the logo image in the panel header instead of the
wordmark. If `hideAttribution` is true, remove the "Powered by VERLOX" footer.

### Step 1.4: White-label settings page

Add `src/app/(workspace)/settings/branding/page.tsx` in `app.carinaai.uk`:

```
[Section: Logo]
  [Upload area - drag and drop or click]
  [Preview of uploaded logo]
  [Remove logo button]

[Section: Brand color]
  [Color picker input - hex value]
  [Preview swatch]

[Section: Company name in widget]
  [Text input: "Your company name (shown to clients)"]

[Section: Custom domain (Business plan only)]
  [Text input: e.g. chat.yourcompany.com]
  [Verification instructions:]
  Add a CNAME record at your DNS provider:
    Host: chat
    Points to: widget.carinaai.uk
  [Check verification button]
  [Status: Verified / Not verified]

[Section: Attribution]
  [Toggle: Hide "Powered by VERLOX" in widget]
  [Note: "Available on Business plan"]

[Section: Live preview]
  [Simulated widget panel with current settings applied]

[Save button]
```

Gate the custom domain and hide attribution sections to Business plan only. Show with a
"Business plan required" lock if the workspace is on a lower tier.

### Step 1.5: Custom domain verification

When the workspace owner clicks "Check verification":

```typescript
// POST /api/workspace/branding/verify-domain
// Body: { domain: string }
// 1. DNS CNAME lookup: dns.promises.resolveCname(domain) -> should point to 'widget.carinaai.uk'
// 2. If verified: UPDATE workspace_branding SET custom_domain_verified=true
// 3. Add an Nginx server_name entry dynamically OR use a wildcard cert approach
// For v1: document that VERLOX team must manually add the domain to Nginx config
//   The verification just checks DNS; Nginx config is updated by VERLOX team
//   Show: "DNS verified. Our team will activate your custom domain within 24 hours."
//   Send VERLOX team an email (lordsesame@gmail.com) notifying of the new domain
```

---

## Part 2: Custom Aiva training (knowledge base)

### Step 2.1: Knowledge base schema

Add to migration:
```sql
CREATE TABLE IF NOT EXISTS aiva_knowledge_base (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id     UUID        NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL,
  type          TEXT        NOT NULL,  -- 'document' | 'faq'
  title         TEXT        NOT NULL,
  content       TEXT        NOT NULL,  -- full text content
  char_count    INTEGER     NOT NULL DEFAULT 0,
  enabled       BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON aiva_knowledge_base(worker_id, enabled);
```

Total knowledge base size limit per Aiva: 50,000 characters (to stay within context window limits).
Check total char_count before allowing new entries.

### Step 2.2: Document text extraction

When a user uploads a document (PDF, DOCX, TXT):

```typescript
// npm install pdf-parse mammoth
// pdf-parse: extract text from PDF
// mammoth: extract text from DOCX

// POST /api/aiva/workers/:id/knowledge/document
// Multipart/form-data: { file, title }
// 1. Accept: .pdf, .docx, .txt (max 5MB)
// 2. Extract text:
//    PDF: pdfParse(buffer).then(data => data.text)
//    DOCX: mammoth.extractRawText({ buffer }).then(r => r.value)
//    TXT: buffer.toString('utf8')
// 3. Truncate to first 20,000 chars if longer (with a note appended: "[Document truncated to 20,000 characters]")
// 4. INSERT into aiva_knowledge_base: type='document', title, content
// 5. Check total char_count for this worker; if > 50,000: reject with 400
// 6. Return: { id, title, charCount, type }
```

### Step 2.3: FAQ pairs

```typescript
// POST /api/aiva/workers/:id/knowledge/faq
// Body: { question: string; answer: string }
// Combined length must be < 500 chars per pair
// INSERT into aiva_knowledge_base: type='faq', title=question, content=`Q: ${question}\nA: ${answer}`
```

### Step 2.4: Knowledge injection into persona prompt

In `buildPersonaPrompt()` (aiva-api.ts), after the existing persona construction:

```typescript
// Fetch enabled knowledge base entries for this worker
const knowledge = await db.query(
  'SELECT type, title, content FROM aiva_knowledge_base WHERE worker_id=$1 AND enabled=true ORDER BY type, created_at',
  [workerId]
);

if (knowledge.rows.length > 0) {
  const kbSection = [
    '--- Knowledge Base ---',
    'Use the following information to answer questions accurately. Prioritize this information over general knowledge when it is relevant.',
    '',
    ...knowledge.rows.map(row =>
      row.type === 'faq'
        ? row.content
        : `[${row.title}]\n${row.content}`
    ),
    '--- End Knowledge Base ---',
  ].join('\n');

  personaPrompt = personaPrompt + '\n\n' + kbSection;
}
```

### Step 2.5: Training tab in Aiva detail page

Add "Training" tab to the Aiva detail page (between Automations and Settings):

```
[Tab: Training]

[Section: Documents]
  [Upload button: "Add document"] -> opens file picker
  [List of uploaded documents:]
    [title] [char count] [type badge] [enabled toggle] [delete button]
  [Empty state: "No documents added. Upload a PDF, DOCX, or TXT file to give your Aiva specific knowledge."]

[Section: FAQ pairs]
  [Add FAQ button] -> inline form
    Question: [text input]
    Answer: [textarea]
    [Save] [Cancel]
  [List of FAQ pairs:]
    [Q: ...] [A: ...truncated] [enabled toggle] [delete button]
  [Empty state: "No FAQ pairs added. Add question-answer pairs to train your Aiva."]

[Section: Usage]
  [Progress bar: N,NNN / 50,000 characters used]
  [Note: "Character limit includes all documents and FAQ pairs combined."]
```

Backend routes:
```
GET    /api/aiva/workers/:id/knowledge         List all knowledge entries
POST   /api/aiva/workers/:id/knowledge/document  Upload document
POST   /api/aiva/workers/:id/knowledge/faq       Add FAQ pair
PATCH  /api/aiva/workers/:id/knowledge/:entryId  Toggle enabled / update
DELETE /api/aiva/workers/:id/knowledge/:entryId  Delete entry
```

---

## Part 3: Custom Scout governance rules

### Step 3.1: Governance rules schema

Add to migration:
```sql
CREATE TABLE IF NOT EXISTS aiva_scout_governance (
  workspace_id          UUID    PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  volume_spike_threshold INTEGER NOT NULL DEFAULT 50,
    -- messages per hour before volume_spike fires; default 50
  escalation_rate_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.30,
    -- escalation rate above this fires high_escalation_rate; default 0.30 (30%)
  escalation_burst_window INTEGER NOT NULL DEFAULT 5,
    -- burst: N escalations within M minutes; M is this value; default 5
  escalation_burst_count INTEGER NOT NULL DEFAULT 3,
    -- burst: N escalations is this value; default 3
  ignore_signal_types TEXT[] NOT NULL DEFAULT '{}',
    -- array of signal types to suppress: e.g. '{volume_spike}'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Step 3.2: Apply governance rules when emitting Scout signals

In `scout-client.ts`, when reporting an event, check workspace governance rules:

```typescript
export async function reportEventWithGovernance(
  event: ScoutEvent,
  db: DatabaseClient,
): Promise<void> {
  const governance = await db.query(
    'SELECT * FROM aiva_scout_governance WHERE workspace_id=$1',
    [event.workspaceId]
  );
  const rules = governance.rows[0];

  if (rules) {
    // Check if this signal type is suppressed
    if (rules.ignore_signal_types.includes(event.eventType)) return;

    // Apply custom thresholds for threshold-based signals
    if (event.eventType === 'volume_spike') {
      const threshold = rules.volume_spike_threshold;
      if (event.metadata?.messagesPerHour < threshold) return;  // below custom threshold, suppress
    }
    if (event.eventType === 'high_escalation_rate') {
      if (event.metadata?.escalationRate < rules.escalation_rate_threshold) return;
    }
    if (event.eventType === 'escalation_burst') {
      if (event.metadata?.count < rules.escalation_burst_count) return;
    }
  }

  await scout.reportEvent(event);
  await insertScoutSignalCache(event, db);
}
```

Replace all `scout.reportEvent()` calls in `aiva-api.ts` with `reportEventWithGovernance()`.

### Step 3.3: Governance settings UI

Add to workspace settings: `src/app/(workspace)/settings/governance/page.tsx`

Show only to Business plan workspaces (gate with a plan check; show locked state for others).

```
[heading] Scout governance rules
[subtext] Customize how Scout monitors your Aiva. These settings override the VERLOX defaults.
          Business plan only.

[Volume spike threshold]
  "Alert me if my Aiva receives more than [N] messages per hour."
  [Number input, min 10, max 1000, default 50]

[Escalation rate threshold]
  "Alert me if more than [N]% of conversations escalate."
  [Number input (%), min 5, max 100, default 30]

[Escalation burst]
  "Alert me if [N] escalations happen within [M] minutes."
  [N input, default 3] escalations within [M input, default 5] minutes

[Suppress signal types]
  [Checklist of signal types:]
    [ ] volume_spike
    [ ] high_escalation_rate
    [ ] escalation_burst
    [ ] unauthorized_tool_attempt
    [ ] tool_failure_loop
  [Note: Suppressing signals hides them from the Scout fleet view and admin dashboard.
         We recommend only suppressing signals that do not apply to your use case.]

[Save settings button]
[Reset to defaults button]
```

Backend routes:
```
GET   /api/workspace/scout-governance    Get current rules (defaults if no custom rules set)
PATCH /api/workspace/scout-governance    Update rules
```

---

## Done When

**White-label:**
- [ ] `workspace_branding` table created
- [ ] Logo upload accepts PNG/JPG/SVG, stores file, serves at /uploads/logos/
- [ ] Widget config endpoint returns branding (color, logo, company name, hide attribution flag)
- [ ] Widget renders with custom color, logo, and without attribution when configured
- [ ] Branding settings page renders with logo upload, color picker, company name, custom domain, attribution toggle
- [ ] Custom domain CNAME verification works; sends notification email to VERLOX team on success
- [ ] Business plan gate shown on custom domain and hide attribution sections

**Custom training:**
- [ ] `aiva_knowledge_base` table created with 50,000 char total limit per Aiva
- [ ] Document upload: PDF, DOCX, TXT accepted; text extracted and stored
- [ ] FAQ pair entry: question + answer stored as formatted text
- [ ] Knowledge base injected into persona prompt on every message
- [ ] Training tab in Aiva detail page with document list, FAQ list, and usage bar
- [ ] Enable/disable toggle per entry works; disabled entries not injected
- [ ] Delete entry works
- [ ] 50,000 char limit enforced on upload/add with a clear error message

**Custom Scout governance:**
- [ ] `aiva_scout_governance` table created with all threshold columns
- [ ] `reportEventWithGovernance()` checks workspace rules before emitting
- [ ] Suppressed signal types not emitted or cached
- [ ] Custom thresholds applied correctly for volume_spike, high_escalation_rate, escalation_burst
- [ ] Governance settings page rendered (locked for non-Business plans)
- [ ] GET and PATCH routes for governance rules work
- [ ] Resetting to defaults restores the hardcoded default values

**General:**
- [ ] All three feature sets gated to Business plan (non-Business sees locked state, not 404)
- [ ] No em dashes in any copy
- [ ] No emojis
