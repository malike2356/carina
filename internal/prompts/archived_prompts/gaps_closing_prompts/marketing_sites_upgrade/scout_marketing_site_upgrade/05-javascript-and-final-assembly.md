# Scout Prompt 05 - JavaScript and Final Assembly Checklist

## Target file

`/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html`

## What this prompt delivers

The inline JavaScript closing the body, the closing tags, and the complete final assembly checklist.

---

## JAVASCRIPT - closing body content

After the footer and before `</body>`, add:

```html
<script>
(function () {
  'use strict';

  /* Mobile nav toggle */
  var hamburger   = document.getElementById('nav-hamburger');
  var mobilePanel = document.getElementById('nav-mobile-panel');

  if (hamburger && mobilePanel) {
    hamburger.addEventListener('click', function () {
      var isOpen = mobilePanel.classList.contains('open');
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

  /* Scroll-activated nav border */
  var nav = document.getElementById('main-nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.style.borderBottomColor = window.scrollY > 20
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(255,255,255,0.04)';
    }, { passive: true });
  }

  /* Fade-up on scroll */
  if ('IntersectionObserver' in window) {
    var style = document.createElement('style');
    style.textContent = [
      '.fade-up { opacity: 0; transform: translateY(24px); transition: opacity 0.55s ease, transform 0.55s ease; }',
      '.fade-up.visible { opacity: 1; transform: none; }'
    ].join('');
    document.head.appendChild(style);

    var targets = document.querySelectorAll(
      '.ks-content, .ks-visual, ' +
      '.tp-content, .tp-visual, ' +
      '.inject-content, .inject-console, ' +
      '.gov-content, .gov-right, ' +
      '.pricing-card, ' +
      '.cta-h2, .cta-sub, .cta-actions, ' +
      '.inject-layer, .tp-pillar, .ks-action, .gov-flow-step, .gov-control'
    );

    targets.forEach(function (el) { el.classList.add('fade-up'); });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    targets.forEach(function (el) { observer.observe(el); });
  }

  /* Stagger delays for lists */
  document.querySelectorAll('.inject-layer').forEach(function (el, i) {
    el.style.transitionDelay = (i * 100) + 'ms';
  });

  document.querySelectorAll('.tp-pillar').forEach(function (el, i) {
    el.style.transitionDelay = (i * 80) + 'ms';
  });

  document.querySelectorAll('.ks-action').forEach(function (el, i) {
    el.style.transitionDelay = (i * 60) + 'ms';
  });

  document.querySelectorAll('.pricing-card').forEach(function (el, i) {
    el.style.transitionDelay = (i * 100) + 'ms';
  });

  document.querySelectorAll('.gov-flow-step').forEach(function (el, i) {
    el.style.transitionDelay = (i * 100) + 'ms';
  });

  /* Copy button handlers (for any .copy-btn elements in docs sections) */
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          var orig = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = orig; }, 1500);
        });
      }
    });
  });

})();
</script>

<script src="app.js"></script>
</body>
</html>
```

Note: `app.js` is linked AFTER the inline script so the radar animation and any canvas setup from the original file still runs. Do not remove the `app.js` link.

---

## FINAL ASSEMBLY CHECKLIST

Before deploying, verify each item:

### Copy checks

- [ ] `<title>` reads: "Labyrinth Scout - Observe. Verify. Control."
- [ ] `<meta name="description">` includes "Mission Control for Autonomous Agents"
- [ ] Hero badge reads "Mission Control for Autonomous Agents" (not "Autonomous Agent Governance")
- [ ] Hero h1 contains "Autonomous agents are powerful. Who's in control?"
- [ ] Hero tagline "Observe. Verify. Control." appears below the h1
- [ ] Section 2 heading contains "Every Autonomous System Needs A Brake."
- [ ] Section 3 heading contains "Don't Trust Agent Claims. Verify Them."
- [ ] Section 4 heading contains "Stop Prompt Injection Before It Becomes Action."
- [ ] Section 5 heading contains "Security Tools Detect. Scout Governs."
- [ ] Final CTA heading contains "Before You Deploy Agents. Deploy Authority."
- [ ] Footer tagline contains "Observe. Verify. Control." and "Mission Control for Autonomous Agents"
- [ ] No blockchain/ERC/on-chain terminology appears in any section heading or subheadline
- [ ] No em dashes (;) anywhere in the HTML
- [ ] No emojis in visible text (Tabler CSS icons only)
- [ ] "The Authority Layer for Autonomous Systems" does NOT appear on the landing page (it belongs in docs)

### Visual checks (open in browser at http://localhost/verlox/carina/labyrinthscout.com/)

- [ ] Page background is very dark (#06090f) with a faint red grid
- [ ] Nav logo reads "LabyrinthScout" with red accent on "Scout"
- [ ] Hero uses red palette throughout (badge, callouts, accent text)
- [ ] Kill Switch section has the animated concentric pulsing rings around the red button
- [ ] Trust Passport section has the card with cyan border and trust fields
- [ ] Injection Shield console log renders with colour-coded tags
- [ ] Governance comparison table renders cleanly with red-tinted right column
- [ ] Pricing grid has three cards with red "Most Popular" badge on Pro
- [ ] Final CTA has radial red glow from the top
- [ ] Footer reads "Labyrinth Scout" with red accent
- [ ] Radar animation in hero section runs (it comes from app.js)
- [ ] Mobile nav hamburger appears at 768px
- [ ] Fade-up animations trigger as sections enter viewport

### Identity checks

- [ ] The page colour palette (dark bg, red accent) is visually distinct from carinaai.uk (dark bg, green accent)
- [ ] A user who switches from carinaai.uk to labyrinthscout.com should feel they are on a related but distinct product - same family, different register

### Deployment

Once all checklist items pass:

```bash
bash /opt/lampp/htdocs/verlox/carina/scripts/deploy-marketing.sh
```

Verify live at `https://labyrinthscout.com` after deployment.

---

## Post-deployment priorities (not in scope for this prompt series)

1. Replace the Radar animation hero with a real dashboard screenshot once the Scout console has been visually polished (as per the Scout console upgrade prompts in `console.labyrinthscout.com/prompts/`).
2. Connect the Trust Passport card to the live `/api/trust` endpoint if one exists, so real agent data shows instead of fictional example data.
3. Add an integration "Get started" section between Pricing and CTA once the SDK quickstart flow is finalised - this reduces friction from "I want Scout" to "I have Scout running."
