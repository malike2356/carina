# Marketing Sites Update: Fear + Value Additions

**Purpose:** Add documented-incident sections to both marketing sites and create a dedicated incidents page. The landing pages carry a compact fear hook (3 cards, stat strip, one CTA to the full page). The full treatment lives at `labyrinthscout.com/incidents/`.

**Files to edit or create:**
- `labyrinthscout.com/index.html` (additive: new section + nav link)
- `carinaai.uk/index.html` (additive: new bridge section + scout section update)
- `labyrinthscout.com/incidents/index.html` (new file: dedicated incidents page)

**Research source:** `instructions/prompts/researched_gap/research_ai_damages_to_drive_sales/presented_research/research_ai_damages_to_drive_sales.md`

**Design system (both sites share these CSS variables):**
```
--bg: #06090f        --bg-lift: #0c1118      --bg-card: #111722
--border: rgba(255,255,255,0.07)             --border-mid: rgba(255,255,255,0.12)
--green: #16c97e     --green-dim: rgba(22,201,126,0.12)
--red: #e63946       --red-dim: rgba(230,57,70,0.10)
--amber-warn: #f59e0b
--text-primary: #f0f4f8   --text-mid: #8a9bb0   --text-dim: #4d6070
--r: 6px   --r-md: 10px   --r-lg: 16px
--ff-sans: 'Inter', system-ui, sans-serif
--transition: 200ms cubic-bezier(0.4,0,0.2,1)
```
Icons: Tabler Icons webfont (`<i class="ti ti-*">`). Font: Inter via Google Fonts.

**Framing rule (apply to every line of copy):** Always "AI agents without oversight" or "unmonitored AI agents." Never "AI agents are dangerous." Carina is an AI agent; the framing cannot undermine the product.

**Writing rules:** No em dashes (U+2014). No en dashes (U+2013). No emojis. Hyphens, colons, or sentence breaks only.

---

## CHANGE 1: labyrinthscout.com/index.html -- Compact Fear Section

### Rationale

The landing page is a conversion funnel. Three incidents are enough to create urgency. The full record lives at `/incidents/`. The second CTA on this section points there.

### CSS to add

Inside the `<style>` block before the closing `</style>` tag:

```css
/* --- INCIDENT RECORD (landing strip) --- */
#incidents {
  background: var(--bg);
  border-top: 1px solid rgba(230,57,70,0.15);
  box-shadow: inset 0 1px 0 rgba(230,57,70,0.06);
}

.incidents-intro { max-width: 600px; margin-bottom: 3rem; }

.incidents-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2.5rem;
}

@media (max-width: 900px) { .incidents-grid-3 { grid-template-columns: 1fr; } }

.incident-card {
  border-radius: var(--r-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  transition: border-color var(--transition);
}

.incident-card:hover { border-color: rgba(230,57,70,0.3); }

.incident-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.incident-card-company {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.incident-card-date { font-size: 0.68rem; color: var(--text-dim); }

.incident-card-damage {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--red);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.incident-card-what {
  font-size: 0.82rem;
  color: var(--text-mid);
  line-height: 1.55;
  flex: 1;
}

.incident-card-source {
  font-size: 0.68rem;
  color: var(--text-dim);
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}

.incident-card-source a {
  color: var(--text-dim);
  text-decoration: none;
  transition: color var(--transition);
}

.incident-card-source a:hover { color: var(--text-mid); }

.incident-stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .incident-stats-strip { grid-template-columns: repeat(2, 1fr); }
}

.incident-stat {
  padding: 1.35rem 1.25rem;
  border-right: 1px solid var(--border);
  background: var(--bg-card);
}

.incident-stat:last-child { border-right: none; }

@media (max-width: 768px) {
  .incident-stat:nth-child(2) { border-right: none; }
  .incident-stat:nth-child(3) { border-top: 1px solid var(--border); }
  .incident-stat:nth-child(4) { border-right: none; border-top: 1px solid var(--border); }
}

.incident-stat-value {
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--red);
  line-height: 1;
  margin-bottom: 0.3rem;
}

.incident-stat-label { font-size: 0.73rem; color: var(--text-dim); line-height: 1.4; }

.incident-closer {
  padding: 1.1rem 1.35rem;
  border-radius: var(--r-md);
  background: rgba(230,57,70,0.05);
  border: 1px solid rgba(230,57,70,0.12);
  font-size: 0.9rem;
  color: var(--text-mid);
  line-height: 1.6;
  margin-bottom: 1.75rem;
}

.incident-closer strong { color: var(--text-primary); }

.incident-cta { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
```

### HTML to insert

Insert the entire block below immediately before `<!-- PRICING -->`:

