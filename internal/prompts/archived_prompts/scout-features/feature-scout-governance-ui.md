# Scout: Governance Posture Banner + Marketing Site Reframe

Two files. One sitting. No new endpoints, no new backend code.

## Context

Scout is being repositioned from "AI security layer" to "Autonomous Agent Governance
Platform." Two immediate UI changes make that real:

1. The dashboard needs a single dominant "are we safe?" answer above the existing metrics
2. The marketing site hero needs to lead with governance, not monitoring

## File 1: `console.labyrinthscout.com/public/dashboard.html`

### Change A: Governance Posture Banner

Insert a new `<div id="governance-posture-banner">` immediately before the existing
`<div class="op-section" aria-label="Live posture">` (around line 385).

The banner reads existing data from `posture-summary.js` which already fetches
`/api/dashboard/posture` and populates `posture-risk-value`, `posture-kill-state`, etc.
The banner just needs to read those values and set its own state.

HTML to insert:

```html
<div id="governance-posture-banner" class="governance-banner" aria-live="polite">
  <div class="gov-banner-state">
    <span id="gov-banner-label">CHECKING</span>
  </div>
  <div class="gov-banner-detail">
    <span>Risk Score: <strong id="gov-banner-risk">-</strong></span>
    <span id="gov-banner-sep" aria-hidden="true">·</span>
    <span id="gov-banner-agents">- agents governed</span>
    <span aria-hidden="true">·</span>
    <span id="gov-banner-verified">Last verified: -</span>
  </div>
</div>
```

CSS to add in the `<style>` block (before the closing `</style>`):

```css
.governance-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: .65rem 1rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  margin-bottom: .75rem;
  font-family: 'JetBrains Mono', monospace;
  transition: border-color .3s, background .3s;
}
.governance-banner.state-safe {
  border-color: rgba(34,197,94,.5);
  background: rgba(34,197,94,.07);
}
.governance-banner.state-risk {
  border-color: rgba(212,175,55,.5);
  background: rgba(212,175,55,.07);
}
.governance-banner.state-breach {
  border-color: rgba(255,34,68,.5);
  background: rgba(255,34,68,.1);
}
.gov-banner-state {
  display: flex;
  align-items: center;
  gap: .5rem;
}
#gov-banner-label {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: .1em;
}
.state-safe #gov-banner-label  { color: #22c55e; }
.state-risk #gov-banner-label  { color: var(--amber); }
.state-breach #gov-banner-label { color: var(--red); }
.gov-banner-detail {
  display: flex;
  gap: .85rem;
  font-size: .72rem;
  color: var(--text-muted, #6b7a8d);
}
.gov-banner-detail strong { color: var(--bright, #e2e8f0); }
```

JS to add at the bottom of `dashboard.html` (after the existing `posture-summary.js`
script tag, before `</body>`):

```html
<script>
(function () {
  function updateGovernanceBanner() {
    const riskVal = document.getElementById('posture-risk-value');
    const killVal = document.getElementById('posture-kill-state');
    const agentsVal = document.getElementById('posture-agents-active');
    const banner = document.getElementById('governance-posture-banner');
    const label = document.getElementById('gov-banner-label');
    const riskOut = document.getElementById('gov-banner-risk');
    const agentsOut = document.getElementById('gov-banner-agents');
    const verifiedOut = document.getElementById('gov-banner-verified');

    if (!banner || !riskVal) return;

    const risk = parseInt(riskVal.textContent, 10) || 0;
    const killTriggered = (killVal?.textContent || '').toLowerCase().includes('triggered');
    const agents = parseInt(agentsVal?.textContent, 10) || 0;

    let state, labelText;
    if (killTriggered || risk >= 70) {
      state = 'breach';
      labelText = 'BREACH DETECTED';
    } else if (risk >= 31) {
      state = 'risk';
      labelText = 'AT RISK';
    } else if (riskVal.textContent === '-') {
      state = '';
      labelText = 'CHECKING';
    } else {
      state = 'safe';
      labelText = 'SAFE';
    }

    banner.className = 'governance-banner' + (state ? ' state-' + state : '');
    label.textContent = labelText;
    riskOut.textContent = risk || '-';
    agentsOut.textContent = agents + ' agent' + (agents === 1 ? '' : 's') + ' governed';
    verifiedOut.textContent = 'Last verified: ' + new Date().toLocaleTimeString();
  }

  // Run once on page load after posture data arrives
  setTimeout(updateGovernanceBanner, 2000);

  // Re-run whenever posture data refreshes (observe DOM changes on the risk value element)
  const riskEl = document.getElementById('posture-risk-value');
  if (riskEl && window.MutationObserver) {
    new MutationObserver(updateGovernanceBanner).observe(riskEl, { childList: true, subtree: true, characterData: true });
  }
})();
</script>
```

