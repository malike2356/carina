# Sprint 4 - Prompt 28: Business Plan Features

**Status: COMPLETED 2026-06-23**

**What was built:** White-label branding (logo upload, colors, custom domain verify with admin notify, widget preview), custom training tab (documents/FAQs, usage bar, plan gate), Scout governance settings (thresholds, signal suppression, plan gate); backend tables, PDF/DOCX extraction, knowledge injection on messages, governance-aware reportEvent.

**Sprint:** 4
**Prompt number:** 28
**Primary agent:** Cursor (UI) + Claude Code (backend)
**Estimated hours:** 12-14 h
**Depends on:** 08-worker-brain.md (buildPersonaPrompt); 17-web-chat-widget.md (widget config endpoint); 23-billing-ui.md (plan tier context); 26-admin-fleet-dashboard.md (scout-client.ts)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `01-devends/prompts/02-archived_prompts/pending_prompts/sprint-4/action/`.

---

## Read First

1. `02-backends/core.carinaai.uk/src/aiva/aiva-api.ts` - find `buildPersonaPrompt`; knowledge base is injected here
2. `02-backends/core.carinaai.uk/src/widget/widget-router.ts` - `GET /api/widget/:workerId/config`; branding is added to this response
3. `02-backends/core.carinaai.uk/src/scout/scout-client.ts` - find where `scout.reportEvent()` is called; you will wrap it
4. `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/aiva/workers/[id]/AivaDetailClient.tsx` - the Aiva detail page; "Training" tab is added here
5. `03-frontends/client-apps/app.carinaai.uk/src/app/(workspace)/settings/` - workspace settings area; two new pages go here
6. `03-frontends/client-apps/app.carinaai.uk/src/lib/aiva-detail-tabs.ts` - `AIVA_CORE_TABS`; you add the Training tab entry here

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

### Step 1.4: Next.js proxy routes for branding

Create in `03-frontends/client-apps/app.carinaai.uk/src/app/api/workspace/branding/`:
```
route.ts               GET + PATCH
logo/route.ts          POST (file upload - forward formData)
verify-domain/route.ts POST
```

### Step 1.5: White-label settings page

Create `src/app/(workspace)/settings/branding/page.tsx`. Add "Branding" to the workspace settings
sidebar nav. Page layout: `max-w-2xl mx-auto p-6 space-y-8`.

**`PlanGateSection` component (used for Business-only sections):**
```tsx
const PLAN_ORDER = { trial: 0, starter: 1, team: 2, business: 3 };

function PlanGateSection({
  planRequired,
  currentPlan,
  children,
}: {
  planRequired: 'business' | 'team';
  currentPlan: string;
  children: React.ReactNode;
}) {
  const sufficient = (PLAN_ORDER[currentPlan] ?? 0) >= PLAN_ORDER[planRequired];
  if (sufficient) return <section className="space-y-3">{children}</section>;

  return (
    <section className="space-y-3 relative">
      <div className="opacity-30 pointer-events-none select-none" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 bg-elevated border border-border
                        rounded-lg px-4 py-2.5 shadow-sm">
          <Lock className="h-3.5 w-3.5 text-text-muted flex-shrink-0" />
          <p className="text-xs text-text-secondary">
            Available on the{' '}
            <a href="/billing" className="text-accent font-medium hover:underline">
              {planRequired.charAt(0).toUpperCase() + planRequired.slice(1)} plan
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
```

**Section: Logo**
```tsx
<section className="space-y-3">
  <div>
    <h2 className="text-sm font-semibold text-text-primary">Logo</h2>
    <p className="text-xs text-text-muted mt-0.5">
      Shown in the widget header. PNG or SVG recommended. Max 2MB.
    </p>
  </div>
  <div className="flex items-start gap-4">
    {/* 64x64 logo preview square */}
    <div className="h-16 w-16 rounded-lg border border-border bg-elevated
                    flex items-center justify-center overflow-hidden flex-shrink-0">
      {branding.logoUrl
        ? <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
        : <ImageIcon className="h-6 w-6 text-text-muted" />
      }
    </div>
    <div>
      <label htmlFor="logo-file"
             className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80
                        cursor-pointer font-medium mb-1">
        <Upload className="h-4 w-4" />
        {branding.logoUrl ? 'Replace logo' : 'Upload logo'}
      </label>
      <input id="logo-file" type="file"
             accept="image/png,image/jpeg,image/svg+xml,image/webp"
             className="sr-only" onChange={handleLogoUpload} />
      <p className="text-[11px] text-text-muted">PNG, JPG, SVG, or WebP. Max 2MB.</p>
      {branding.logoUrl && (
        <button onClick={removeLogo}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors mt-1">
          Remove logo
        </button>
      )}
    </div>
  </div>
</section>
```