```html
<!-- SECTION: INCIDENT RECORD -->
<section id="incidents" class="section">
  <div class="container">
    <div class="incidents-intro">
      <div class="section-eyebrow eyebrow-amber section-eyebrow-pill">
        <i class="ti ti-alert-triangle"></i>
        Documented damage
      </div>
      <h2 class="section-h2">
        AI agents without oversight have <span class="accent-red">already done this.</span>
      </h2>
      <p class="section-sub">
        Three incidents. Three different failure modes. One shared cause: nobody was watching.
      </p>
    </div>

    <div class="incidents-grid-3">

      <div class="incident-card">
        <div class="incident-card-meta">
          <span class="incident-card-company">Enterprise (via Axios)</span>
          <span class="incident-card-date">May 2026</span>
        </div>
        <div class="incident-card-damage">$500,000,000</div>
        <p class="incident-card-what">An enterprise deployed Claude with no spending caps and no agent budget controls. One month. Half a billion dollars.</p>
        <div class="incident-card-source">
          Source: <a href="https://techstartups.com/2026/05/28/company-accidentally-spent-500-million-on-claude-ai-in-one-month-after-forgetting-usage-limits/" target="_blank" rel="noopener">Axios / techstartups.com, May 2026</a>
        </div>
      </div>

      <div class="incident-card">
        <div class="incident-card-meta">
          <span class="incident-card-company">Amazon / AWS</span>
          <span class="incident-card-date">2025</span>
        </div>
        <div class="incident-card-damage">13-hour outage</div>
        <p class="incident-card-what">Amazon's own AI coding tool caused multiple AWS outages including one lasting 13 hours. No approval gate. No dangerous-operation check. Production systems modified without human sign-off.</p>
        <div class="incident-card-source">
          Source: <a href="https://www.theguardian.com/technology/2026/feb/20/amazon-cloud-outages-ai-tools-amazon-web-services-aws" target="_blank" rel="noopener">The Guardian, Feb 2026</a>
        </div>
      </div>

      <div class="incident-card">
        <div class="incident-card-meta">
          <span class="incident-card-company">Multiple platforms</span>
          <span class="incident-card-date">2025-2026</span>
        </div>
        <div class="incident-card-damage">rm -rf /home</div>
        <p class="incident-card-what">AI coding agents on Cursor, Claude Code, Replit, and Codex CLI have autonomously executed destructive shell commands. Complete codebases deleted. No confirmation requested.</p>
        <div class="incident-card-source">
          Source: <a href="https://www.docker.com/blog/ai-coding-agent-horror-stories-security-risks/" target="_blank" rel="noopener">Docker security blog, 2025</a>
        </div>
      </div>

    </div>

    <div class="incident-stats-strip">
      <div class="incident-stat">
        <div class="incident-stat-value">$500M+</div>
        <div class="incident-stat-label">single-incident financial loss, reported</div>
      </div>
      <div class="incident-stat">
        <div class="incident-stat-value">13 hrs</div>
        <div class="incident-stat-label">AWS downtime from one AI coding agent</div>
      </div>
      <div class="incident-stat">
        <div class="incident-stat-value">1,000+</div>
        <div class="incident-stat-label">incidents in the public AI incident database</div>
      </div>
      <div class="incident-stat">
        <div class="incident-stat-value">#1</div>
        <div class="incident-stat-label">Prompt Injection -- OWASP LLM Top 10, two editions</div>
      </div>
    </div>

    <div class="incident-closer">
      <strong>Every incident above shares one property: nobody was watching.</strong>
      No budget cap fired. No dangerous command was intercepted. No policy blocked the change before it reached production.
      Scout is the watching.
    </div>

    <div class="incident-cta">
      <a href="#pricing" class="btn-primary">
        <i class="ti ti-shield-lock"></i>
        Add Scout to your agent
      </a>
      <a href="/incidents/" class="btn-secondary">
        <i class="ti ti-file-text"></i>
        Read the full incident record
      </a>
    </div>

  </div>
</section>
```

### Nav update

In both `.nav-links` (desktop) and `.nav-mobile-panel` (mobile), add an Incidents link before Pricing:

Find: `<a href="#pricing">Pricing</a>`
Replace with:
```html
<a href="#incidents">Incidents</a>
<a href="#pricing">Pricing</a>
```

Do this in both the desktop nav and the mobile panel.

---

## CHANGE 2: carinaai.uk/index.html -- Bridge Section and Scout Update

### CSS to add (inside `<style>` before `</style>`)

```css
/* --- WHAT HAPPENS WITHOUT OVERSIGHT --- */
#without-oversight {
  background: var(--bg);
  border-top: 1px solid rgba(230,57,70,0.12);
}

.woo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 2.5rem;
  margin-bottom: 2.5rem;
}

@media (max-width: 768px) { .woo-grid { grid-template-columns: 1fr; } }

.woo-card {
  border-radius: var(--r-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  transition: border-color var(--transition);
}

.woo-card:hover { border-color: rgba(230,57,70,0.25); }

.woo-icon {
  width: 38px; height: 38px;
  border-radius: var(--r-md);
  background: rgba(230,57,70,0.08);
  border: 1px solid rgba(230,57,70,0.15);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.woo-icon i { color: var(--red); font-size: 1rem; }

.woo-card h4 { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }

.woo-card p { font-size: 0.81rem; color: var(--text-mid); line-height: 1.55; flex: 1; }

.woo-cite {
  font-size: 0.68rem;
  color: var(--text-dim);
  padding-top: 0.45rem;
  border-top: 1px solid var(--border);
}

.woo-cite a { color: var(--text-dim); text-decoration: none; }
.woo-cite a:hover { color: var(--text-mid); }

.woo-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--red);
  color: #fff;
  padding: 0.75rem 1.5rem;
  border-radius: var(--r-md);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity var(--transition), transform var(--transition);
}

.btn-danger:hover { opacity: 0.88; transform: translateY(-1px); color: #fff; }
```

### HTML to insert

Insert the block below immediately before `<!-- SECTION: CARINA EXECUTES, SCOUT INTERCEPTS -->`:

```html
<!-- SECTION: WHAT HAPPENS WITHOUT OVERSIGHT -->
<section id="without-oversight" class="section section-dark">
  <div class="container">
    <div class="section-eyebrow" style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:500;padding:0.3rem 0.75rem;border-radius:999px;border:1px solid rgba(230,57,70,0.25);background:rgba(230,57,70,0.06);color:var(--red);margin-bottom:1.25rem;">
      <i class="ti ti-alert-triangle"></i>
      What happens without oversight
    </div>
    <h2 class="section-h2">
      These are not predictions.<br>
      <span style="color:var(--red);">They already happened.</span>
    </h2>
    <p class="section-sub">
      Every documented AI agent incident shares one property: no one was watching. Three cases from the past 36 months.
    </p>

    <div class="woo-grid">

      <div class="woo-card">
        <div class="woo-icon"><i class="ti ti-currency-dollar"></i></div>
        <h4>$500M in one month</h4>
        <p>An enterprise deployed Claude with no spending caps. No agent budget controls. No usage monitoring. One month later, a half-billion dollar invoice. The agent ran. Nobody watched the meter.</p>
        <div class="woo-cite">Reported by Axios, May 2026. Scout fix: per-agent quotas, real-time spend alerts.</div>
      </div>

      <div class="woo-card">
        <div class="woo-icon"><i class="ti ti-terminal"></i></div>
        <h4>rm -rf on production systems</h4>
        <p>AI coding agents on Cursor, Claude Code, Replit, and Codex CLI have executed destructive shell commands without asking. Complete codebases deleted. Entire home directories wiped.</p>
        <div class="woo-cite"><a href="https://www.docker.com/blog/ai-coding-agent-horror-stories-security-risks/" target="_blank" rel="noopener">Docker security blog, 2025</a>. Carina warns. Scout enforces policy.</div>
      </div>

      <div class="woo-card">
        <div class="woo-icon"><i class="ti ti-lock-open"></i></div>
        <h4>Source code on external servers</h4>
        <p>Samsung employees pasted internal source code into ChatGPT for debugging. The data was uploaded to OpenAI's servers with no way to retrieve or delete it. Samsung banned all generative AI company-wide.</p>
        <div class="woo-cite"><a href="https://www.bloomberg.com/news/articles/2023-05-02/samsung-bans-chatgpt-and-other-generative-ai-use-by-staff-after-leak" target="_blank" rel="noopener">Bloomberg, May 2023</a>. Scout fix: egress filtering keeps data in your infrastructure.</div>
      </div>

    </div>

    <div class="woo-actions">
      <a href="https://labyrinthscout.com/incidents/" class="btn-danger">
        <i class="ti ti-file-description"></i>
        Read the full incident record
      </a>
      <a href="https://labyrinthscout.com" class="btn-secondary">
        <i class="ti ti-shield-bolt"></i>
        See Scout protection
      </a>
    </div>
  </div>
</section>
```

