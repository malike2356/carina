# Sprint 6 -- hireaiva.co.uk Marketing Site

**Status: COMPLETED 2026-06-26**

**What was built:**

- **Standalone site:** `03-frontends/marketing/hireaiva/index.html` copied from `carinaai.uk/aiva/` with `vertical.css` and `assets/` (badges, PWA favicon, JS).
- **Rebrand:** H1 "Hire Aiva. Get your time back."; time-problem copy moved to `.hero-sub`; title, meta, and canonical set to `https://hireaiva.co.uk`.
- **Nav/footer:** Logo is "Aiva." linking to hireaiva.co.uk; carinaai.uk links kept for Use cases, Security, Pricing, Docs, Trust; Scout external.
- **CTAs:** All register/billing links use `https://hireaiva.co.uk/register` and `https://hireaiva.co.uk/billing`; pricing note links to `https://carinaai.uk/pricing/`.
- **Attribution:** "Powered by Carina" badge retained; footer copy "Aiva is an AI Employee powered by Carina."
- **Pricing API:** Still fetches `https://core.carinaai.uk/api/public/pricing` (unchanged).
- **Nginx:** `02-backends/core.carinaai.uk/docker/nginx/hireaiva.co.uk.conf` serves static root, proxies `/register` and `/billing` to Carina cloud with `Host: aiva.carinaai.uk`, redirects www and hireaiva.uk to apex.
- **Cross-links:** carinaai.uk nav and pricing CTAs updated to point at hireaiva.co.uk.
- **Deploy:** Live at https://hireaiva.co.uk/ (HTTP 200, verified 2026-06-26).

**Sprint:** 6
**Product:** Aiva (AI Employee)
**Domain:** hireaiva.co.uk (primary) + hireaiva.uk (redirect to .co.uk)
**Primary agent:** Cursor
**Estimated hours:** 1-2 h

---

## Goal

Adapt the existing Aiva marketing page from `carinaai.uk/aiva/` to its own
domain at `hireaiva.co.uk`. The page is already built. We are copying,
rebranding, and pointing it to the new domain.

---

## Source File

```
03-frontends/marketing/carinaai.uk/aiva/index.html
```

This is a 2,185-line, 77KB static HTML page. It references:
- `/vertical.css` -- shared stylesheet in the marketing directory
- `/assets/badges/powered-by-carina.svg` -- the powered-by badge
- Tabler Icons (CDN)
- Google Fonts (Cormorant Garamond + Instrument Sans)

---

## What to Do

### Step 1: Copy to New Location

```
cp 03-frontends/marketing/carinaai.uk/aiva/index.html 03-frontends/marketing/hireaiva/index.html
```

Also copy `vertical.css` and the assets directory if the new site is fully
standalone.

### Step 2: Rebrand the Page

Make these changes to the new `hireaiva/index.html`:

**Hero heading (critical -- replaces current H1):**
```html
<h1>Hire Aiva. Get your time back.</h1>
<p class="hero-sub">Most entrepreneurs don't have a staffing problem. They have a time problem.</p>
```

The current page has "Most entrepreneurs don't have a staffing problem. They have a time problem." as the H1. Move it to the subhead. The new H1 is "Hire Aiva. Get your time back." -- action first, product name, domain tie-in.

**Title and meta:**
```html
<title>Hire Aiva. Get your time back. | AI Employee</title>
<meta name="description" content="Hire Aiva -- the AI Employee that handles admin, follow-ups, bookings, and customer questions. Human VA backup included. 15-day free trial.">
<link rel="canonical" href="https://hireaiva.co.uk">
```

**Nav:**
- The current nav has "Carina." as the logo link. Change to "Aiva."
- Change nav logo link from `/` to `https://hireaiva.co.uk`
- Keep nav links: Use Cases, Aiva, Security, Pricing, Docs, Scout, Trust
- Links to carinaai.uk sections should stay on carinaai.uk for now

**"Powered by Carina" badge:**
- Already exists at line 2037: `<img src="/assets/badges/powered-by-carina.svg" alt="Powered by Carina" height="20">`
- Keep this. It's the correct attribution.

**Footer:**
```html
<footer class="site-footer">
  <div class="footer-inner">
    <a href="https://hireaiva.co.uk" class="nav-logo">Aiva<span class="dot">.</span></a>
    <div class="footer-links">
      <!-- Keep existing footer links, update domain references -->
    </div>
    <div class="footer-legal">
      <!-- ... -->
    </div>
    <p class="footer-copy">Aiva is an AI Employee powered by Carina. &copy; 2026 <a href="https://verlox.uk">VERLOX Ltd</a>.</p>
  </div>
</footer>
```

**CTA links:**
- Change `https://aiva.carinaai.uk/register` to `https://hireaiva.co.uk/register`
- Change `https://aiva.carinaai.uk/billing/aiva` to `https://hireaiva.co.uk/billing`
- If the register/billing paths are proxied through the new domain, update.
  If they stay on aiva.carinaai.uk, leave them.

**Pricing section:**
- The current page fetches pricing from `https://core.carinaai.uk/api/public/pricing`
- This can stay. The API doesn't need to move.
- But update the note: change "Building on Carina directly?" link from `/pricing/`
  to `https://carinaai.uk/pricing/`

### Step 3: Deploy

Files go to the Contabo VPS at `/www/wwwroot/hireaiva.co.uk/`:

```bash
# Deploy the new marketing site
rsync -avz 03-frontends/marketing/hireaiva/ malike@80.190.81.208:/www/wwwroot/hireaiva.co.uk/

# Also copy the shared CSS and assets if referenced relatively
rsync -avz 03-frontends/marketing/carinaai.uk/vertical.css malike@80.190.81.208:/www/wwwroot/hireaiva.co.uk/
rsync -avz 03-frontends/marketing/carinaai.uk/assets/ malike@80.190.81.208:/www/wwwroot/hireaiva.co.uk/assets/
```

Add nginx server block on the VPS for the new domain (delegate to Claude):

```nginx
server {
    server_name hireaiva.co.uk hireaiva.uk www.hireaiva.co.uk;
    root /www/wwwroot/hireaiva.co.uk;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy API calls to Carina backend
    location /register {
        proxy_pass http://localhost:3000;
        proxy_set_header Host aiva.carinaai.uk;
    }

    location /billing {
        proxy_pass http://localhost:3000;
        proxy_set_header Host aiva.carinaai.uk;
    }

    # SSL managed by aaPanel on the VPS
}
```

---

## What NOT to Change

- The pricing fetch from `core.carinaai.uk` -- keep it
- The overall design, colours, fonts -- the page works, don't redesign
- The demo scenarios, feature lists, role templates -- they're good
- The human VA backup messaging -- core differentiator, don't touch
- The "Powered by Carina" badge -- keep it visible

---

## Verification

- [x] hireaiva.co.uk loads the page (after DNS + nginx deploy)
- [ ] hireaiva.uk redirects to hireaiva.co.uk (nginx config ready; DNS for hireaiva.uk not resolving yet)
- [x] "Powered by Carina" badge visible
- [x] Footer says "Aiva is an AI Employee powered by Carina"
- [x] CTA links work (register HTTP 200, billing HTTP 307 to /billing/aiva)
- [x] Canonical URL is hireaiva.co.uk
- [x] Mobile layout intact (responsive nav and sections present)
- [x] No emojis, no em/en dashes
- [x] All existing demo scenarios still work (demo tabs and conv-mock JS retained)
