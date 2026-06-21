# Prompt 04 - Final CTA Section and Footer

## Target file

`/opt/lampp/htdocs/verlox/carina/carinaai.uk/index.html`

## What this prompt adds

Section 6 (Final CTA with stats bar) and the updated footer. After this, only the inline JavaScript remains (Prompt 05).

Delete any existing CTA section and footer, replace with the versions below.

---

## CSS to add

```css
/* --- STATS BAR --- */
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0;
  background: var(--bg-lift);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 1.25rem 0;
  overflow: hidden;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 2rem;
  border-right: 1px solid var(--border);
}

.stat-item:last-child { border-right: none; }

.stat-item-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--green);
  letter-spacing: -0.02em;
}

.stat-item-label {
  font-size: 0.75rem;
  color: var(--text-dim);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: 500;
}

@media (max-width: 600px) {
  .stat-item { border-right: none; padding: 0.5rem 1.25rem; }
}

/* --- CTA SECTION --- */
.cta-section {
  background: var(--bg);
  padding: 8rem 0;
  text-align: center;
  position: relative;
  z-index: 1;
}

.cta-section::before {
  content: '';
  position: absolute;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse at 50% 0%, rgba(22,201,126,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.cta-h2 {
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--text-primary);
  margin-bottom: 1.25rem;
}

.cta-h2 em {
  font-style: normal;
  color: var(--green);
}

.cta-sub {
  font-size: 1rem;
  color: var(--text-mid);
  max-width: 480px;
  margin: 0 auto 2.5rem;
  line-height: 1.7;
}

.cta-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-outline {
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

.btn-outline:hover { color: var(--text-primary); border-color: var(--green); }

/* --- FOOTER --- */
footer {
  background: var(--bg-lift);
  border-top: 1px solid var(--border);
  padding: 3.5rem 0 2rem;
  position: relative;
  z-index: 1;
}

.footer-inner {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

@media (max-width: 900px) {
  .footer-inner { grid-template-columns: 1fr 1fr; gap: 2rem; }
}

@media (max-width: 520px) {
  .footer-inner { grid-template-columns: 1fr; gap: 1.5rem; }
}

.footer-brand {}

.footer-logo {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  display: block;
  margin-bottom: 0.85rem;
}

.footer-logo span { color: var(--green); }

.footer-tagline {
  font-size: 0.8rem;
  color: var(--text-dim);
  line-height: 1.6;
  max-width: 260px;
}

.footer-col h4 {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 1rem;
}

.footer-col a {
  display: block;
  font-size: 0.83rem;
  color: var(--text-mid);
  text-decoration: none;
  margin-bottom: 0.6rem;
  transition: color var(--transition);
}

.footer-col a:hover { color: var(--text-primary); }

.footer-bottom {
  padding-top: 2rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-bottom-left {
  font-size: 0.78rem;
  color: var(--text-dim);
}

.footer-bottom-links {
  display: flex;
  gap: 1.5rem;
}

.footer-bottom-links a {
  font-size: 0.78rem;
  color: var(--text-dim);
  text-decoration: none;
  transition: color var(--transition);
}

.footer-bottom-links a:hover { color: var(--text-mid); }
```

---

## STATS BAR HTML

Insert after the Scout cross-sell section from Prompt 03, before the final CTA:

```html
<!-- STATS BAR -->
<div class="stats-bar">
  <div class="stat-item">
    <span class="stat-item-number">71</span>
    <span class="stat-item-label">Tools</span>
  </div>
  <div class="stat-item">
    <span class="stat-item-number">40+</span>
    <span class="stat-item-label">Channels</span>
  </div>
  <div class="stat-item">
    <span class="stat-item-number">23</span>
    <span class="stat-item-label">LLM Providers</span>
  </div>
  <div class="stat-item">
    <span class="stat-item-number">18</span>
    <span class="stat-item-label">Skill Packs</span>
  </div>
  <div class="stat-item">
    <span class="stat-item-number">MIT</span>
    <span class="stat-item-label">Licensed</span>
  </div>
</div>
```

---

## FINAL CTA SECTION HTML

Insert after the stats bar:

```html
<!-- SECTION 6: FINAL CTA -->
<section class="cta-section">
  <div class="container">
    <h2 class="cta-h2">
      Stop Starting Over.<br>
      <em>Start Compounding.</em>
    </h2>
    <p class="cta-sub">
      Build an intelligence layer that remembers everything, connects everything,
      and improves every day.
    </p>
    <div class="cta-actions">
      <a href="/docs/getting-started/" class="btn-primary">
        <i class="ti ti-rocket"></i>
        Get Started Free
      </a>
      <a href="https://github.com/VERLOX-UK/carina-agent" target="_blank" rel="noopener" class="btn-outline">
        <i class="ti ti-brand-github"></i>
        GitHub
      </a>
      <a href="/docs/" class="btn-outline">
        <i class="ti ti-book"></i>
        Documentation
      </a>
    </div>
  </div>
</section>
```

---

## FOOTER HTML

Replace the existing `<footer>` block with:

```html
<footer>
  <div class="container">
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/" class="footer-logo">Carina<span>.</span></a>
        <p class="footer-tagline">
          One Memory. One Agent. Everywhere.<br>
          The Operating System for Knowledge Work. MIT licensed.
        </p>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <a href="/docs/getting-started/">Get Started</a>
        <a href="#moat">Why Carina</a>
        <a href="#channels">Channels</a>
        <a href="#workspace">Workspace</a>
        <a href="/pricing/">Pricing</a>
        <a href="/skill-packs/">Skill Packs</a>
      </div>
      <div class="footer-col">
        <h4>Ecosystem</h4>
        <a href="https://labyrinthscout.com">Labyrinth Scout</a>
        <a href="https://carinaai.uk/trust">Trust Status</a>
        <a href="/community/">Community</a>
        <a href="/case-studies/">Case Studies</a>
        <a href="/enterprise/">Enterprise</a>
      </div>
      <div class="footer-col">
        <h4>Developers</h4>
        <a href="/docs/">Documentation</a>
        <a href="https://github.com/VERLOX-UK/carina-agent" target="_blank" rel="noopener">GitHub</a>
        <a href="/docs/api/">API Reference</a>
        <a href="/docs/sdk/">SDK</a>
        <a href="mailto:contact@verlox.uk">Contact</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-bottom-left">
        &copy; 2026 VERLOX Ltd. All rights reserved. carinaai.uk
      </span>
      <div class="footer-bottom-links">
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="/compliance/">Compliance</a>
      </div>
    </div>
  </div>
</footer>
```

---

## Notes

1. The stats bar is a standalone `<div>`, not a `<section>` - it is a transition element between the Scout cross-sell and the final CTA.

2. The footer brand tagline is now "One Memory. One Agent. Everywhere." - this is the approved product tagline and supersedes the previous usage of "Intelligence. Connected. Evolving."

3. Update the GitHub href to the real repository URL if it differs from the placeholder above.
