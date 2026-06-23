# Prompt 05 - JavaScript, Mobile Nav, and Final Assembly Checklist

## Target file

`/opt/lampp/htdocs/verlox/carina/carinaai.uk/index.html`

## What this prompt delivers

The inline JavaScript for the page (scroll effects, mobile nav, copy buttons) and the complete final assembly checklist to verify the page is correct before deployment.

---

## MOBILE NAV HTML

The nav from Prompt 01 hides links at 768px. Add a hamburger and mobile drawer. Insert this immediately after the closing `</nav>` tag:

```html
<button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu" aria-expanded="false" type="button">
  <span></span><span></span><span></span>
</button>

<div class="nav-mobile-panel" id="nav-mobile-panel" aria-hidden="true">
  <a href="#moat">Why Carina</a>
  <a href="#channels">Channels</a>
  <a href="#workspace">Workspace</a>
  <a href="https://labyrinthscout.com">Scout</a>
  <a href="/pricing/">Pricing</a>
  <a href="/docs/">Docs</a>
  <a href="https://github.com/VERLOX-UK/carina-agent" target="_blank" rel="noopener">GitHub</a>
  <a href="/docs/getting-started/" class="nav-mobile-cta">Get Started Free</a>
</div>
```

## CSS for mobile nav

```css
.nav-hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}

.nav-hamburger span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--text-mid);
  border-radius: 2px;
  transition: background var(--transition);
}

.nav-hamburger:hover span { background: var(--text-primary); }

@media (max-width: 768px) {
  .nav-hamburger { display: flex; }
}

.nav-mobile-panel {
  display: none;
  position: fixed;
  top: 60px; left: 0; right: 0;
  background: rgba(6,9,15,0.97);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
  padding: 1.5rem;
  z-index: 190;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-mobile-panel.open { display: flex; }

.nav-mobile-panel a {
  color: var(--text-mid);
  text-decoration: none;
  font-size: 0.95rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--border);
  transition: color var(--transition);
}

.nav-mobile-panel a:last-child { border-bottom: none; }

.nav-mobile-panel a:hover { color: var(--text-primary); }

.nav-mobile-cta {
  display: block;
  text-align: center;
  background: var(--green);
  color: #06090f;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: var(--r-md);
  margin-top: 1rem;
  border-bottom: none !important;
}
```

---

## JAVASCRIPT

Replace any existing inline `<script>` blocks or add before `</body>`:

```html
<script>
(function () {
  'use strict';

  /* Mobile nav toggle */
  const hamburger = document.getElementById('nav-hamburger');
  const mobilePanel = document.getElementById('nav-mobile-panel');

  if (hamburger && mobilePanel) {
    hamburger.addEventListener('click', function () {
      const isOpen = mobilePanel.classList.contains('open');
      mobilePanel.classList.toggle('open', !isOpen);
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      mobilePanel.setAttribute('aria-hidden', String(isOpen));
    });

    mobilePanel.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobilePanel.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        mobilePanel.setAttribute('aria-hidden', 'true');
      });
    });
  }

  /* Scroll-activated nav background */
  const nav = document.querySelector('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.style.borderBottomColor = window.scrollY > 20
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.04)';
    }, { passive: true });
  }

  /* Intersection observer: fade-up on scroll */
  if ('IntersectionObserver' in window) {
    const style = document.createElement('style');
    style.textContent = [
      '.fade-up { opacity: 0; transform: translateY(24px); transition: opacity 0.55s ease, transform 0.55s ease; }',
      '.fade-up.visible { opacity: 1; transform: none; }'
    ].join('');
    document.head.appendChild(style);

    const targets = document.querySelectorAll(
      '.moat-content, .moat-visual, .channels-content, .channels-visual, ' +
      '.workspace-content, .moat-visual, .scout-content, .scout-visual, ' +
      '.moat-callout, .channel-chip, .ws-feature, .scout-cap, .stat-item, ' +
      '.cta-h2, .cta-sub, .cta-actions'
    );

    targets.forEach(function (el) { el.classList.add('fade-up'); });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* Stagger channel chips and callouts */
  document.querySelectorAll('.channel-chip').forEach(function (chip, i) {
    chip.style.transitionDelay = (i * 40) + 'ms';
  });

  document.querySelectorAll('.moat-callout').forEach(function (c, i) {
    c.style.transitionDelay = (i * 80) + 'ms';
  });

  document.querySelectorAll('.scout-cap').forEach(function (c, i) {
    c.style.transitionDelay = (i * 60) + 'ms';
  });

  document.querySelectorAll('.stat-item').forEach(function (s, i) {
    s.style.transitionDelay = (i * 70) + 'ms';
  });

})();
</script>
```

---

## FINAL ASSEMBLY CHECKLIST

Before deploying, verify each item in order:

### Copy checks

- [ ] `<title>` reads: "Carina - One Memory. One Agent. Everywhere."
- [ ] `<meta name="description">` does not mention "self-hosted AI agents that do the work"
- [ ] Hero h1 contains "Your work lives in 20 apps. Your intelligence shouldn't."
- [ ] Section 2 heading contains "Skills That Compound." and appears before the channels section
- [ ] Section 3 heading contains "One Agent. One Memory. Everywhere."
- [ ] Section 4 heading contains "A Full Workspace. Not Another Chat Window."
- [ ] Section 5 heading contains "Intelligence Without Control Is A Liability."
- [ ] Section 6 heading contains "Stop Starting Over. Start Compounding."
- [ ] Footer tagline reads "One Memory. One Agent. Everywhere." (not "Intelligence. Connected. Evolving.")
- [ ] Stats bar shows: 71 Tools, 40+ Channels, 23 LLM Providers, 18 Skill Packs, MIT Licensed
- [ ] No em dashes (;) anywhere in the HTML (replace with commas, colons, or sentence breaks)
- [ ] No emojis anywhere in visible text (icons via Tabler CSS class only)

### Visual checks (open in browser at http://localhost/verlox/carina/carinaai.uk/)

- [ ] Nav is fixed, blurred background, visible on scroll
- [ ] Hero headline is large, green accent on "Your intelligence shouldn't."
- [ ] Hero visual placeholder (or real GIF) renders below the hero text
- [ ] Section 2 (Moat) has the three callout cards with icons
- [ ] Section 3 (Channels) has the channel chips grid
- [ ] Section 4 (Workspace) has the features grid and cookbook note
- [ ] Section 5 (Scout) has red-tinted styling distinct from green sections
- [ ] Stats bar renders as a full-width horizontal row between Scout and Final CTA
- [ ] Final CTA has radial green glow behind it
- [ ] Footer has four columns on desktop, collapses on mobile
- [ ] Mobile nav hamburger appears at 768px and below
- [ ] Mobile nav panel opens and closes correctly
- [ ] Fade-up animations trigger as sections scroll into view

### Asset checks

- [ ] Replace all `<div class="visual-placeholder">` divs with real `<img>` or `<video>` tags once demo GIFs are available
- [ ] Favicon references in `<head>` point to existing files in `/assets/pwa/`
- [ ] Tabler icons CDN link loads correctly (verify one icon renders in browser)
- [ ] Google Fonts Inter loads (verify font weight 700 is distinct from 400)

### Deployment

Once all checklist items pass:

```bash
bash /opt/lampp/htdocs/verlox/carina/scripts/deploy-marketing.sh
```

Verify live at `https://carinaai.uk` after deployment.
