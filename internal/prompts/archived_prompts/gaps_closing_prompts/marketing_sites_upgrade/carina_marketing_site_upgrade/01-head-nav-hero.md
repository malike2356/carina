# Prompt 01 - Head, Nav, and Hero Section

## Target file

`/opt/lampp/htdocs/verlox/carina/carinaai.uk/index.html`

## What this prompt replaces

The entire `<head>` block, `<nav>` block, and the first visible `<section>` (hero). Replace all three with the versions below. Keep everything after the hero section intact for now - Prompts 02-05 handle those sections.

---

## HEAD

Replace the current `<head>` block completely with:

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#06090f">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="application-name" content="Carina">
  <meta name="apple-mobile-web-app-title" content="Carina">
  <title>Carina - One Memory. One Agent. Everywhere.</title>
  <meta name="description" content="Carina connects your conversations, documents, tools, models and workflows into one persistent intelligence layer that remembers, learns and compounds over time. MIT licensed. Self-host from npm.">
  <meta property="og:title" content="Carina - One Memory. One Agent. Everywhere.">
  <meta property="og:description" content="The Operating System for Knowledge Work. 71 tools, 40+ channels, 23 LLM providers, compounding skill memory. Free and MIT licensed.">
  <meta property="og:url" content="https://carinaai.uk">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Carina - One Memory. One Agent. Everywhere.">
  <meta name="twitter:description" content="Your work lives in 20 apps. Your intelligence shouldn't. Self-host from npm. MIT licensed.">
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
      --bg-lift:      #0c1118;
      --bg-card:      #111722;
      --border:       rgba(255,255,255,0.07);
      --border-mid:   rgba(255,255,255,0.12);
      --green:        #16c97e;
      --green-dim:    rgba(22,201,126,0.12);
      --green-glow:   rgba(22,201,126,0.20);
      --text-primary: #f0f4f8;
      --text-mid:     #8a9bb0;
      --text-dim:     #4d6070;
      --amber:        #f5a623;
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
        linear-gradient(rgba(22,201,126,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(22,201,126,0.025) 1px, transparent 1px);
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
      background: rgba(6,9,15,0.85);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
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
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      text-decoration: none;
      letter-spacing: -0.01em;
    }

    .nav-logo span { color: var(--green); }

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
      background: var(--green);
      color: #06090f;
      padding: 0.4rem 1rem;
      border-radius: var(--r);
      font-size: 0.8125rem;
      font-weight: 600;
      text-decoration: none;
      transition: opacity var(--transition);
    }

    .nav-cta:hover { opacity: 0.88; color: #06090f; }

    @media (max-width: 768px) {
      .nav-links { display: none; }
    }

    /* --- HERO --- */
    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 7rem 0 5rem;
      position: relative;
      z-index: 1;
    }

    .hero-inner {
      max-width: 760px;
    }

    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--green);
      font-weight: 500;
      margin-bottom: 2rem;
      padding: 0.35rem 0.85rem;
      border: 1px solid rgba(22,201,126,0.25);
      border-radius: 999px;
      background: rgba(22,201,126,0.06);
    }

    .hero-eyebrow i { font-size: 0.85rem; }

    .hero-h1 {
      font-size: clamp(2.4rem, 5.5vw, 4rem);
      font-weight: 700;
      line-height: 1.08;
      letter-spacing: -0.03em;
      margin-bottom: 1.5rem;
      color: var(--text-primary);
    }

    .hero-h1 em {
      font-style: normal;
      color: var(--green);
    }

    .hero-sub {
      font-size: 1.05rem;
      color: var(--text-mid);
      max-width: 580px;
      line-height: 1.7;
      margin-bottom: 2.5rem;
      font-weight: 400;
    }

    .hero-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

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

    .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

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

    .hero-visual {
      margin-top: 4rem;
      border-radius: var(--r-lg);
      border: 1px solid var(--border-mid);
      overflow: hidden;
      background: var(--bg-card);
      box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px var(--border);
    }

    .hero-visual-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--bg-lift);
      border-bottom: 1px solid var(--border);
    }

    .vbar-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
    }
    .vbar-dot-r { background: #ff5f57; }
    .vbar-dot-y { background: #febc2e; }
    .vbar-dot-g { background: #28c840; }

    .vbar-title {
      margin-left: 0.5rem;
      font-size: 0.72rem;
      color: var(--text-dim);
      letter-spacing: 0.04em;
    }

    .hero-visual img, .hero-visual video {
      width: 100%;
      display: block;
    }

    .hero-visual-placeholder {
      width: 100%;
      aspect-ratio: 16/9;
      background: linear-gradient(135deg, var(--bg-lift) 0%, var(--bg-card) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      font-size: 0.85rem;
      letter-spacing: 0.05em;
    }
  </style>
</head>
```

---

## NAV

Replace the current `<nav>` element with:

```html
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">Carina<span>.</span></a>
    <div class="nav-links">
      <a href="#moat">Why Carina</a>
      <a href="#channels">Channels</a>
      <a href="#workspace">Workspace</a>
      <a href="https://labyrinthscout.com">Scout</a>
      <a href="/pricing/">Pricing</a>
      <a href="/docs/">Docs</a>
      <a href="https://github.com/VERLOX-UK/carina-agent" target="_blank" rel="noopener">GitHub</a>
      <a href="/docs/getting-started/" class="nav-cta">Get Started Free</a>
    </div>
  </div>
</nav>
```

---

## HERO SECTION

Replace the current first `<section>` (hero) with:

```html
<section class="hero z1">
  <div class="container">
    <div class="hero-inner">
      <div class="hero-eyebrow">
        <i class="ti ti-sparkles"></i>
        The Operating System for Knowledge Work
      </div>
      <h1 class="hero-h1">
        Your work lives<br>in 20 apps.<br>
        <em>Your intelligence shouldn't.</em>
      </h1>
      <p class="hero-sub">
        Carina connects your conversations, documents, tools, models and workflows
        into one persistent intelligence layer that remembers, learns and compounds
        over time.
      </p>
      <div class="hero-actions">
        <a href="/docs/getting-started/" class="btn-primary">
          <i class="ti ti-rocket"></i>
          Get Started Free
        </a>
        <a href="/docs/" class="btn-secondary">
          <i class="ti ti-book"></i>
          View Documentation
        </a>
      </div>
    </div>

    <div class="hero-visual">
      <div class="hero-visual-bar">
        <span class="vbar-dot vbar-dot-r"></span>
        <span class="vbar-dot vbar-dot-y"></span>
        <span class="vbar-dot vbar-dot-g"></span>
        <span class="vbar-title">carina-workspace</span>
      </div>
      <!-- Replace the src with the real workspace-demo.gif once available -->
      <div class="hero-visual-placeholder">
        workspace-demo.gif
      </div>
    </div>
  </div>
</section>
```

---

## Notes

1. The `hero-visual-placeholder` div is a temporary stand-in. Replace it with `<img src="/assets/demos/workspace-demo.gif" alt="Carina workspace demo">` once the GIF is available. If the GIF already exists at `/assets/demos/` or similar path, use it immediately.

2. The `<style>` block in the `<head>` covers nav, hero, and shared tokens. Subsequent sections in Prompts 02-05 will append additional `<style>` blocks or extend this one via a separate inline style tag before the closing `</head>` - either approach works.

3. Do not change anything after the hero section when applying this prompt.