**Section: Brand color**
```tsx
<section className="space-y-3">
  <div>
    <h2 className="text-sm font-semibold text-text-primary">Brand color</h2>
    <p className="text-xs text-text-muted mt-0.5">
      Applied to the widget launcher and header. Must contrast with white text.
    </p>
  </div>
  <div className="flex items-center gap-3">
    {/* Native color picker */}
    <input type="color" value={branding.primaryColor}
           onChange={e => update('primaryColor', e.target.value)}
           className="h-10 w-10 rounded-lg border border-border cursor-pointer bg-elevated p-0.5" />
    {/* Hex text input - validates #rrggbb pattern */}
    <input type="text" value={branding.primaryColor}
           onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) update('primaryColor', e.target.value); }}
           className="w-28 bg-base rounded-lg border border-border px-3 py-2 text-sm font-mono
                      text-text-primary outline-none focus:border-accent transition-colors"
           placeholder="#1a5f7a" />
    {/* Live swatch */}
    <div className="h-8 w-8 rounded-full border border-border flex-shrink-0 transition-colors"
         style={{ background: branding.primaryColor }} />
  </div>
</section>
```

**Section: Company name**
```tsx
<section className="space-y-3">
  <div>
    <h2 className="text-sm font-semibold text-text-primary">Company name in widget</h2>
    <p className="text-xs text-text-muted mt-0.5">
      Shown below the Aiva name in the header. Leave blank to omit.
    </p>
  </div>
  <input type="text" value={branding.companyName ?? ''}
         onChange={e => update('companyName', e.target.value)}
         placeholder="Your company name"
         className="w-full max-w-sm bg-base rounded-lg border border-border px-4 py-3 text-sm
                    text-text-primary placeholder:text-text-muted outline-none focus:border-accent" />
</section>
```

**Section: Custom domain (Business only)**
```tsx
<PlanGateSection planRequired="business" currentPlan={workspace.plan}>
  <div>
    <h2 className="text-sm font-semibold text-text-primary">Custom domain</h2>
    <p className="text-xs text-text-muted mt-0.5">
      Serve the widget at your own subdomain, e.g. chat.yourcompany.com.
    </p>
  </div>
  <div className="flex items-center gap-2">
    <input type="text" value={branding.customDomain ?? ''}
           onChange={e => update('customDomain', e.target.value)}
           placeholder="chat.yourcompany.com"
           className="flex-1 max-w-xs bg-base rounded-lg border border-border px-4 py-2.5 text-sm
                      text-text-primary placeholder:text-text-muted outline-none focus:border-accent" />
    <button onClick={handleVerify} disabled={verifying || !branding.customDomain}
            className="text-sm px-4 py-2.5 border border-border rounded-lg text-text-secondary
                       hover:border-accent hover:text-text-primary transition-colors
                       disabled:opacity-40 disabled:cursor-default">
      {verifying ? 'Checking...' : 'Verify DNS'}
    </button>
  </div>
  {/* DNS instructions - shown when domain is filled */}
  {branding.customDomain && (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <p className="text-xs font-medium text-text-primary mb-3">Add this DNS record:</p>
      <div className="grid grid-cols-[64px_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px]">
        <span className="text-text-muted">Type</span><span className="text-text-secondary">CNAME</span>
        <span className="text-text-muted">Host</span><span className="text-text-secondary">chat</span>
        <span className="text-text-muted">Points to</span><span className="text-text-secondary">widget.carinaai.uk</span>
      </div>
    </div>
  )}
  {verifyResult === 'success' && (
    <div className="flex items-center gap-1.5 text-xs text-green-400">
      <Check className="h-3.5 w-3.5" />
      DNS verified. Our team will activate your domain within 24 hours.
    </div>
  )}
  {verifyResult === 'fail' && (
    <p className="text-xs text-red-400">CNAME not found. Check your DNS and try again.</p>
  )}
</PlanGateSection>
```

