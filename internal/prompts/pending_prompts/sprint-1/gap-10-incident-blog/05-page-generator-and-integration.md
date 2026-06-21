# Gap 10 - Prompt 05: Page Generator and Full Integration

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice.

**Gap:** 10 Incident Blog
**Prompt number:** 05 of 05
**Name:** Page Generator and Integration
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Prompts 01-04

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

Before writing a single line, read:

1. `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/incidents/index.html` -- the full existing page
2. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/store.ts` -- getPublishedIncidents()
3. `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/src/blog/types.ts` -- BlogIncident
4. `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html` -- main site nav (must match)
5. `/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/style.css` -- main site styles

---

## Context

The static incidents page at `labyrinthscout.com/incidents/index.html` is regenerated whenever an incident is published, unpublished, or the operator manually triggers it. The generator reads from the database and writes a complete, self-contained HTML file.

Both interfaces trigger regeneration:
- **Admin UI:** "Regenerate Page" button, or automatically on publish
- **Carina conversation:** `blog-generate-page` tool, or "Regenerate the incidents page"

The page is static HTML for speed, cacheability, and independence from the Carina server.

---

## Step 1: Page Generator

Create `src/blog/page-generator.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import { getPublishedIncidents } from './store.js';
import type { BlogIncident } from './types.js';

const OUTPUT_PATH = '/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/incidents/index.html';
const TEMP_PATH = OUTPUT_PATH + '.tmp';

