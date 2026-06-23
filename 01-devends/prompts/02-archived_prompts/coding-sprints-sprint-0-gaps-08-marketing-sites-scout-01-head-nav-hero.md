# Scout Prompt 01 - Head, Nav, and Hero Section

## Target file

`/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html`

Replace the entire file contents with a fresh document starting from the `<head>` below. The existing `style.css` link is intentionally removed - all styles are now inline. The `app.js` link is kept at the bottom.

---

## COMPLETE NEW HEAD

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#06090f">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="application-name" content="Labyrinth Scout">
  <meta name="apple-mobile-web-app-title" content="Labyrinth Scout">
  <title>Labyrinth Scout - Observe. Verify. Control.</title>
  <meta name="description" content="Mission Control for Autonomous Agents. Scout monitors, governs, and intervenes when AI systems drift beyond policy, trust, or safety boundaries. Kill Switch. Trust Passport. Injection Shield.">
  <meta property="og:title" content="Labyrinth Scout - Observe. Verify. Control.">
  <meta property="og:description" content="Mission Control for Autonomous Agents. Kill Switch, Trust Passport, Injection Shield, and Governance Engine for production AI systems.">
  <meta property="og:url" content="https://labyrinthscout.com">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Labyrinth Scout - Observe. Verify. Control.">
  <meta name="twitter:description" content="Autonomous agents are powerful. Who is in control? Scout monitors, governs, and intervenes when AI systems go wrong.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/assets/pwa/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/pwa/favicon.ico" sizes="any">
  <link rel="icon" href="/assets/pwa/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/pwa/apple-touch-icon.png">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           #06090f;
      --bg-lift:      #0b0e17;
      --bg-card:      #0f1420;
      --border:       rgba(255,255,255,0.06);
      --border-mid:   rgba(255,255,255,0.10);
      --red:          #e63946;
      --red-dim:      rgba(230,57,70,0.10);
      --red-glow:     rgba(230,57,70,0.20);
      --amber-warn:   #f59e0b;
      --green-safe:   #22c55e;
      --cyber:        #22d3ee;
      --text-primary: #f0f4f8;
      --text-mid:     #7a8fa6;
      --text-dim:     #3d5060;
      --ff-sans:      'Inter', system-ui, sans-serif;
      --r:            6px;
      --r-md:         10px;
      --r-lg:         16px;
      --transition:   200ms cubic-bezier(0.4,0,0.2,1);
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--ff-sans);
      background: var(--bg);
      color: var(--text-primary);
      line-height: 1.65;
      overflow-x: hidden;
      font-weight: 400;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(230,57,70,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(230,57,70,0.02) 1px, transparent 1px);
      background-size: 72px 72px;
      pointer-events: none;
      z-index: 0;
    }

    .z1 { position: relative; z-index: 1; }

    .container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    /* --- NAV --- */
    nav {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 200;
      height: 60px;
      background: rgba(6,9,15,0.88);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      transition: border-color var(--transition);
    }

    .nav-inner {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }

    .nav-logo {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      letter-spacing: -0.01em;
    }

    .nav-logo span { color: var(--red); }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.75rem;
    }

    .nav-links a {
      color: var(--text-mid);
      font-size: 0.8125rem;
      font-weight: 400;
      text-decoration: none;
      transition: color var(--transition);
    }

    .nav-links a:hover { color: var(--text-primary); }

    .nav-cta {
      background: var(--red);
      color: #fff;
      padding: 0.4rem 1rem;
      border-radius: var(--r);
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      transition: opacity var(--transition);
    }

    .nav-cta:hover { opacity: 0.85; color: #fff; }

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
    }

    @media (max-width: 768px) {
      .nav-links { display: none; }
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
      background: var(--red);
      color: #fff;
      font-weight: 600;
      padding: 0.75rem;
      border-radius: var(--r-md);
      margin-top: 1rem;
      border-bottom: none !important;
    }

    /* --- HERO --- */
    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding: 7rem 0 5rem;
      position: relative;
      z-index: 1;
    }

    .hero-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }

    @media (max-width: 768px) {
      .hero-grid { grid-template-columns: 1fr; gap: 2.5rem; }
      .hero-visual { order: -1; }
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.7rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--red);
      font-weight: 600;
      margin-bottom: 1.75rem;
      padding: 0.35rem 0.85rem;
      border: 1px solid rgba(230,57,70,0.3);
      border-radius: 999px;
      background: rgba(230,57,70,0.06);
    }

    .hero-h1 {
      font-size: clamp(2.2rem, 5vw, 3.6rem);
      font-weight: 700;
      line-height: 1.06;
      letter-spacing: -0.03em;
      margin-bottom: 1.5rem;
      color: var(--text-primary);
    }

    .hero-h1 .accent { color: var(--red); }

    .hero-tagline {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-mid);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }

    .hero-tagline span {
      display: inline-block;
      padding: 0 0.6rem;
      color: var(--text-dim);
    }

    .hero-sub {
      font-size: 1rem;
      color: var(--text-mid);
      max-width: 480px;
      line-height: 1.7;
      margin-bottom: 2.5rem;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 2rem;
    }

    .btn-primary-red {
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

    .btn-primary-red:hover { opacity: 0.88; transform: translateY(-1px); color: #fff; }

    .btn-secondary-ghost {
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

    .btn-secondary-ghost:hover { color: var(--text-primary); border-color: var(--red); }

    .hero-callouts {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .hero-callout {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.35rem 0.75rem;
      border-radius: var(--r);
      background: var(--bg-lift);
      border: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-mid);
      font-weight: 500;
    }

    .hero-callout i { color: var(--red); font-size: 0.85rem; }

    /* RADAR (keep existing radar CSS from app.js animations) */
    .hero-visual {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .radar-scene {
      position: relative;
      width: 400px;
      height: 400px;
      max-width: 90vw;
      max-height: 90vw;
    }

    .radar-core {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .radar-sweep {
      position: absolute;
      inset: 0;
      animation: radar-rotate 4s linear infinite;
    }

    .radar-beam {
      position: absolute;
      top: 50%; left: 50%;
      width: 50%; height: 2px;
      transform-origin: left center;
      background: linear-gradient(to right, transparent, rgba(230,57,70,0.8));
    }

    @keyframes radar-rotate { to { transform: rotate(360deg); } }

    .radar-ring {
      position: absolute;
      border-radius: 50%;
      border: 1px solid;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      animation: radar-pulse calc(var(--n, 1) * 0.4s + 1.6s) ease-in-out infinite alternate;
    }

    @keyframes radar-pulse {
      from { opacity: 0.6; }
      to   { opacity: 0.9; }
    }

    .radar-agents {
      position: absolute;
      inset: 0;
    }

    .radar-agent {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(calc(var(--rx, 0px) - 50%), calc(var(--ry, 0px) - 50%));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      animation: agent-appear 0.6s ease calc(var(--d, 0ms)) backwards;
    }

    @keyframes agent-appear {
      from { opacity: 0; transform: translate(calc(var(--rx, 0px) - 50%), calc(var(--ry, 0px) - 50%)) scale(0.5); }
      to   { opacity: 1; transform: translate(calc(var(--rx, 0px) - 50%), calc(var(--ry, 0px) - 50%)) scale(1); }
    }

    .radar-agent-icon {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 1px solid rgba(230,57,70,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      color: var(--cyber);
    }

    .radar-agent--featured .radar-agent-icon {
      border-color: rgba(230,57,70,0.7);
      color: var(--red);
      background: rgba(230,57,70,0.08);
    }

    .radar-agent-name {
      font-size: 0.65rem;
      color: var(--text-dim);
      letter-spacing: 0.05em;
    }

    .radar-floor {
      position: absolute;
      bottom: -20px; left: 10%;
      width: 80%; height: 20px;
      background: radial-gradient(ellipse at center, rgba(230,57,70,0.12) 0%, transparent 70%);
    }
  </style>
</head>
```

---

## BODY START, CANVAS, AND NAV

```html
<body>

<canvas id="bg-canvas" aria-hidden="true" style="position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0.3;"></canvas>

<nav id="main-nav">
  <div class="nav-inner">
    <a href="/" class="nav-logo">Labyrinth<span>Scout</span></a>
    <div class="nav-links">
      <a href="#kill-switch">Kill Switch</a>
      <a href="#trust-passport">Trust Passport</a>
      <a href="#governance">Governance</a>
      <a href="#pricing">Pricing</a>
      <a href="/docs/">Docs</a>
      <a href="https://carinaai.uk">Carina</a>
      <a href="https://core.carinaai.uk/checkout?plan=scout_pro" class="nav-cta">Start Monitoring</a>
    </div>
    <button class="nav-hamburger" id="nav-hamburger" aria-label="Open menu" aria-expanded="false" type="button">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div class="nav-mobile-panel" id="nav-mobile-panel" aria-hidden="true">
  <a href="#kill-switch">Kill Switch</a>
  <a href="#trust-passport">Trust Passport</a>
  <a href="#governance">Governance</a>
  <a href="#pricing">Pricing</a>
  <a href="/docs/">Docs</a>
  <a href="https://carinaai.uk">Carina</a>
  <a href="https://core.carinaai.uk/checkout?plan=scout_pro" class="nav-mobile-cta">Start Monitoring</a>
</div>
```

---

## HERO SECTION HTML

```html
<!-- SECTION 1: HERO -->
<section class="hero z1">
  <div class="container">
    <div class="hero-grid">
      <div class="hero-text">
        <div class="hero-badge">
          <i class="ti ti-shield-bolt"></i>
          Mission Control for Autonomous Agents
        </div>
        <h1 class="hero-h1">
          Autonomous agents<br>are powerful.<br>
          <span class="accent">Who's in control?</span>
        </h1>
        <div class="hero-tagline">
          Observe<span>·</span>Verify<span>·</span>Control
        </div>
        <p class="hero-sub">
          Scout monitors, governs, and intervenes when AI systems drift beyond
          policy, trust, or safety boundaries.
        </p>
        <div class="hero-actions">
          <a href="https://core.carinaai.uk/checkout?plan=scout_pro" class="btn-primary-red">
            <i class="ti ti-radar"></i>
            Start Monitoring
          </a>
          <a href="/docs/" class="btn-secondary-ghost">
            <i class="ti ti-book"></i>
            Read docs
          </a>
        </div>
        <div class="hero-callouts">
          <div class="hero-callout"><i class="ti ti-power"></i> Kill Switch</div>
          <div class="hero-callout"><i class="ti ti-id-badge"></i> Trust Passport</div>
          <div class="hero-callout"><i class="ti ti-shield-check"></i> Injection Shield</div>
        </div>
      </div>

      <!-- Radar visual -->
      <div class="hero-visual" aria-hidden="true">
        <div class="radar-scene">
          <div class="radar-core">
            <div class="radar-sweep"><div class="radar-beam"></div></div>
            <div class="radar-ring" style="width:5rem;height:5rem;border-color:rgba(230,57,70,0.90);--n:1"></div>
            <div class="radar-ring" style="width:10rem;height:10rem;border-color:rgba(230,57,70,0.75);--n:2"></div>
            <div class="radar-ring" style="width:15rem;height:15rem;border-color:rgba(230,57,70,0.55);--n:3"></div>
            <div class="radar-ring" style="width:20rem;height:20rem;border-color:rgba(230,57,70,0.40);--n:4"></div>
            <div class="radar-ring" style="width:25rem;height:25rem;border-color:rgba(230,57,70,0.25);--n:5"></div>
          </div>
          <div class="radar-agents">
            <div class="radar-agent radar-agent--featured" style="--d:200ms;--rx:0px;--ry:-62px">
              <div class="radar-agent-icon"><i class="ti ti-sparkles"></i></div>
              <span class="radar-agent-name">Carina</span>
            </div>
            <div class="radar-agent" style="--d:650ms;--rx:86px;--ry:-112px">
              <div class="radar-agent-icon"><i class="ti ti-code"></i></div>
              <span class="radar-agent-name">Your agent</span>
            </div>
            <div class="radar-agent" style="--d:300ms;--rx:-88px;--ry:-162px">
              <div class="radar-agent-icon"><i class="ti ti-messages"></i></div>
              <span class="radar-agent-name">Hermes</span>
            </div>
            <div class="radar-agent" style="--d:500ms;--rx:90px;--ry:-208px">
              <div class="radar-agent-icon"><i class="ti ti-robot"></i></div>
              <span class="radar-agent-name">AutoGPT</span>
            </div>
            <div class="radar-agent" style="--d:400ms;--rx:-60px;--ry:-252px">
              <div class="radar-agent-icon"><i class="ti ti-compass"></i></div>
              <span class="radar-agent-name">Odysseus</span>
            </div>
          </div>
          <div class="radar-floor"></div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Notes

1. The hero badge now leads with "Mission Control for Autonomous Agents" - the approved sub-position - rather than "Autonomous Agent Governance." This is the first visible text a visitor reads after the nav logo.

2. "Observe. Verify. Control." appears as the `hero-tagline` element between the h1 and the subheadline. It is styled in uppercase with separator dots. This placement means it is the third thing a visitor reads: category name, main fear hook, then the commitment tagline.

3. The Radar visual is preserved exactly as it was. It is one of Scout's real visual assets and it already exists in the product. Keep it.

4. The canvas element for particle background is kept from the original. `app.js` handles it. Opacity is set to 0.3 via inline style to keep it subtle under the new red grid.