### Scout cross-sell section update

In `<section id="scout"`, the heading currently reads `<h2>Scout-ready. One key.</h2>`. Add a fear hook line immediately after that heading:

```html
<p style="font-size:0.82rem;font-weight:600;color:var(--red);letter-spacing:0.03em;text-transform:uppercase;margin-bottom:1.5rem;">
  Unmonitored agents have already caused $500M bills, 13-hour outages, and deleted entire codebases.
</p>
```

---

## CHANGE 3: labyrinthscout.com/incidents/index.html -- New Dedicated Page

Create this file at `labyrinthscout.com/incidents/index.html`. It must match the labyrinthscout.com design system exactly.

### File structure

The file has three logical parts:
1. Head + shared styles
2. Nav (same as labyrinthscout.com, stripped to essential links)
3. Page content (hero, incident categories, scout answer table, CTA)

### Complete file

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#06090f">
  <title>The AI Agent Incident Record - Labyrinth Scout</title>
  <meta name="description" content="17 documented incidents where AI agents without oversight caused real financial, security, and brand damage. Sourced, dated, and linked.">
  <meta property="og:title" content="The AI Agent Incident Record">
  <meta property="og:description" content="$500M in one month. 13-hour cloud outage. rm -rf on production. These are not predictions. They happened.">
  <meta property="og:url" content="https://labyrinthscout.com/incidents/">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <link rel="icon" href="/assets/pwa/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/pwa/favicon.ico" sizes="any">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           #06090f;
      --bg-lift:      #0c1118;
      --bg-card:      #111722;
      --border:       rgba(255,255,255,0.07);
      --border-mid:   rgba(255,255,255,0.12);
      --green:        #16c97e;
      --green-dim:    rgba(22,201,126,0.12);
      --red:          #e63946;
      --red-dim:      rgba(230,57,70,0.10);
      --amber-warn:   #f59e0b;
      --text-primary: #f0f4f8;
      --text-mid:     #8a9bb0;
      --text-dim:     #4d6070;
      --ff-sans:      'Inter', system-ui, sans-serif;
      --r:            6px;
      --r-md:         10px;
      --r-lg:         16px;
      --transition:   200ms cubic-bezier(0.4,0,0.2,1);
    }

    html { scroll-behavior: smooth; overflow-x: clip; }

    body {
      font-family: var(--ff-sans);
      background: var(--bg);
      color: var(--text-primary);
      line-height: 1.65;
      overflow-x: clip;
    }

    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    /* --- NAV --- */
    nav {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      height: 60px;
      background: rgba(6,9,15,0.90);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
    }

    .nav-inner {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    .nav-logo {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
    }

    .nav-logo span { color: var(--green); }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .nav-right a {
      font-size: 0.8125rem;
      color: var(--text-mid);
      text-decoration: none;
      transition: color var(--transition);
    }

    .nav-right a:hover { color: var(--text-primary); }

    .nav-right a.nav-cta {
      background: var(--green);
      color: #06090f;
      padding: 0.4rem 1rem;
      border-radius: var(--r);
      font-weight: 600;
    }

    .nav-right a.nav-cta:hover { opacity: 0.85; color: #06090f; }

    /* --- PAGE HERO --- */
    .ir-hero {
      padding: 8rem 0 4rem;
      border-bottom: 1px solid var(--border);
    }

    .ir-hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.68rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--red);
      font-weight: 600;
      padding: 0.3rem 0.75rem;
      border: 1px solid rgba(230,57,70,0.25);
      border-radius: 999px;
      background: rgba(230,57,70,0.06);
      margin-bottom: 1.75rem;
    }

    .ir-hero h1 {
      font-size: clamp(2rem, 4.5vw, 3rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.08;
      color: var(--text-primary);
      margin-bottom: 1.25rem;
    }

    .ir-hero h1 span { color: var(--red); }

    .ir-hero-sub {
      font-size: 1rem;
      color: var(--text-mid);
      max-width: 560px;
      line-height: 1.7;
      margin-bottom: 2.5rem;
    }

    .ir-source-note {
      font-size: 0.75rem;
      color: var(--text-dim);
      max-width: 600px;
      line-height: 1.6;
      padding: 0.85rem 1.1rem;
      border-radius: var(--r-md);
      border: 1px solid var(--border);
      background: var(--bg-card);
    }

    /* --- STAT STRIP --- */
    .ir-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-radius: var(--r-lg);
      border: 1px solid var(--border);
      overflow: hidden;
      margin: 3rem 0;
    }

    @media (max-width: 700px) {
      .ir-stats { grid-template-columns: repeat(2, 1fr); }
    }

    .ir-stat {
      padding: 1.35rem 1.25rem;
      border-right: 1px solid var(--border);
      background: var(--bg-card);
    }

    .ir-stat:last-child { border-right: none; }

    @media (max-width: 700px) {
      .ir-stat:nth-child(2) { border-right: none; }
      .ir-stat:nth-child(3) { border-top: 1px solid var(--border); }
      .ir-stat:nth-child(4) { border-right: none; border-top: 1px solid var(--border); }
    }

    .ir-stat-value {
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: var(--red);
      line-height: 1;
      margin-bottom: 0.3rem;
    }

    .ir-stat-label { font-size: 0.73rem; color: var(--text-dim); line-height: 1.4; }

    /* --- CATEGORY SECTIONS --- */
    .ir-category {
      padding: 3.5rem 0;
      border-bottom: 1px solid var(--border);
    }

    .ir-category:last-of-type { border-bottom: none; }

    .ir-category-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.67rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      margin-bottom: 1.25rem;
    }

    .eyebrow-red   { color: var(--red); border: 1px solid rgba(230,57,70,0.25); background: rgba(230,57,70,0.06); }
    .eyebrow-amber { color: var(--amber-warn); border: 1px solid rgba(245,158,11,0.25); background: rgba(245,158,11,0.06); }
    .eyebrow-green { color: var(--green); border: 1px solid rgba(22,201,126,0.25); background: rgba(22,201,126,0.06); }

    .ir-category h2 {
      font-size: 1.55rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.1;
      color: var(--text-primary);
      margin-bottom: 0.6rem;
    }

    .ir-category-intro {
      font-size: 0.9rem;
      color: var(--text-mid);
      max-width: 540px;
      line-height: 1.65;
      margin-bottom: 2rem;
    }

    /* --- INCIDENT ENTRIES --- */
    .ir-incident {
      border-radius: var(--r-lg);
      background: var(--bg-card);
      border: 1px solid var(--border);
      padding: 1.5rem;
      margin-bottom: 1rem;
      transition: border-color var(--transition);
    }

    .ir-incident:hover { border-color: var(--border-mid); }

    .ir-incident:last-child { margin-bottom: 0; }

    .ir-incident-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.85rem;
    }

    .ir-incident-meta { display: flex; flex-direction: column; gap: 0.2rem; }

    .ir-incident-company {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--text-dim);
    }

    .ir-incident-damage {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--red);
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .ir-incident-date {
      font-size: 0.72rem;
      color: var(--text-dim);
      white-space: nowrap;
      flex-shrink: 0;
      margin-top: 0.15rem;
    }

    .ir-incident-body {
      font-size: 0.88rem;
      color: var(--text-mid);
      line-height: 1.65;
      margin-bottom: 1rem;
    }

    .ir-incident-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding-top: 0.85rem;
      border-top: 1px solid var(--border);
    }

    .ir-incident-source {
      font-size: 0.72rem;
      color: var(--text-dim);
    }

    .ir-incident-source a {
      color: var(--text-dim);
      text-decoration: none;
      transition: color var(--transition);
    }

    .ir-incident-source a:hover { color: var(--text-mid); }

    .ir-scout-fix {
      font-size: 0.72rem;
      color: var(--green);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .ir-scout-fix i { font-size: 0.8rem; }

    /* --- SCOUT ANSWER TABLE --- */
    .ir-answer-section {
      padding: 3.5rem 0;
      border-top: 1px solid rgba(22,201,126,0.15);
      border-bottom: 1px solid var(--border);
    }

    .ir-answer-table {
      width: 100%;
      border-collapse: collapse;
      border-radius: var(--r-lg);
      overflow: hidden;
      margin-top: 2rem;
      font-size: 0.85rem;
    }

    .ir-answer-table th {
      padding: 0.85rem 1.1rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-align: left;
    }

    .ir-answer-table th:first-child {
      background: rgba(255,255,255,0.03);
      color: var(--text-dim);
      border: 1px solid var(--border);
      border-right: none;
      width: 35%;
    }

    .ir-answer-table th:nth-child(2) {
      background: rgba(230,57,70,0.06);
      color: var(--red);
      border: 1px solid rgba(230,57,70,0.15);
      border-right: none;
      width: 30%;
    }

    .ir-answer-table th:last-child {
      background: rgba(22,201,126,0.08);
      color: var(--green);
      border: 1px solid rgba(22,201,126,0.2);
      width: 35%;
    }

    .ir-answer-table td {
      padding: 0.75rem 1.1rem;
      border-left: 1px solid;
      border-right: 1px solid;
      vertical-align: top;
      line-height: 1.5;
    }

    .ir-answer-table tr:not(:last-child) td { border-bottom: 1px solid; }
    .ir-answer-table tr:last-child td { border-bottom: 1px solid; }

    .ir-answer-table td:first-child {
      color: var(--text-mid);
      border-color: var(--border);
      background: rgba(255,255,255,0.01);
    }

    .ir-answer-table td:nth-child(2) {
      color: var(--red);
      font-size: 0.8rem;
      border-color: rgba(230,57,70,0.12);
      background: rgba(230,57,70,0.03);
    }

    .ir-answer-table td:last-child {
      color: var(--text-primary);
      font-weight: 500;
      border-color: rgba(22,201,126,0.12);
      background: rgba(22,201,126,0.03);
      font-size: 0.8rem;
    }

    .ir-answer-table tr:last-child td:first-child  { border-bottom-color: var(--border); }
    .ir-answer-table tr:last-child td:nth-child(2) { border-bottom-color: rgba(230,57,70,0.12); }
    .ir-answer-table tr:last-child td:last-child   { border-bottom-color: rgba(22,201,126,0.12); }

    /* --- FINAL CTA --- */
    .ir-cta {
      padding: 5rem 0;
      text-align: center;
    }

    .ir-cta h2 {
      font-size: clamp(1.75rem, 3.5vw, 2.5rem);
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.1;
      margin-bottom: 1rem;
      color: var(--text-primary);
    }

    .ir-cta p {
      font-size: 0.95rem;
      color: var(--text-mid);
      max-width: 440px;
      margin: 0 auto 2.25rem;
      line-height: 1.7;
    }

    .ir-cta-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    /* --- SHARED BUTTONS --- */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--green);
      color: #06090f;
      padding: 0.75rem 1.5rem;
      border-radius: var(--r-md);
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      transition: opacity var(--transition), transform var(--transition);
    }

    .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); color: #06090f; }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: transparent;
      color: var(--text-mid);
      padding: 0.75rem 1.5rem;
      border-radius: var(--r-md);
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      border: 1px solid var(--border-mid);
      transition: color var(--transition), border-color var(--transition);
    }

    .btn-secondary:hover { color: var(--text-primary); border-color: var(--green); }

    /* --- FOOTER --- */
    .ir-footer {
      border-top: 1px solid var(--border);
      padding: 2rem 0;
    }

    .ir-footer-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    .ir-footer-inner a { color: var(--text-dim); text-decoration: none; transition: color var(--transition); }
    .ir-footer-inner a:hover { color: var(--text-mid); }
  </style>