### Change B: Kill Switch metric card - make it stand out

The kill switch is currently `<div class="op-metric" data-help="posture-kill-switch">`.

Replace only the outer class to give it a distinct border when triggered. Add a JS
listener already handled by the existing `kill-switch.js` widget. The simplest change
is to add `id="posture-kill-metric"` to that card so the kill-switch widget can style it:

```html
<div class="op-metric" id="posture-kill-metric" data-help="posture-kill-switch">
```

Add CSS:

```css
#posture-kill-metric.kill-armed    { border-left: 3px solid rgba(34,197,94,.6); }
#posture-kill-metric.kill-triggered { border-left: 3px solid var(--red); background: rgba(255,34,68,.08); }
```

In the existing `kill-switch.js` (or inline), after the kill switch state is rendered,
add the class:

```javascript
const killCard = document.getElementById('posture-kill-metric');
if (killCard) {
  killCard.classList.remove('kill-armed', 'kill-triggered');
  killCard.classList.add(data.triggered ? 'kill-triggered' : 'kill-armed');
}
```

Where `data` is the kill switch status object. Find where `posture-kill-state` text is
set in `posture-summary.js` and add these two lines immediately after.

---

## File 2: `labyrinthscout.com/index.html`

Three precise edits. Do not change anything else in the file.

### Edit A: Badge text and H1 (lines 59-64 approx)

Current:
```html
<div class="hero-badge">
  <i class="ti ti-shield-check"></i>
  <span>Agent monitoring and risk control</span>
</div>
<h1>Watch agents. <span class="text-gradient">Stop bad runs.</span> Prove what happened.</h1>
<p>Scout monitors agent sessions, raises alerts, and gives operators a fast way to respond. It does not run tasks; your agent does. Carina is the reference agent; any stack can integrate via HTTP or SDK.</p>
```

Replace with:
```html
<div class="hero-badge">
  <i class="ti ti-shield-check"></i>
  <span>Autonomous Agent Governance</span>
</div>
<h1>Autonomous AI is powerful. <span class="text-gradient">Who is governing it?</span></h1>
<p>Scout gives your organisation complete visibility, approval controls, and audit trails for autonomous AI agents. Monitor actions. Contain incidents. Prove compliance. Works with any agent stack via HTTP or SDK.</p>
```

### Edit B: Three hero metrics (lines 76-80 approx)

Current:
```html
<span class="hero-metric"><strong>Monitor</strong> live sessions</span>
<span class="hero-metric"><strong>Respond</strong> to risky runs</span>
<span class="hero-metric"><strong>Report</strong> outcomes clearly</span>
```

Replace with:
```html
<span class="hero-metric"><strong>Visibility</strong> into every action</span>
<span class="hero-metric"><strong>Control</strong> over agent behaviour</span>
<span class="hero-metric"><strong>Evidence</strong> for compliance</span>
```

### Edit C: Footer tagline (line 404 approx)

Current:
```html
<p class="footer-tagline">Monitoring and control for production agents · Pairs with <a href="https://carinaai.uk" style="color:var(--cyber);text-decoration:none;">Carina</a></p>
```

Replace with:
```html
<p class="footer-tagline">Governance for autonomous AI · Integrates with <a href="https://carinaai.uk" style="color:var(--cyber);text-decoration:none;">Carina</a> and any agent stack</p>
```

### Edit D: Meta description (line 10 approx)

Current:
```html
<meta name="description" content="Labyrinth Scout watches autonomous agents in production: live audit trail, prompt-injection defence, kill switch, and compliance exports. Scout Monitor from £79/mo; Scout Pro £99/mo.">
```

Replace with:
```html
<meta name="description" content="Labyrinth Scout is an autonomous agent governance platform: complete audit trails, policy enforcement, kill switch, and compliance exports for any AI agent stack. Scout Monitor from £79/mo; Scout Pro £99/mo.">
```

---

## Constraints

- No backend changes
- No new npm packages or build steps
- The banner JS must read existing DOM values, not make new API calls
- Kill switch CSS class must coexist with existing `kill-switch.js` without conflict
- No em dashes. No emojis.

## Validation

```bash
# Scout dashboard: open locally and verify
cd console.labyrinthscout.com
pnpm dev   # port 4444
# Open http://localhost:4444 - should see SAFE/CHECKING banner above Live Posture row
# Trigger kill switch - banner should turn red immediately via MutationObserver

# Marketing site: open statically
cd labyrinthscout.com
python3 -m http.server 8001
# Open http://localhost:8001 - verify new H1 and three metric labels
```

No test files required. These are purely visual changes.
