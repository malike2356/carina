## Prompt 9: Landing Page Redesign - carinaai.uk (Show, Don't Tell)

### Context

carinaai.uk/index.html is a text-heavy spec-list page. The goal is to show features visually with feature blocks, animated GIF placeholders, and a stats bar.

Files to edit: carinaai.uk/index.html and carinaai.uk/style.css (create style.css if it does not exist).

### Tasks

#### 1. Replace the hero section in carinaai.uk/index.html

```html
<section class="hero">
  <div class="hero-inner">
    <p class="eyebrow">Open-source AI agent platform</p>
    <h1>The AI agent built for<br>builders who ship.</h1>
    <p class="subtitle">Security. Billing. 40+ channels. 71 tools. Local models. One MIT-licensed platform.</p>
    <div class="cta-row">
      <a href="https://github.com/verlox/carina-agent" class="btn-primary">Get started free</a>
      <a href="/docs" class="btn-secondary">Documentation</a>
    </div>
  </div>
</section>
```

#### 2. Add stats bar after hero

```html
<section class="stats-bar">
  <div class="stats-inner">
    <div class="stat"><span class="stat-num">71</span><span class="stat-label">Tools</span></div>
    <div class="stat"><span class="stat-num">40+</span><span class="stat-label">Channels</span></div>
    <div class="stat"><span class="stat-num">23</span><span class="stat-label">LLM Providers</span></div>
    <div class="stat"><span class="stat-num">18</span><span class="stat-label">Skill Packs</span></div>
    <div class="stat"><span class="stat-num">MIT</span><span class="stat-label">License</span></div>
  </div>
</section>
```

#### 3. Add feature showcase section

Five feature blocks alternating left/right:

```html
<section class="features">
  <div class="features-inner">

    <div class="feature-block">
      <div class="feature-media">
        <img src="/img/cookbook-demo.gif" alt="Carina Cookbook: hardware detection and one-click model serve"
          onerror="this.parentNode.innerHTML='<div class=feature-placeholder>Cookbook: hardware-aware model serving</div>'">
      </div>
      <div class="feature-copy">
        <span class="feature-tag">Cookbook</span>
        <h2>Local models. Hardware-aware.</h2>
        <p>Carina detects your GPU, estimates VRAM, and recommends which models fit. One click to pull and serve via Ollama. No guesswork.</p>
      </div>
    </div>

    <div class="feature-block reverse">
      <div class="feature-media">
        <img src="/img/security-demo.gif" alt="Scout injection shield in action"
          onerror="this.parentNode.innerHTML='<div class=feature-placeholder>Scout: enterprise security</div>'">
      </div>
      <div class="feature-copy">
        <span class="feature-tag">Labyrinth Scout</span>
        <h2>Enterprise security no one else has.</h2>
        <p>3-layer injection shield. Egress filtering. Kill switch. Blockchain trust receipts on Base. The only agent platform you can put in front of a security review.</p>
      </div>
    </div>

    <div class="feature-block">
      <div class="feature-media">
        <img src="/img/workspace-demo.gif" alt="Carina workspace: notes, calendar, documents, images"
          onerror="this.parentNode.innerHTML='<div class=feature-placeholder>Workspace: full productivity suite</div>'">
      </div>
      <div class="feature-copy">
        <span class="feature-tag">Workspace</span>
        <h2>A full workspace, not just a chatbox.</h2>
        <p>Notes, calendar, documents, image studio, email triage, kanban, deep research, model compare. All in one workspace that runs anywhere.</p>
      </div>
    </div>

    <div class="feature-block reverse">
      <div class="feature-media">
        <img src="/img/channels-demo.gif" alt="Carina responding on Telegram, Discord, WhatsApp, Slack"
          onerror="this.parentNode.innerHTML='<div class=feature-placeholder>Channels: 40+ messaging platforms</div>'">
      </div>
      <div class="feature-copy">
        <span class="feature-tag">40+ Channels</span>
        <h2>One agent, everywhere you are.</h2>
        <p>Telegram, Discord, WhatsApp, Slack, Signal, Matrix, Teams, and 32 more. The same Carina with the same memory and skills on every platform.</p>
      </div>
    </div>

    <div class="feature-block">
      <div class="feature-media">
        <img src="/img/learning-demo.gif" alt="Carina skill curator consolidating and promoting skills"
          onerror="this.parentNode.innerHTML='<div class=feature-placeholder>Learning loop: skills that compound</div>'">
      </div>
      <div class="feature-copy">
        <span class="feature-tag">Learning Loop</span>
        <h2>Skills that compound over time.</h2>
        <p>Carina writes new skills after every complex task, runs a 7-day curator cycle to consolidate and prune, and propagates the best skills across all your agents.</p>
      </div>
    </div>

  </div>
</section>
```