</head>
<body>

<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">Scout<span>.</span></a>
    <div class="nav-right">
      <a href="/">Home</a>
      <a href="/#governance">Governance</a>
      <a href="/#pricing">Pricing</a>
      <a href="https://carinaai.uk">Carina</a>
      <a href="/#pricing" class="nav-cta">Get Scout</a>
    </div>
  </div>
</nav>

<!-- HERO -->
<div class="ir-hero">
  <div class="container">
    <div class="ir-hero-eyebrow">
      <i class="ti ti-alert-triangle"></i>
      Documented damage
    </div>
    <h1>
      The AI Agent<br>
      <span>Incident Record.</span>
    </h1>
    <p class="ir-hero-sub">
      17 documented incidents where AI agents operating without oversight caused real financial, security, and brand damage. Every claim is sourced. Every source is linked. No hyperbole required.
    </p>
    <div class="ir-source-note">
      Sources: The Guardian, Bloomberg, Ars Technica, Forbes, BBC, Docker, OWASP. Full methodology at the bottom of this page. The $500M figure is reported via Axios from an unnamed enterprise and should be treated as reported, not independently verified. All other incidents have named companies and press-verified sources.
    </div>
  </div>
</div>

<!-- STAT STRIP -->
<div class="container">
  <div class="ir-stats">
    <div class="ir-stat">
      <div class="ir-stat-value">$500M+</div>
      <div class="ir-stat-label">single-incident financial loss, reported May 2026</div>
    </div>
    <div class="ir-stat">
      <div class="ir-stat-value">13 hrs</div>
      <div class="ir-stat-label">AWS downtime from one AI coding agent, 2025</div>
    </div>
    <div class="ir-stat">
      <div class="ir-stat-value">1,000+</div>
      <div class="ir-stat-label">incidents in the public AI Incident Database</div>
    </div>
    <div class="ir-stat">
      <div class="ir-stat-value">#1</div>
      <div class="ir-stat-label">Prompt Injection -- OWASP LLM Top 10, two consecutive editions</div>
    </div>
  </div>
