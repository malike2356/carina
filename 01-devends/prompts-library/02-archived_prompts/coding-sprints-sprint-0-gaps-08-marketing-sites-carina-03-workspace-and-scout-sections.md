# Prompt 03 - Workspace Section and Scout Cross-sell Section

## Target file

`/opt/lampp/htdocs/verlox/carina/carinaai.uk/index.html`

## What this prompt adds

Sections 4 and 5: the Workspace section ("A Full Workspace. Not Another Chat Window.") and the Scout cross-sell section ("Intelligence Without Control Is A Liability."). Insert both after the channels section from Prompt 02.

---

## CSS to add

Add inside the existing `<style>` block or in a new `<style>` tag:

```css
/* --- WORKSPACE SECTION --- */
.workspace-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .workspace-grid { grid-template-columns: 1fr; gap: 2.5rem; }
}

.workspace-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  margin-top: 2rem;
}

.ws-feature {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.85rem;
  border-radius: var(--r);
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--text-mid);
}

.ws-feature i {
  color: var(--green);
  font-size: 0.9rem;
  flex-shrink: 0;
}

.cookbook-note {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  border-radius: var(--r-md);
  background: var(--bg-card);
  border: 1px solid var(--border);
  font-size: 0.82rem;
  color: var(--text-mid);
  line-height: 1.6;
}

.cookbook-note strong { color: var(--green); }

/* --- SCOUT CROSS-SELL SECTION --- */
.scout-section {
  background: var(--bg-lift);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.scout-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .scout-grid { grid-template-columns: 1fr; gap: 2.5rem; }
}

.scout-capabilities {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-top: 2rem;
}

.scout-cap {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1.1rem;
  border-radius: var(--r-md);
  background: rgba(255,60,60,0.04);
  border: 1px solid rgba(255,60,60,0.12);
}

.scout-cap-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--r);
  background: rgba(255,60,60,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.scout-cap-icon i {
  color: #f87171;
  font-size: 0.95rem;
}

.scout-cap span {
  font-size: 0.85rem;
  color: var(--text-mid);
  font-weight: 400;
}

.scout-kill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.85rem;
  background: rgba(255,60,60,0.1);
  border: 1px solid rgba(255,60,60,0.25);
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #f87171;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.scout-kill-badge i { font-size: 0.9rem; }

.scout-cta-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 2.5rem;
  flex-wrap: wrap;
}

.btn-scout {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: #f87171;
  padding: 0.7rem 1.4rem;
  border-radius: var(--r-md);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid rgba(255,60,60,0.3);
  transition: background var(--transition), border-color var(--transition);
}

.btn-scout:hover {
  background: rgba(255,60,60,0.06);
  border-color: rgba(255,60,60,0.5);
}

.scout-visual {
  border-radius: var(--r-lg);
  overflow: hidden;
  border: 1px solid rgba(255,60,60,0.15);
  background: var(--bg-card);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}

.scout-visual-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: rgba(255,60,60,0.05);
  border-bottom: 1px solid rgba(255,60,60,0.15);
}

.scout-visual-bar-title {
  margin-left: 0.4rem;
  font-size: 0.7rem;
  color: #f87171;
  letter-spacing: 0.04em;
  opacity: 0.7;
}
```

---

## WORKSPACE SECTION HTML

Insert after the channels section (Prompt 02):