#### 4. Add CSS to carinaai.uk/style.css

```css
:root { --bg: #0d0d0f; --surface: #1a1a22; --text: #e4e4e9; --muted: #575768; --accent: #19c49a; --border: rgba(255,255,255,0.07); --accent-dim: rgba(25,196,154,0.12); }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; }

.hero { min-height: 70vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 4rem 1.5rem; }
.hero-inner { max-width: 680px; }
.eyebrow { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 1rem; font-weight: 600; }
h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 700; line-height: 1.15; margin-bottom: 1.25rem; }
.subtitle { font-size: 1.05rem; color: var(--muted); margin-bottom: 2rem; line-height: 1.65; }
.cta-row { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
.btn-primary { background: var(--accent); color: #0d0d0f; padding: 0.75rem 1.75rem; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 0.95rem; }
.btn-primary:hover { opacity: 0.88; }
.btn-secondary { background: var(--surface); color: var(--text); padding: 0.75rem 1.75rem; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 0.95rem; border: 1px solid var(--border); }

.stats-bar { padding: 2rem 1.5rem; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.stats-inner { max-width: 900px; margin: 0 auto; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1.5rem; }
.stat { text-align: center; }
.stat-num { display: block; font-size: 2rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

.features { padding: 4rem 1.5rem; }
.features-inner { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 5rem; }
.feature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
.feature-block.reverse .feature-media { order: 2; }
.feature-block.reverse .feature-copy { order: 1; }
.feature-media { border-radius: 14px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); min-height: 240px; display: flex; align-items: center; justify-content: center; }
.feature-media img { width: 100%; height: auto; display: block; }
.feature-placeholder { padding: 2rem; font-size: 0.85rem; color: var(--muted); text-align: center; }
.feature-tag { display: inline-block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--accent); background: var(--accent-dim); padding: 0.2rem 0.55rem; border-radius: 5px; margin-bottom: 0.75rem; }
.feature-copy h2 { font-size: 1.6rem; line-height: 1.25; margin-bottom: 0.75rem; }
.feature-copy p { color: var(--muted); line-height: 1.65; font-size: 0.95rem; }
@media (max-width: 700px) {
  .feature-block { grid-template-columns: 1fr; }
  .feature-block.reverse .feature-media { order: 0; }
  .feature-block.reverse .feature-copy { order: 0; }
  .feature-block { gap: 1.5rem; }
}
```

#### 5. Link style.css from index.html

In the <head> of carinaai.uk/index.html, ensure:
```html
<link rel="stylesheet" href="/style.css">
```

#### 6. GIF placeholders

GIFs do not exist yet. The onerror handlers display styled placeholder text. Record and add GIFs as a follow-up task:
- img/cookbook-demo.gif - screen recording of /cookbook with hardware detection and model pull
- img/security-demo.gif - Scout dashboard showing an injection block
- img/workspace-demo.gif - workspace hub navigation
- img/channels-demo.gif - Carina responding across multiple platforms
- img/learning-demo.gif - curator report showing skills consolidated and pruned

### Verification

- Open carinaai.uk/index.html in browser
- Hero shows tagline and two CTA buttons
- Stats bar shows 5 metrics
- 5 feature blocks alternate left and right
- GIF placeholders show styled boxes with text (onerror working)
- Responsive: on 480px wide, feature blocks stack vertically
- No JS errors in console