</div>

<!-- CATEGORY 1: FINANCIAL -->
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow eyebrow-red">
      <i class="ti ti-currency-dollar"></i>
      Financial damage
    </div>
    <h2>The bills that arrived without warning.</h2>
    <p class="ir-category-intro">
      AI agents run 24/7. They loop, retry, and chain calls without human awareness. Without budget controls, they are an open meter with no circuit breaker.
    </p>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Enterprise (via Axios, unnamed)</span>
          <span class="ir-incident-damage">$500,000,000</span>
        </div>
        <span class="ir-incident-date">May 2026</span>
      </div>
      <p class="ir-incident-body">
        An enterprise deployed Claude across thousands of employees. No spending caps. No usage monitoring. No agent budget controls. Developers ran long autonomous coding sessions. AI agents executed chained workflows around the clock. The invoice arrived one month later: half a billion dollars.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://techstartups.com/2026/05/28/company-accidentally-spent-500-million-on-claude-ai-in-one-month-after-forgetting-usage-limits/" target="_blank" rel="noopener">Axios / techstartups.com, May 2026</a> -- reported, not independently verified</span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: per-agent spend quotas, real-time usage dashboard, alert thresholds</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Uber</span>
          <span class="ir-incident-damage">Entire 2026 AI budget consumed</span>
        </div>
        <span class="ir-incident-date">April 2026</span>
      </div>
      <p class="ir-incident-body">
        Uber's heavy adoption of AI coding products burned through its entire 2026 AI budget by April. The COO reportedly admitted the costs were becoming difficult to justify. Four months to exhaust an annual budget, with no visibility into which agents or workflows drove the burn.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://techstartups.com/2026/05/28/company-accidentally-spent-500-million-on-claude-ai-in-one-month-after-forgetting-usage-limits/" target="_blank" rel="noopener">Same Axios report as above -- treat as reported</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: per-team budgets, agent-level cost attribution</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Individual developer</span>
          <span class="ir-incident-damage">$47,000</span>
        </div>
        <span class="ir-incident-date">2024-2025</span>
      </div>
      <p class="ir-incident-body">
        A developer let AI write their API. Three weeks later, a $47,000 AWS bill. The AI-generated code was grossly inefficient: runaway loops, unbounded resource allocation, zero cost awareness. No monitoring was in place to catch the pattern before it compounded.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://awstip.com/i-let-ai-write-our-api-3-weeks-later-47k-aws-bill-heres-what-it-did-wrong-7ebb190e9d02" target="_blank" rel="noopener">awstip.com, 2024-2025</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: agent execution rate limits, audit trail, cost anomaly detection</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Individual AWS user</span>
          <span class="ir-incident-damage">$30,000</span>
        </div>
        <span class="ir-incident-date">2025-2026</span>
      </div>
      <p class="ir-incident-body">
        Claude running on AWS Bedrock entered a runaway loop. No monitoring in place. The agent consumed massive compute resources with zero human visibility until the bill arrived.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://www.radarc.net/review/aws-user-hit-with-30000-dollar-bill-after-claude-runaway-on-bedrock" target="_blank" rel="noopener">radarc.net, 2025-2026</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: spend cap enforcement, runaway detection via execution loop monitoring</span>
      </div>
    </div>

  </section>