```html
<!-- SECTION 4: WORKSPACE -->
<section id="workspace" class="section section-lift">
  <div class="container">
    <div class="workspace-grid">
      <div class="workspace-content">
        <div class="section-eyebrow">
          <i class="ti ti-layout-dashboard"></i>
          Full Workspace
        </div>
        <h2 class="section-h2">
          A Full Workspace.<br>
          <em>Not Another Chat Window.</em>
        </h2>
        <p class="section-sub">
          Everything connected. Everything searchable. Everything remembered.
        </p>

        <div class="workspace-features">
          <div class="ws-feature"><i class="ti ti-notes"></i> Notes</div>
          <div class="ws-feature"><i class="ti ti-calendar"></i> Calendar</div>
          <div class="ws-feature"><i class="ti ti-mail"></i> Email</div>
          <div class="ws-feature"><i class="ti ti-search"></i> Research</div>
          <div class="ws-feature"><i class="ti ti-file-text"></i> Documents</div>
          <div class="ws-feature"><i class="ti ti-photo"></i> Images</div>
          <div class="ws-feature"><i class="ti ti-layout-kanban"></i> Kanban</div>
          <div class="ws-feature"><i class="ti ti-chart-bar"></i> Model Compare</div>
        </div>

        <div class="cookbook-note">
          <strong>Hardware-aware model serving.</strong> Carina's Cookbook detects your GPU, VRAM, CPU,
          and storage and recommends models that actually fit. No guesswork. No wasted downloads.
        </div>
      </div>

      <div class="moat-visual">
        <div class="visual-bar">
          <span class="visual-bar-dot vbd-r"></span>
          <span class="visual-bar-dot vbd-y"></span>
          <span class="visual-bar-dot vbd-g"></span>
          <span class="visual-bar-title">workspace</span>
        </div>
        <!-- Replace with real workspace-demo.gif when available -->
        <div class="visual-placeholder">workspace-demo.gif</div>
      </div>
    </div>
  </div>
</section>
```

---

## SCOUT CROSS-SELL SECTION HTML

Insert immediately after the workspace section:

```html
<!-- SECTION 5: SCOUT CROSS-SELL -->
<section id="scout" class="section scout-section">
  <div class="container">
    <div class="scout-grid">
      <div class="scout-visual">
        <div class="scout-visual-bar">
          <span class="visual-bar-dot vbd-r"></span>
          <span class="visual-bar-dot vbd-y"></span>
          <span class="visual-bar-dot vbd-g"></span>
          <span class="scout-visual-bar-title">scout-console</span>
        </div>
        <!-- Replace with real security-demo.gif when available -->
        <div class="visual-placeholder" style="border-color: rgba(255,60,60,0.1);">security-demo.gif</div>
      </div>

      <div class="scout-content">
        <div class="scout-kill-badge">
          <i class="ti ti-power"></i>
          Kill Switch Active
        </div>
        <h2 class="section-h2">
          Intelligence Without<br>Control Is A<br><em style="color:#f87171;">Liability.</em>
        </h2>
        <p class="section-sub">
          Every Carina deployment can be protected by Labyrinth Scout: Mission Control
          for Autonomous Agents.
        </p>

        <div class="scout-capabilities">
          <div class="scout-cap">
            <div class="scout-cap-icon"><i class="ti ti-power"></i></div>
            <span>Kill Switch - suspend all agent activity from one control point</span>
          </div>
          <div class="scout-cap">
            <div class="scout-cap-icon"><i class="ti ti-gavel"></i></div>
            <span>Runtime Governance - human-in-the-loop approval workflows</span>
          </div>
          <div class="scout-cap">
            <div class="scout-cap-icon"><i class="ti ti-shield-check"></i></div>
            <span>Injection Shield - three-layer prompt injection defence</span>
          </div>
          <div class="scout-cap">
            <div class="scout-cap-icon"><i class="ti ti-history"></i></div>
            <span>Audit Trails - every agent action recorded and exportable</span>
          </div>
          <div class="scout-cap">
            <div class="scout-cap-icon"><i class="ti ti-certificate"></i></div>
            <span>Trust Verification - continuously updated agent trust passports</span>
          </div>
          <div class="scout-cap">
            <div class="scout-cap-icon"><i class="ti ti-shield-lock"></i></div>
            <span>Egress Controls - block unauthorised external communications</span>
          </div>
        </div>

        <div class="scout-cta-group">
          <a href="https://labyrinthscout.com" class="btn-scout">
            <i class="ti ti-arrow-right"></i>
            Explore Labyrinth Scout
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Notes

1. The Scout section uses red-tinted styling (`#f87171`) deliberately. Scout is a different product with a different visual identity. The tonal shift signals to the visitor that they are now being introduced to a separate, complementary product.

2. The `moat-visual` class is reused for the workspace visual - it is the same card component. No new class needed.

3. Both GIF placeholders should be replaced with actual `<img>` tags when the demo assets are confirmed.