**Section: Attribution (Business only)**
```tsx
<PlanGateSection planRequired="business" currentPlan={workspace.plan}>
  <h2 className="text-sm font-semibold text-text-primary">Attribution</h2>
  <div className="flex items-start gap-3 mt-3">
    <ToggleSwitch
      checked={branding.hideVerloxAttribution}
      onChange={v => update('hideVerloxAttribution', v)}
    />
    <div>
      <p className="text-sm text-text-secondary">Hide "Powered by VERLOX" in widget footer</p>
      <p className="text-[11px] text-text-muted mt-0.5">
        The footer line is removed entirely when this is enabled.
      </p>
    </div>
  </div>
</PlanGateSection>
```

**Section: Live preview**

The preview is a static JSX mockup of the widget scaled to 70% (`transform: scale(0.7)`). It
reads the current `branding` state directly so it updates live as the user adjusts settings.

```tsx
<section className="space-y-3">
  <div>
    <h2 className="text-sm font-semibold text-text-primary">Preview</h2>
    <p className="text-xs text-text-muted mt-0.5">Updates as you change settings above.</p>
  </div>
  <WidgetPreview branding={branding} workerName="Aria" workerRole="Customer Support" />
</section>
```

`WidgetPreview` renders a 360px panel at 0.7 scale (`transformOrigin: 'top left'`):
- Header: accent-color background; logo `<img>` if `logoUrl` set, else initial-letter circle;
  Aiva name in white; company name below in white/75 if `companyName` set; X close icon
- Two mock message bubbles (one Aiva, one user) in a white area
- Input row with a rounded pill border
- Footer "Powered by VERLOX" in grey - absent when `hideVerloxAttribution` is true

**Save row:**
```tsx
<div className="flex items-center gap-3 pt-4 border-t border-border">
  <button onClick={handleSave} disabled={saving} className="btn-primary px-6 py-2.5 text-sm">
    {saving ? 'Saving...' : 'Save settings'}
  </button>
  {saved && <p className="text-xs text-green-400">Settings saved.</p>}
</div>
```

### Step 1.6: Custom domain verification backend