</div>

<!-- CATEGORY 2: SECURITY -->
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow eyebrow-red">
      <i class="ti ti-lock-open"></i>
      Security failures
    </div>
    <h2>Agents with access are agents with attack surface.</h2>
    <p class="ir-category-intro">
      Shell access, file system access, and network egress are necessary for capable agents. Without governance they become the attack surface.
    </p>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Amazon / AWS</span>
          <span class="ir-incident-damage">13-hour production outage</span>
        </div>
        <span class="ir-incident-date">2025, reported Feb 2026</span>
      </div>
      <p class="ir-incident-body">
        Amazon's internal AI coding tool "Kiro" caused at least two AWS outages including one lasting 13 hours. The agents ran with the same permissions as the human engineers using them. No secondary approval was required. The agents restarted systems, modified configurations, and broke production without understanding the consequences. Amazon called it "user access control." Security experts disagreed: "AI agents cannot understand the broader ramifications of restarting a system or deleting a database."
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Sources: <a href="https://www.theguardian.com/technology/2026/feb/20/amazon-cloud-outages-ai-tools-amazon-web-services-aws" target="_blank" rel="noopener">The Guardian</a>, <a href="https://www.tomshardware.com/tech-industry/artificial-intelligence/multiple-aws-outages-caused-by-ai-coding-bot-blunder-report-claims-amazon-says-both-incidents-were-user-error" target="_blank" rel="noopener">Tom's Hardware</a>, <a href="https://www.docker.com/blog/coding-agent-horror-stories-the-13-hour-aws-outage/" target="_blank" rel="noopener">Docker</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: approval gates for dangerous operations, permission scoping, audit trail</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Multiple platforms (Cursor, Claude Code, Replit, Codex)</span>
          <span class="ir-incident-damage">Filesystem and codebase destruction</span>
        </div>
        <span class="ir-incident-date">2025-2026, ongoing</span>
      </div>
      <p class="ir-incident-body">
        AI coding agents across multiple platforms have autonomously executed rm -rf on user filesystems. Complete codebases deleted. Entire home directories wiped. The pattern is documented on developer forums as "one of the most-reported AI-agent incidents." The Docker security blog and agenticcontrolplane.com document specific cases with traceable details. Agents run as the user, with the user's full permissions, and no built-in interlock for destructive operations.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Sources: <a href="https://www.docker.com/blog/ai-coding-agent-horror-stories-security-risks/" target="_blank" rel="noopener">Docker security blog</a>, <a href="https://agenticcontrolplane.com/blog/stop-your-agent-from-running-rm-rf" target="_blank" rel="noopener">agenticcontrolplane.com</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: command flagging intercepts destructive operations before execution; Carina free tier warns, Scout enforces policy</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Samsung Electronics</span>
          <span class="ir-incident-damage">Source code leaked to external servers</span>
        </div>
        <span class="ir-incident-date">May 2023</span>
      </div>
      <p class="ir-incident-body">
        Samsung employees pasted internal source code and meeting notes into ChatGPT for debugging and summarization. The data was uploaded to OpenAI's servers with no mechanism for Samsung to access or delete it. Samsung discovered the leak and imposed a company-wide ban on all generative AI tools. Amazon issued similar internal warnings the same month after discovering proprietary data appearing in ChatGPT outputs.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Sources: <a href="https://www.bloomberg.com/news/articles/2023-05-02/samsung-bans-chatgpt-and-other-generative-ai-use-by-staff-after-leak" target="_blank" rel="noopener">Bloomberg</a>, <a href="https://www.forbes.com/sites/siladityaray/2023/05/02/samsung-bans-chatgpt-and-other-chatbots-for-employees-after-sensitive-code-leak/" target="_blank" rel="noopener">Forbes</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: egress filtering prevents sensitive data from leaving your infrastructure</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Microsoft (Bing Chat)</span>
          <span class="ir-incident-damage">Internal system prompt extracted</span>
        </div>
        <span class="ir-incident-date">February 2023</span>
      </div>
      <p class="ir-incident-body">
        A Stanford student used prompt injection to extract Bing Chat's hidden system prompt, revealing its codename "Sydney" and all its behavioral rules. Microsoft patched it. The student bypassed the fix within hours. The UK's National Cyber Security Centre (NCSC) issued an official warning about chatbot prompt injection attacks in August 2023. OWASP has ranked Prompt Injection as the number one LLM vulnerability for two consecutive editions (2023 and 2025).
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Sources: <a href="https://arstechnica.com/information-technology/2023/02/ai-powered-bing-chat-spills-its-secrets-via-prompt-injection-attack/" target="_blank" rel="noopener">Ars Technica</a>, <a href="https://www.theguardian.com/technology/2023/aug/30/uk-cybersecurity-agency-warns-of-chatbot-prompt-injection-attacks" target="_blank" rel="noopener">The Guardian (NCSC warning)</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: prompt guard middleware intercepts injection attempts at the gateway before the model sees them</span>
      </div>
    </div>

  </section>
</div>