const CATEGORY_CONFIG: Record<string, {
  eyebrow: string; icon: string; className: string;
  heading: string; intro: string;
}> = {
  financial: {
    eyebrow: 'Financial damage', icon: 'ti-currency-dollar',
    className: 'eyebrow-red',
    heading: 'The bills that arrived without warning.',
    intro: 'AI agents run 24/7. They loop, retry, and chain calls without human awareness. Without budget controls, they are an open meter with no circuit breaker.',
  },
  security: {
    eyebrow: 'Security failures', icon: 'ti-lock-open',
    className: 'eyebrow-red',
    heading: 'Agents with access are agents with attack surface.',
    intro: 'Shell access, file system access, and network egress are necessary for capable agents. Without governance they become the attack surface.',
  },
  brand: {
    eyebrow: 'Brand damage', icon: 'ti-brand-x',
    className: 'eyebrow-amber',
    heading: 'Public-facing AI requires one bad prompt to go viral.',
    intro: 'Every unguarded public AI is one adversarial user away from a 24-hour news cycle.',
  },
  legal: {
    eyebrow: 'Legal and compliance liability', icon: 'ti-gavel',
    className: 'eyebrow-amber',
    heading: 'Courts hold companies responsible for what their AI says.',
    intro: '"The chatbot did it" is not a legal defense. GDPR fines reach 4% of global annual turnover.',
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateIncidentHtml(incident: BlogIncident): string {
  const sourcesHtml = incident.sources
    .map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`)
    .join(', ');
  const sourceLabel = incident.sources.length > 1 ? 'Sources' : 'Source';

  return `
    <div class="ir-incident" id="${escapeHtml(incident.slug)}">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">${escapeHtml(incident.company)}</span>
          <span class="ir-incident-damage">${escapeHtml(incident.damage)}</span>
        </div>
        <span class="ir-incident-date">${escapeHtml(incident.dateOccurred)}</span>
      </div>
      <p class="ir-incident-body">${incident.bodyHtml}</p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">${sourceLabel}: ${sourcesHtml}</span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> ${incident.scoutFixHtml}</span>
      </div>
    </div>`;
}

function generateCategorySection(category: string, incidents: BlogIncident[]): string {
  const config = CATEGORY_CONFIG[category];
  if (!config || incidents.length === 0) return '';

  return `
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow ${config.className}">
      <i class="ti ${config.icon}"></i>
      ${config.eyebrow}
    </div>
    <h2>${config.heading}</h2>
    <p class="ir-category-intro">${config.intro}</p>
    ${incidents.map(generateIncidentHtml).join('\n')}
  </section>
</div>`;
}

export async function generateIncidentPage(): Promise<{ path: string; incidentCount: number }> {
  const incidents = await getPublishedIncidents();

  const byCategory = {
    financial: incidents.filter(i => i.category === 'financial'),
    security: incidents.filter(i => i.category === 'security'),
    brand: incidents.filter(i => i.category === 'brand'),
    legal: incidents.filter(i => i.category === 'legal'),
  };

  const template = await getPageTemplate();

  const html = template
    .replace('<!-- GENERATED_CONTENT -->',
      generateStatsStrip(incidents) +
      generateCategorySection('financial', byCategory.financial) +
      generateCategorySection('security', byCategory.security) +
      generateCategorySection('brand', byCategory.brand) +
      generateCategorySection('legal', byCategory.legal) +
      generateAnswerTable(incidents) +
      generateSubscribeSection() +
      generateCtaSection() +
      generateMethodologySection()
    )
    .replace('{{GENERATED_AT}}', new Date().toISOString())
    .replace('{{INCIDENT_COUNT}}', String(incidents.length));

  // Atomic write: write to temp, then rename
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(TEMP_PATH, html, 'utf8');
  await fs.rename(TEMP_PATH, OUTPUT_PATH);

  return { path: OUTPUT_PATH, incidentCount: incidents.length };
}
```

---

## Step 2: Page Template

The existing `labyrinthscout.com/incidents/index.html` becomes a template. The incident list (lines ~560-945 in the current file) is replaced by `<!-- GENERATED_CONTENT -->`. Everything above and below stays as-is:

- **Header:** HTML head, all CSS (lines 1-505), nav HTML (lines 505-519) -- static
- **Hero section:** Title, subtitle, stat strip, source note (lines 520-560) -- static with dynamic stats
- **GENERATED_CONTENT:** Inserted by the generator
- **Footer:** Footer nav, closing tags (lines 945-974) -- static

The nav must stay IDENTICAL to the main labyrinthscout.com site. The CSS must stay identical. Any drift creates a visual jar.

---

## Step 3: Integration Hooks

Wire generation into the publish flow. Both interfaces trigger it.

**In `src/blog/store.ts` -- `publishIncident()`:**

```typescript
export async function publishIncident(id: string): Promise<BlogIncident> {
  // ... set status='published', published_at=NOW() ...
  try {
    await generateIncidentPage();
  } catch (err) {
    console.error('[carina:blog] Page generation failed during publish:', err);
    // Do not block publish. Operator can regenerate manually.
  }
  return incident;
}
```

**In `src/blog/store.ts` -- `rejectIncident()` (if was published):**

```typescript
export async function rejectIncident(id: string, reason?: string): Promise<BlogIncident> {
  const wasPublished = incident.status === 'published';
  // ... update status to 'rejected' ...
  if (wasPublished) {
    try { await generateIncidentPage(); } catch (err) { /* log */ }
  }
  return incident;
}
```

**Admin UI:** "Regenerate Page" button calls the generator directly.

**Carina tool:** `blog-generate-page` calls the generator directly.

---

## Step 4: Subscribe and CTA Sections

These sections are always present, not database-driven. Generated inline by the generator:

```typescript
function generateSubscribeSection(): string {
  return `
<div class="container">
  <section class="ir-cta" id="subscribe">
    <h2>Get the weekly incident report.</h2>
    <p>New AI agent incidents, documented and sourced, every Sunday. One email. No spam.</p>
    <form id="subscribe-form" style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;max-width:420px;margin:0 auto;">
      <input type="email" name="email" placeholder="your@email.com" required
             style="flex:1;min-width:200px;padding:0.75rem 1rem;border-radius:var(--r-md);border:1px solid var(--border-mid);background:var(--bg-lift);color:var(--text-primary);font-size:0.9rem;">
      <button type="submit" class="btn-primary">Subscribe</button>
    </form>
    <p id="subscribe-message" style="font-size:0.8rem;color:var(--text-mid);margin-top:1rem;"></p>
  </section>
</div>
<script>
// Subscribe form handler + subscribed/unsubscribed URL param handling
// (full script from prompt 04)
</script>`;
}

function generateCtaSection(): string {
  return `
<div class="container">
  <section class="ir-cta">
    <h2>Nobody was watching.<br>Scout is the watching.</h2>
    <p>From £49/mo. Pre-wired for Carina. Connects to any agent stack via API.</p>
    <div class="ir-cta-actions">
      <a href="/#pricing" class="btn-primary"><i class="ti ti-shield-lock"></i> See Scout pricing</a>
      <a href="https://carinaai.uk" class="btn-secondary"><i class="ti ti-sparkles"></i> Start with Carina free</a>
    </div>
  </section>
</div>`;
}

function generateMethodologySection(): string {
  return `
<div class="container">
  <div style="padding:2rem 0;border-top:1px solid var(--border);">
    <p style="font-size:0.73rem;color:var(--text-dim);line-height:1.7;max-width:640px;">
      <strong style="color:var(--text-mid);">Methodology.</strong>
      All incidents verified via published press sources. Research compiled by Carina, reviewed by human operators before publication. AI Incident Database: incidentdatabase.ai. OWASP LLM Top 10: genai.owasp.org. Weekly updates. Page generated: {{GENERATED_AT}}.
    </p>
  </div>
</div>`;
}
```

---

## Step 5: Carina CLI

Already spec'd in prompt 01. The page generator is exposed as:

```bash
carina blog generate-page
```

And as Carina tool `blog-generate-page`.

---

## Pitfalls

1. **Atomic write.** Use `fs.writeFile(TEMP) + fs.rename(TEMP, TARGET)` to prevent corrupted pages if the generator crashes mid-write. `fs.rename` is atomic on Linux.
2. **File permissions.** The output directory may be owned by `www:www` on the VPS. If the generator runs as `malike`, writes may fail. Write to `/tmp/` and provide a `sudo cp` command, or ensure the user has write access.
3. **Template drift.** The page template is a copy of the original hand-written HTML. If the main site nav or footer changes, the template must be manually updated. Consider extracting shared header/footer into include files.
4. **Performance at scale.** If the incident count reaches hundreds, the page will be large. Consider category-level pagination as a future enhancement.
5. **Concurrent generation.** If both interfaces trigger generation simultaneously, the atomic write pattern ensures the last write wins and both writes produce identical output.

---

## Verification

```bash
# Publish a test incident via admin UI
# Verify page was regenerated
grep "test-incident" labyrinthscout.com/incidents/index.html

# Publish via Carina conversation
carina blog publish test-incident-2

# Verify both incidents appear

# Manual regenerate
carina blog generate-page

# Verify atomic write
ls -la labyrinthscout.com/incidents/index.html
# No .tmp file should remain

# Verify page is valid HTML
# Open in browser, check:
# - Nav matches main site
# - Incidents rendered with correct styling
# - Subscribe form present and functional
# - CTA section present
# - Methodology note shows generation timestamp
```