```typescript
// POST /api/workspace/branding/verify-domain
// Body: { domain: string }
// 1. dns.promises.resolveCname(domain) must resolve to 'widget.carinaai.uk'
// 2. If verified: UPDATE workspace_branding SET custom_domain_verified=true
//    Return: { verified: true }
//    Also: send notification email to lordsesame@gmail.com with domain + workspaceId
// 3. If not verified: Return { verified: false, message: 'CNAME not found.' }
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

### Step 2.5: Next.js proxy routes for knowledge base

Create in `src/app/api/aiva/workers/[id]/knowledge/`:
```
route.ts              GET (list)
document/route.ts     POST (file upload)
faq/route.ts          POST (FAQ pair)
[entryId]/route.ts    PATCH + DELETE
```

### Step 2.6: Training tab in Aiva detail page

Add to `AIVA_CORE_TABS` in `aiva-detail-tabs.ts`:
```typescript
{ id: 'training', label: 'Training', order: 45 },
// order 45 = after Automations (40), before Settings (50)
```

Backend routes required:
```
GET    /api/aiva/workers/:id/knowledge
POST   /api/aiva/workers/:id/knowledge/document
POST   /api/aiva/workers/:id/knowledge/faq
PATCH  /api/aiva/workers/:id/knowledge/:entryId
DELETE /api/aiva/workers/:id/knowledge/:entryId
```

**Training tab layout** (space-y-6 in the tab panel, same as other Aiva detail tabs):

**Documents section:**
```tsx
<div>
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-medium text-text-primary">Documents</h3>
    <label htmlFor="doc-upload"
           className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80
                      cursor-pointer font-medium">
      <Upload className="h-3.5 w-3.5" />
      Add document
    </label>
    <input id="doc-upload" type="file" accept=".pdf,.docx,.txt"
           className="sr-only" onChange={handleDocumentUpload} />
  </div>

  {/* Drag-and-drop dropzone - shown only when list is empty */}
  {docEntries.length === 0 && (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => document.getElementById('doc-upload')?.click()}
      className={cn(
        'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
        dragging ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent/40 hover:bg-elevated',
      )}
    >
      <Upload className="h-5 w-5 text-text-muted mx-auto mb-2" />
      <p className="text-sm text-text-secondary mb-0.5">Drop a file here or click to browse</p>
      <p className="text-[11px] text-text-muted">PDF, DOCX, or TXT. Max 5MB per file.</p>
    </div>
  )}

  {/* Document list */}
  {docEntries.length > 0 && (
    <div className="rounded-lg border border-border bg-elevated overflow-hidden">
      {docEntries.map(entry => (
        <div key={entry.id}
             className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
          <FileText className="h-4 w-4 text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary truncate">{entry.title}</p>
            <p className="text-[11px] text-text-muted">{entry.charCount.toLocaleString()} chars</p>
          </div>
          <span className="text-[10px] bg-accent-dim text-accent px-1.5 py-0.5 rounded flex-shrink-0">
            Doc
          </span>
          <ToggleSwitch checked={entry.enabled} onChange={v => toggleEntry(entry.id, v)} size="sm" />
          <button onClick={() => deleteEntry(entry.id)}
                  className="text-text-muted hover:text-red-400 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

**FAQ pairs section:**
```tsx
<div>
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-medium text-text-primary">FAQ pairs</h3>
    <button onClick={() => setShowFaqForm(true)}
            className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium">
      <Plus className="h-3.5 w-3.5" />
      Add FAQ
    </button>
  </div>

  {/* Inline add form - shown on button click, dismissed on Save or Cancel */}
  {showFaqForm && (
    <div className="rounded-xl border border-accent/30 bg-accent-dim/20 p-4 mb-3 space-y-3">
      <div>
        <label className="block text-[11px] font-medium text-text-muted mb-1">Question</label>
        <input type="text" value={faqQ} onChange={e => setFaqQ(e.target.value)}
               placeholder="e.g. What are your opening hours?" autoFocus
               className="w-full bg-base rounded-lg border border-border px-3 py-2 text-sm
                          text-text-primary placeholder:text-text-muted outline-none focus:border-accent" />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-text-muted mb-1">Answer</label>
        <textarea value={faqA} onChange={e => setFaqA(e.target.value)} rows={3}
                  placeholder="e.g. We are open Monday to Friday, 9am to 5pm GMT."
                  className="w-full bg-base rounded-lg border border-border px-3 py-2 text-sm
                             text-text-primary placeholder:text-text-muted outline-none
                             focus:border-accent resize-none" />
        {/* Character counter - turns red when near limit */}
        <p className={cn(
          'text-[10px] text-right mt-0.5',
          faqQ.length + faqA.length > 450 ? 'text-amber-400' : 'text-text-muted',
        )}>
          {faqQ.length + faqA.length} / 500
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={saveFaq}
                disabled={!faqQ.trim() || !faqA.trim() || faqQ.length + faqA.length > 500}
                className="btn-primary text-xs px-4 py-2">
          Save
        </button>
        <button onClick={() => { setShowFaqForm(false); setFaqQ(''); setFaqA(''); }}
                className="text-xs px-4 py-2 text-text-muted hover:text-text-primary">
          Cancel
        </button>
      </div>
    </div>
  )}

  {/* FAQ list */}
  {faqEntries.length > 0 && (
    <div className="space-y-2">
      {faqEntries.map(entry => (
        <div key={entry.id}
             className="rounded-lg border border-border bg-elevated p-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate mb-0.5">
              Q: {entry.title}
            </p>
            <p className="text-[11px] text-text-muted truncate">
              A: {entry.content.replace(/^Q:.*\nA:\s*/s, '')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ToggleSwitch checked={entry.enabled} onChange={v => toggleEntry(entry.id, v)} size="sm" />
            <button onClick={() => deleteEntry(entry.id)}
                    className="text-text-muted hover:text-red-400 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )}

  {faqEntries.length === 0 && !showFaqForm && (
    <p className="text-xs text-text-muted">
      No FAQ pairs yet. Add question-answer pairs to give your Aiva specific knowledge.
    </p>
  )}
</div>
```

**Usage bar:**
```tsx
function KnowledgeUsageBar({ usedChars, maxChars }: { usedChars: number; maxChars: number }) {
  const pct = Math.min(100, (usedChars / maxChars) * 100);
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-accent';
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-text-primary">Knowledge base usage</p>
        <p className="text-xs text-text-muted">
          {usedChars.toLocaleString()} / {maxChars.toLocaleString()} chars
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-overlay overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)}
             style={{ width: `${pct}%` }} />
      </div>
      {pct > 90
        ? <p className="text-[10px] text-red-400 mt-1.5">Nearly full. Delete or disable entries to make room.</p>
        : <p className="text-[10px] text-text-muted mt-1.5">Limit includes all documents and FAQ pairs.</p>
      }
    </div>
  );
}
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
      if (event.metadata?.messagesPerHour < threshold) return; // below custom threshold, suppress
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

### Step 3.3: Backend routes

```
GET   /api/workspace/scout-governance    Current rules (defaults returned if no row)
PATCH /api/workspace/scout-governance    Update rules; validate range constraints
```

Validation on PATCH: `volumeSpikeThreshold` 10-1000; `escalationRateThreshold` 0.05-1.00;
`escalationBurstWindow` 1-60; `escalationBurstCount` 1-50.

### Step 3.4: Next.js proxy route

Create `src/app/api/workspace/scout-governance/route.ts`: GET + PATCH.

### Step 3.5: Governance settings page

Create `src/app/(workspace)/settings/governance/page.tsx`. Add "Scout rules" to the settings
sidebar. Page layout: `max-w-2xl mx-auto p-6 space-y-6`.

Wrap the entire page body in `PlanGateSection planRequired="business"` (same component from
Step 1.5).

```typescript
const SIGNAL_TYPES = [
  { id: 'volume_spike',              label: 'Volume spike',            description: 'Too many messages per hour' },
  { id: 'high_escalation_rate',      label: 'High escalation rate',   description: 'Escalation rate exceeds threshold' },
  { id: 'escalation_burst',          label: 'Escalation burst',        description: 'Many escalations in a short window' },
  { id: 'unauthorized_tool_attempt', label: 'Unauthorized tool attempt', description: 'Aiva tried a disallowed tool' },
  { id: 'tool_failure_loop',         label: 'Tool failure loop',       description: 'A tool failed multiple times in succession' },
];
```

```tsx
<PlanGateSection planRequired="business" currentPlan={workspace.plan}>
  <div className="mb-6">
    <h1 className="text-lg font-semibold text-text-primary">Scout governance rules</h1>
    <p className="text-sm text-text-muted mt-1">
      Customize how Scout monitors your Aiva. These settings override the VERLOX defaults.
    </p>
  </div>

  {/* Threshold inputs */}
  <div className="rounded-lg border border-border bg-elevated p-4 space-y-0 divide-y divide-border">
    <h2 className="text-sm font-semibold text-text-primary pb-3">Signal thresholds</h2>

    {/* Volume spike */}
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-text-secondary">Volume spike</p>
        <p className="text-[11px] text-text-muted">Alert when messages per hour exceeds this</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={rules.volumeSpikeThreshold} min={10} max={1000}
               onChange={e => update('volumeSpikeThreshold', clamp(Number(e.target.value), 10, 1000))}
               className="w-20 bg-base rounded-lg border border-border px-3 py-2 text-sm
                          text-text-primary outline-none focus:border-accent text-center" />
        <span className="text-xs text-text-muted w-16">msgs / hr</span>
      </div>
    </div>

    {/* Escalation rate */}
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-text-secondary">Escalation rate</p>
        <p className="text-[11px] text-text-muted">Alert when this % of conversations escalate</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="number" value={Math.round(rules.escalationRateThreshold * 100)} min={5} max={100}
               onChange={e => update('escalationRateThreshold', clamp(Number(e.target.value), 5, 100) / 100)}
               className="w-20 bg-base rounded-lg border border-border px-3 py-2 text-sm
                          text-text-primary outline-none focus:border-accent text-center" />
        <span className="text-xs text-text-muted w-16">%</span>
      </div>
    </div>

    {/* Escalation burst - compound input on one row */}
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm text-text-secondary">Escalation burst</p>
        <p className="text-[11px] text-text-muted">Alert when N escalations happen within M minutes</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input type="number" value={rules.escalationBurstCount} min={1} max={50}
               onChange={e => update('escalationBurstCount', clamp(Number(e.target.value), 1, 50))}
               className="w-16 bg-base rounded-lg border border-border px-2 py-2 text-sm
                          text-text-primary outline-none focus:border-accent text-center" />
        <span className="text-xs text-text-muted">in</span>
        <input type="number" value={rules.escalationBurstWindow} min={1} max={60}
               onChange={e => update('escalationBurstWindow', clamp(Number(e.target.value), 1, 60))}
               className="w-16 bg-base rounded-lg border border-border px-2 py-2 text-sm
                          text-text-primary outline-none focus:border-accent text-center" />
        <span className="text-xs text-text-muted w-10">mins</span>
      </div>
    </div>
  </div>

  {/* Suppress signal types */}
  <div className="rounded-lg border border-border bg-elevated p-4">
    <h2 className="text-sm font-semibold text-text-primary mb-1">Suppress signal types</h2>
    <p className="text-[11px] text-text-muted mb-4">
      Suppressed signals are not emitted or logged. Only suppress signals that do not apply to
      your use case.
    </p>

    {SIGNAL_TYPES.map(signal => {
      const suppressed = rules.ignoreSignalTypes.includes(signal.id);
      return (
        <label key={signal.id}
               className="flex items-start gap-3 py-2.5 border-b border-border last:border-0 cursor-pointer">
          <div
            className={cn(
              'mt-0.5 h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
              suppressed ? 'bg-accent border-accent' : 'border-border',
            )}
            onClick={() => toggleSignal(signal.id)}
          >
            {suppressed && <Check className="h-2.5 w-2.5 text-white" />}
          </div>
          <div className="flex-1">
            <p className="text-sm text-text-secondary">{signal.label}</p>
            <p className="text-[11px] text-text-muted">{signal.description}</p>
          </div>
        </label>
      );
    })}

    {/* Amber warning when any signals are suppressed */}
    {rules.ignoreSignalTypes.length > 0 && (
      <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
        <p className="text-[11px] text-amber-400">
          WARNING: Suppressed signals are not visible in the Scout fleet view or the admin
          dashboard, and are not cached locally. Only suppress signals that do not apply to
          your operations.
        </p>
      </div>
    )}
  </div>

  {/* Save and reset */}
  <div className="flex items-center gap-3">
    <button onClick={handleSave} disabled={saving} className="btn-primary px-6 py-2.5 text-sm">
      {saving ? 'Saving...' : 'Save rules'}
    </button>
    <button onClick={resetToDefaults}
            className="text-sm px-4 py-2.5 border border-border rounded-lg text-text-secondary
                       hover:border-accent/40 hover:text-text-primary transition-colors">
      Reset to defaults
    </button>
    {saved && <p className="text-xs text-green-400">Saved.</p>}
  </div>
</PlanGateSection>
```

---

## Done When

**White-label (Part 1):**
- [x] `workspace_branding` table created with logo_url, accent_color, company_name, custom_domain, domain_verified, hide_attribution columns
- [x] Logo upload section: 64x64 `rounded-lg border border-border bg-elevated` preview box; "Upload logo" label triggers hidden `<input type="file">`; accepts PNG, JPG, SVG only; file stored and served at `/uploads/logos/{workspaceId}.{ext}`
- [x] Brand color row: native `<input type="color">` swatch + hex `<input type="text">` beside it; hex validates `/^#[0-9a-fA-F]{0,6}$/`; live preview updates WidgetPreview at `scale(0.7)`
- [x] Custom domain input + "Verify DNS" button; DNS instructions in a `grid-cols-[64px_1fr]` monospace table; verify result shows green "Verified" or amber "Not found" inline
- [x] Attribution toggle: `role="switch"` button; gated by `PlanGateSection planRequired="business"`; when off the widget footer "Powered by VERLOX" is hidden
- [x] WidgetPreview mockup at `scale(0.7) transformOrigin: 'top left'` updates live as branding state changes
- [x] Save button shows "Saving..." while request in flight; "Saved." fade-in confirmation on success
- [x] Widget config endpoint (`GET /api/widget/:workerId/config`) returns current branding fields
- [x] Widget renders with custom accent color, logo, company name, and without footer when hide_attribution=true
- [x] Custom domain CNAME verification sends notification to VERLOX team on success

**Custom training (Part 2):**
- [x] `aiva_knowledge_base` table created with id, aiva_id, entry_type, title, content, char_count, enabled, created_at columns
- [x] Training tab entry in `AIVA_CORE_TABS` with `order` field placing it after the Channels tab
- [x] DocumentDropzone: `border-2 border-dashed rounded-xl`; border-accent + bg-accent-dim when dragging; hidden when document list non-empty; accepts PDF, DOCX, TXT
- [x] Document rows: FileText icon + truncated title + charCount + "Doc" `rounded-full bg-accent-dim text-accent text-[10px] px-2 py-0.5` badge + ToggleSwitch + Trash2 icon
- [x] ToggleSwitch: `role="switch"` accessible; `bg-accent` when enabled, `bg-border` when disabled
- [x] FAQ inline form visible when "Add FAQ" button clicked: `rounded-xl border border-accent/30 bg-accent-dim/20 p-4`; character counter on answer field turns amber when > 450 chars; Save button disabled when > 500 chars
- [x] FAQ rows: Q label + truncated question text + A label + truncated answer text + ToggleSwitch + Trash2
- [x] KnowledgeUsageBar: `h-1.5 rounded-full bg-border` track; fill `bg-red-500` > 90%, `bg-amber-500` > 70%, `bg-accent` otherwise; percentage label beside bar
- [x] Knowledge base content appended to `buildPersonaPrompt()` after `--- Knowledge Base ---` separator; only enabled entries included
- [x] 50,000 char total limit per Aiva enforced on both upload and FAQ save routes; clear 400 error with char count in message
- [x] Enable/disable toggle PATCH works; delete works with immediate list refresh

**Custom Scout governance (Part 3):**
- [x] `aiva_scout_governance` table created with workspace_id PK + volume_spike_threshold + escalation_rate_threshold + escalation_burst_window + escalation_burst_count + ignore_signal_types TEXT[] + updated_at
- [x] `reportEventWithGovernance()` added to scout-client.ts; all `scout.reportEvent()` calls in aiva-api.ts replaced with it
- [x] Suppressed signal types (ignore_signal_types array): not emitted, not cached, not visible in fleet view
- [x] Volume spike, escalation rate, escalation burst custom thresholds applied correctly: events below custom threshold suppressed
- [x] Governance settings page: "Signal thresholds" card with 3 rows (volume spike, escalation rate, burst); each row has label + description on left; number input(s) + unit label on right
- [x] Burst row uses compound input: `[N input] in [M input] mins` on one line; both inputs `w-16 text-center`
- [x] Suppress section: 5 signal type rows; each row has 16x16 checkbox div (`bg-accent border-accent` when checked, Check icon inside) + label + description
- [x] Amber warning panel (`border border-amber-500/20 bg-amber-500/5 p-3`) appears below checklist when any signals suppressed; hidden when none suppressed
- [x] Save button shows "Saving..." during PATCH; "Saved." text fades in on success
- [x] "Reset to defaults" button fires PATCH with hardcoded defaults; page state resets to match
- [x] Entire governance page body wrapped in `PlanGateSection planRequired="business"`; non-Business plan sees opacity-30 blur + centered lock badge

**General:**
- [x] All three feature sets gated at component level via `PlanGateSection`; non-Business users see blurred locked state, not 404 or blank
- [x] `PlanGateSection` renders without plan gate for Business plan; plan check reads from workspace context, not URL
- [x] No em dashes in any string, label, placeholder, or comment
- [x] No emojis in any string, label, placeholder, button, or comment