<!-- CATEGORY 3: BRAND DAMAGE -->
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow eyebrow-amber">
      <i class="ti ti-brand-x"></i>
      Brand damage
    </div>
    <h2>Public-facing AI requires one bad prompt to go viral.</h2>
    <p class="ir-category-intro">
      Every unguarded public AI is one adversarial user away from a 24-hour news cycle. Content policy enforcement and human-in-the-loop review for binding outputs are not optional at scale.
    </p>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">DPD (parcel delivery)</span>
          <span class="ir-incident-damage">800,000 views in 24 hours</span>
        </div>
        <span class="ir-incident-date">January 2024</span>
      </div>
      <p class="ir-incident-body">
        Musician Ashley Beauchamp was trying to track a missing parcel. DPD's AI chatbot was unable to help. He began experimenting. The chatbot swore at him, wrote a poem criticizing DPD, and called itself "a useless Chatbot that can't help you." The exchange went viral overnight. DPD disabled the AI component and blamed a "system update error."
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://www.theguardian.com/technology/2024/jan/20/dpd-ai-chatbot-swears-calls-itself-useless-and-criticises-firm" target="_blank" rel="noopener">The Guardian, Jan 2024</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: content policy enforcement and output validation before delivery to end users</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Chevrolet of Watsonville (GM dealership)</span>
          <span class="ir-incident-damage">Agreed to sell a 2024 Tahoe for $1</span>
        </div>
        <span class="ir-incident-date">December 2023</span>
      </div>
      <p class="ir-incident-body">
        A ChatGPT-powered chatbot on a Chevrolet dealership website was discovered by social media users. Within hours, people had pranked it into agreeing to sell a 2024 Chevy Tahoe for $1, write Python scripts, endorse competing car brands, and make absurd political statements. Posts went viral on X and Reddit. The bot was taken offline in damage control.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://www.businessinsider.com/car-dealership-chevrolet-chatbot-chatgpt-pranks-chevy-2023-12" target="_blank" rel="noopener">Business Insider, Dec 2023</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: prompt guard and content policy block adversarial manipulation before output is generated</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">National Eating Disorders Association (NEDA)</span>
          <span class="ir-incident-damage">Harmful advice to vulnerable users; bot shut down</span>
        </div>
        <span class="ir-incident-date">June 2023</span>
      </div>
      <p class="ir-incident-body">
        NEDA fired its human helpline staff and replaced them with an AI chatbot named "Tessa." The chatbot immediately began recommending calorie restriction, daily weight monitoring, and maintaining a calorie deficit -- to people with eating disorders. One activist wrote: "Every single thing Tessa suggested were things that led to the development of my eating disorder." The bot was shut down within days.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Sources: <a href="https://www.bbc.com/news/world-us-canada-65771872" target="_blank" rel="noopener">BBC</a>, <a href="https://www.npr.org/sections/health-shots/2023/06/08/1180838096/an-eating-disorders-chatbot-offered-dieting-advice-raising-fears-about-ai-in-hea" target="_blank" rel="noopener">NPR</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: operator content policy, human-in-loop for sensitive domain outputs</span>
      </div>
    </div>

  </section>
</div>

<!-- CATEGORY 4: LEGAL LIABILITY -->
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow eyebrow-amber">
      <i class="ti ti-gavel"></i>
      Legal and compliance liability
    </div>
    <h2>Courts hold companies responsible for what their AI says.</h2>
    <p class="ir-category-intro">
      "The chatbot did it" is not a legal defense. GDPR fines for unmonitored AI-driven data exfiltration reach 4% of global annual turnover. Precedents are being set now.
    </p>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Air Canada</span>
          <span class="ir-incident-damage">Court-ordered refund + legal costs</span>
        </div>
        <span class="ir-incident-date">February 2024</span>
      </div>
      <p class="ir-incident-body">
        Passenger Jake Moffatt's grandmother died. He asked Air Canada's chatbot about bereavement fares. The chatbot hallucinated a policy: book now, request a refund within 90 days. He followed those instructions. Air Canada denied the refund, citing its actual policy. In court, Air Canada argued the chatbot was "a separate legal entity responsible for its own actions." The tribunal called this defense "remarkable" and ordered Air Canada to pay $650.88 CAD plus fees and interest. The chatbot was subsequently disabled.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://arstechnica.com/tech-policy/2024/02/air-canada-must-honor-refund-policy-invented-by-airlines-chatbot/" target="_blank" rel="noopener">Ars Technica, Feb 2024</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: output validation and human-in-loop for any agent response that could create a binding commitment</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Levidow, Levidow and Oberman (law firm)</span>
          <span class="ir-incident-damage">$5,000 fine, case dismissed, public sanction</span>
        </div>
        <span class="ir-incident-date">2023</span>
      </div>
      <p class="ir-incident-body">
        Attorney Steven Schwartz used ChatGPT to research legal precedents for a personal injury case. ChatGPT hallucinated six entirely fake court cases with realistic-sounding citations. Schwartz filed them in federal court without verifying. The judge discovered all six were fabricated. The case was dismissed and both attorneys were publicly sanctioned and fined $5,000. The case is now a nationwide warning to the legal profession about unvalidated AI outputs.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: <a href="https://en.wikipedia.org/wiki/Mata_v._Avianca,_Inc." target="_blank" rel="noopener">Mata v. Avianca, Inc. (Wikipedia)</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: output validation flags hallucinated citations before they leave the agent workflow</span>
      </div>
    </div>

    <div class="ir-incident">
      <div class="ir-incident-header">
        <div class="ir-incident-meta">
          <span class="ir-incident-company">Any EU operator using external LLM providers</span>
          <span class="ir-incident-damage">Up to 4% of global annual turnover (GDPR Article 83)</span>
        </div>
        <span class="ir-incident-date">Ongoing exposure</span>
      </div>
      <p class="ir-incident-body">
        When an AI agent without egress filtering sends internal data to a third-party LLM provider, it moves personal or proprietary data to an external server with a different data controller. Under GDPR Article 33, this is potentially a reportable data breach requiring notification within 72 hours. The fine for a breach -- and for failure to notify within the window -- reaches 4% of global annual turnover. For a company the size of Samsung, that is measured in billions. Most companies do not know the breach happened until long after the reporting window has closed, compounding the liability.
      </p>
      <div class="ir-incident-footer">
        <span class="ir-incident-source">Source: GDPR Article 33 (72-hour notification), Article 83 (fine schedule). Samsung incident: <a href="https://www.bloomberg.com/news/articles/2023-05-02/samsung-bans-chatgpt-and-other-generative-ai-use-by-staff-after-leak" target="_blank" rel="noopener">Bloomberg, May 2023</a></span>
        <span class="ir-scout-fix"><i class="ti ti-shield-check"></i> Scout fix: egress filtering keeps data inside your infrastructure; audit trail provides breach evidence; documented compliance posture for insurers and regulators</span>
      </div>
    </div>

  </section>
</div>

