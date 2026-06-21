# Prompt 02 - Moat (Learning Loop) and Channels Sections

## Target file

`/opt/lampp/htdocs/verlox/carina/carinaai.uk/index.html`

## What this prompt adds

Two new sections immediately after the hero: the Learning Loop (the moat) and the Channels (one memory). These replace whatever currently follows the hero. Delete any section that is currently between the hero and the first major feature block and replace with the two sections below.

---

## CSS to add

Add the following inside the existing `<style>` block in `<head>`, or in a new `<style>` tag before `</head>`:

```css
/* --- SHARED SECTION STYLES --- */
.section {
  padding: 7rem 0;
  position: relative;
  z-index: 1;
}

.section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--green);
  font-weight: 500;
  margin-bottom: 1.25rem;
}

.section-h2 {
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.12;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.section-h2 em {
  font-style: normal;
  color: var(--green);
}

.section-sub {
  font-size: 1rem;
  color: var(--text-mid);
  max-width: 540px;
  line-height: 1.7;
  margin-bottom: 3rem;
}

.section-dark { background: var(--bg); }
.section-lift  { background: var(--bg-lift); }

/* --- MOAT SECTION --- */
.moat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .moat-grid { grid-template-columns: 1fr; gap: 2.5rem; }
}

.moat-content {}

.moat-callouts {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2.5rem;
}

.moat-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem 1.25rem;
  border-radius: var(--r-md);
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.moat-callout-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--r);
  background: var(--green-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.moat-callout-icon i {
  color: var(--green);
  font-size: 1rem;
}

.moat-callout-text h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.2rem;
}

.moat-callout-text p {
  font-size: 0.8rem;
  color: var(--text-mid);
  line-height: 1.5;
}

.moat-visual {
  border-radius: var(--r-lg);
  border: 1px solid var(--border-mid);
  overflow: hidden;
  background: var(--bg-card);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}

.visual-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: var(--bg-lift);
  border-bottom: 1px solid var(--border);
}

.visual-bar-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
}
.vbd-r { background: #ff5f57; }
.vbd-y { background: #febc2e; }
.vbd-g { background: #28c840; }

.visual-bar-title {
  margin-left: 0.4rem;
  font-size: 0.7rem;
  color: var(--text-dim);
  letter-spacing: 0.04em;
}

.visual-placeholder {
  width: 100%;
  aspect-ratio: 16/10;
  background: linear-gradient(135deg, var(--bg-lift) 0%, #0f1824 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.moat-stats-row {
  display: flex;
  gap: 1.5rem;
  margin-top: 2rem;
  flex-wrap: wrap;
}

.moat-stat {
  padding: 0.85rem 1.25rem;
  border-radius: var(--r-md);
  background: var(--green-dim);
  border: 1px solid rgba(22,201,126,0.2);
  text-align: center;
}

.moat-stat-number {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--green);
  line-height: 1;
  margin-bottom: 0.25rem;
}

.moat-stat-label {
  font-size: 0.72rem;
  color: var(--text-mid);
  letter-spacing: 0.04em;
}

/* --- CHANNELS SECTION --- */
.channels-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .channels-grid { grid-template-columns: 1fr; gap: 2.5rem; }
  .channels-grid .channels-visual { order: -1; }
}

.channels-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  margin-top: 2rem;
}

.channel-chip {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  border-radius: var(--r);
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--text-mid);
  transition: border-color var(--transition), color var(--transition);
}

.channel-chip:hover {
  border-color: var(--green);
  color: var(--text-primary);
}

.channel-chip i { color: var(--green); font-size: 0.9rem; }

.channels-key-message {
  margin-top: 2.5rem;
  padding: 1.25rem 1.5rem;
  border-left: 3px solid var(--green);
  background: var(--green-dim);
  border-radius: 0 var(--r-md) var(--r-md) 0;
}

.channels-key-message p {
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 500;
  line-height: 1.5;
}

.channels-key-message span {
  font-size: 0.82rem;
  color: var(--text-mid);
  display: block;
  margin-top: 0.35rem;
}
```

---

## MOAT SECTION HTML

Insert this immediately after the closing `</section>` tag of the hero:

```html
<!-- SECTION 2: THE MOAT - Learning Loop -->
<section id="moat" class="section section-lift">
  <div class="container">
    <div class="moat-grid">
      <div class="moat-content">
        <div class="section-eyebrow">
          <i class="ti ti-trending-up"></i>
          The Differentiator
        </div>
        <h2 class="section-h2">
          Skills That<br><em>Compound.</em>
        </h2>
        <p class="section-sub">
          Most AI answers questions and forgets the conversation. Carina converts every
          complex task into reusable experience. The longer you use it, the better it gets.
        </p>

        <div class="moat-callouts">
          <div class="moat-callout">
            <div class="moat-callout-icon"><i class="ti ti-brain"></i></div>
            <div class="moat-callout-text">
              <h4>Every task becomes experience</h4>
              <p>Completed workflows are analysed and distilled into compact skill entries automatically.</p>
            </div>
          </div>
          <div class="moat-callout">
            <div class="moat-callout-icon"><i class="ti ti-puzzle"></i></div>
            <div class="moat-callout-text">
              <h4>Every experience becomes a skill</h4>
              <p>Skills are tagged, versioned, and stored in a searchable skill library shared across all agents.</p>
            </div>
          </div>
          <div class="moat-callout">
            <div class="moat-callout-icon"><i class="ti ti-repeat"></i></div>
            <div class="moat-callout-text">
              <h4>Every skill improves every agent</h4>
              <p>New sessions start with access to all prior skills. Most AI answers questions. Carina gets better.</p>
            </div>
          </div>
        </div>

        <div class="moat-stats-row">
          <div class="moat-stat">
            <div class="moat-stat-number">2,481</div>
            <div class="moat-stat-label">Skills Generated</div>
          </div>
          <div class="moat-stat">
            <div class="moat-stat-number">7-Day</div>
            <div class="moat-stat-label">Curator Active</div>
          </div>
          <div class="moat-stat">
            <div class="moat-stat-number">Cross-Agent</div>
            <div class="moat-stat-label">Skill Sharing</div>
          </div>
        </div>
      </div>

      <div class="moat-visual">
        <div class="visual-bar">
          <span class="visual-bar-dot vbd-r"></span>
          <span class="visual-bar-dot vbd-y"></span>
          <span class="visual-bar-dot vbd-g"></span>
          <span class="visual-bar-title">learning-loop</span>
        </div>
        <!-- Replace with real learning-demo.gif when available -->
        <div class="visual-placeholder">learning-demo.gif</div>
      </div>
    </div>
  </div>
</section>
```

---

## CHANNELS SECTION HTML

Insert this immediately after the moat section:

```html
<!-- SECTION 3: ONE MEMORY -->
<section id="channels" class="section section-dark">
  <div class="container">
    <div class="channels-grid">
      <div class="channels-visual">
        <div class="moat-visual">
          <div class="visual-bar">
            <span class="visual-bar-dot vbd-r"></span>
            <span class="visual-bar-dot vbd-y"></span>
            <span class="visual-bar-dot vbd-g"></span>
            <span class="visual-bar-title">channels</span>
          </div>
          <!-- Replace with real channels-demo.gif when available -->
          <div class="visual-placeholder">channels-demo.gif</div>
        </div>
      </div>

      <div class="channels-content">
        <div class="section-eyebrow">
          <i class="ti ti-topology-star"></i>
          One Memory
        </div>
        <h2 class="section-h2">
          One Agent.<br>One Memory.<br><em>Everywhere.</em>
        </h2>
        <p class="section-sub">
          40+ channels. The same Carina. The same memory. The same skills.
          The same intelligence. You don't switch agents. Carina follows you.
        </p>

        <div class="channels-list">
          <div class="channel-chip"><i class="ti ti-brand-telegram"></i> Telegram</div>
          <div class="channel-chip"><i class="ti ti-brand-whatsapp"></i> WhatsApp</div>
          <div class="channel-chip"><i class="ti ti-brand-discord"></i> Discord</div>
          <div class="channel-chip"><i class="ti ti-brand-slack"></i> Slack</div>
          <div class="channel-chip"><i class="ti ti-brand-teams"></i> Teams</div>
          <div class="channel-chip"><i class="ti ti-mail"></i> Email</div>
          <div class="channel-chip"><i class="ti ti-brand-signal"></i> Signal</div>
          <div class="channel-chip"><i class="ti ti-terminal"></i> CLI</div>
          <div class="channel-chip"><i class="ti ti-api"></i> REST API</div>
        </div>

        <div class="channels-key-message">
          <p>One memory shared across all 40+ channels.</p>
          <span>Same skills. Same context. Wherever you work.</span>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Notes

1. Replace `visual-placeholder` divs with real `<img>` or `<video>` tags as soon as the demo assets are confirmed at their real paths.

2. The channel list shows 9 of the 40+. That is intentional - showing all 40 names would lose impact. The "40+ channels" stat carries the message.

3. The moat section uses `section-lift` background to alternate from the hero's dark. Channels uses `section-dark` to alternate again. This alternating rhythm continues through Prompts 03-05.