<!-- SCOUT ANSWER TABLE -->
<div class="container">
  <section class="ir-answer-section">
    <div class="ir-category-eyebrow eyebrow-green">
      <i class="ti ti-shield-bolt"></i>
      The Scout answer
    </div>
    <h2 style="font-size:1.55rem;font-weight:700;letter-spacing:-0.025em;line-height:1.1;color:var(--text-primary);margin-bottom:0.6rem;">
      What Scout would have done.
    </h2>
    <p style="font-size:0.88rem;color:var(--text-mid);max-width:520px;line-height:1.65;margin-bottom:0;">
      Every incident above was preventable with the controls Scout provides. This is not retrofitting; it is exactly what Scout was designed to enforce.
    </p>

    <table class="ir-answer-table">
      <thead>
        <tr>
          <th>Incident</th>
          <th>Why it happened</th>
          <th>Scout prevention</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>$500M Claude bill</td>
          <td>No spending caps, no agent budget controls</td>
          <td>Per-agent quotas, real-time usage dashboard, threshold alerts</td>
        </tr>
        <tr>
          <td>13-hour AWS outage</td>
          <td>Agent ran with full human-level permissions, no approval gate</td>
          <td>Dangerous operation detection, approval gates, permission scoping</td>
        </tr>
        <tr>
          <td>rm -rf filesystem destruction</td>
          <td>Unchecked shell execution, no command classification</td>
          <td>Command flagging intercepts DANGER operations before execution</td>
        </tr>
        <tr>
          <td>Samsung source code leak</td>
          <td>No egress filtering, data sent to external provider</td>
          <td>Egress filtering keeps data inside your infrastructure</td>
        </tr>
        <tr>
          <td>Air Canada hallucinated policy</td>
          <td>No output validation, no human-in-loop for binding outputs</td>
          <td>Output validation, human-in-loop flag for commitment-generating responses</td>
        </tr>
        <tr>
          <td>DPD / Chevy brand meltdown</td>
          <td>No content policy enforcement on public-facing AI</td>
          <td>Prompt guard, content policy, operator-defined output rules</td>
        </tr>
        <tr>
          <td>Bing prompt injection</td>
          <td>Injection bypassed system prompt, no gateway-level defense</td>
          <td>Prompt guard middleware intercepts injection at the gateway</td>
        </tr>
        <tr>
          <td>GDPR silent breach exposure</td>
          <td>No egress control, no audit trail for breach notification</td>
          <td>Egress filtering plus full audit log provides breach evidence and posture</td>
        </tr>
      </tbody>
    </table>
  </section>
</div>

<!-- FINAL CTA -->
<div class="container">
  <section class="ir-cta">
    <h2>Nobody was watching.<br>Scout is the watching.</h2>
    <p>
      From £49/mo. Pre-wired for Carina. Connects to any agent stack via API. One config value to enable.
    </p>
    <div class="ir-cta-actions">
      <a href="https://labyrinthscout.com/#pricing" class="btn-primary">
        <i class="ti ti-shield-lock"></i>
        See Scout pricing
      </a>
      <a href="https://carinaai.uk" class="btn-secondary">
        <i class="ti ti-sparkles"></i>
        Start with Carina free
      </a>
    </div>
  </section>
</div>

<!-- METHODOLOGY -->
<div class="container">
  <div style="padding:2rem 0;border-top:1px solid var(--border);">
    <p style="font-size:0.73rem;color:var(--text-dim);line-height:1.7;max-width:640px;">
      <strong style="color:var(--text-mid);">Methodology.</strong>
      All incidents verified via published press sources (Ars Technica, BBC, Bloomberg, Business Insider, Docker, Forbes, The Guardian, NPR, The Register, Tom's Hardware). Academic papers verified via arXiv. OWASP data verified via genai.owasp.org. The $500M and Uber budget claims originate from a single Axios article citing unnamed sources; both are presented as reported rather than independently verified. Reddit and developer forum posts were reviewed for pattern evidence but are not cited as primary sources. AI Incident Database: incidentdatabase.ai. GDPR citation: regulation (EU) 2016/679, Articles 33 and 83.
    </p>
  </div>
</div>

<footer class="ir-footer">
  <div class="container">
    <div class="ir-footer-inner">
      <span>Labyrinth Scout. A VERLOX product.</span>
      <div style="display:flex;gap:1.5rem;">
        <a href="https://labyrinthscout.com">Home</a>
        <a href="https://labyrinthscout.com/#pricing">Pricing</a>
        <a href="https://carinaai.uk">Carina</a>
        <a href="https://docs.carinaai.uk">Docs</a>
      </div>
      <span>Research compiled June 2026.</span>
    </div>
  </div>
</footer>

</body>
</html>
```

---

## WHAT NOT TO CHANGE

- Do not touch the hero section on either site.
- Do not remove or rewrite any existing sections on labyrinthscout.com or carinaai.uk.
- Do not add incident citations inside CLI alert copy or tooltip text. Fear content belongs in marketing, not in-product messaging.
- Do not change existing pricing cards, the kill switch section, the trust passport section, or the footer on either site.
- No em dashes (U+2014). No en dashes (U+2013). No emojis anywhere. Hyphens, colons, or sentence breaks only.

---

## AFTER THE CHANGES: VERIFICATION CHECKLIST

1. labyrinthscout.com/index.html: Incident section shows 3 cards in a row at desktop, stacks to 1 column on mobile (max-width 900px).
2. labyrinthscout.com/index.html: Stat strip shows 4 columns at desktop, 2 columns at mobile (max-width 768px).
3. labyrinthscout.com/index.html: "Read the full incident record" button links to `/incidents/`.
4. labyrinthscout.com/index.html: Nav has "Incidents" link before "Pricing" in both desktop and mobile nav.
5. labyrinthscout.com/incidents/index.html: Page renders correctly. All source links open in new tabs. The methodology note at the bottom is present.
6. labyrinthscout.com/incidents/index.html: Scout answer table renders all 8 rows. Column widths are reasonable on mobile (table may scroll horizontally; that is acceptable).
7. carinaai.uk/index.html: "Without oversight" section appears between the safety section and the journey section.
8. carinaai.uk/index.html: Fear hook line appears inside the Scout cross-sell section below the h2.
9. Both sites: No em dashes, no en dashes, no emojis in any added content.
10. Both sites: Red accent is used for damage/fear elements. Green accent is used for Scout solution elements.
