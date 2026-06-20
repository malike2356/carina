# Scout Prompt 02 - Kill Switch Section and Trust Passport Section

## Target file

`/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html`

## What this prompt adds

Sections 2 and 3: Kill Switch ("Every Autonomous System Needs A Brake.") and Trust Passport ("Don't Trust Agent Claims. Verify Them.").

Kill Switch is Section 2 - not a feature card buried in a grid. It is a standalone hero-level section because it is Scout's most memorable and distinct capability. Nothing else in the AI governance market has a named kill switch.

---

## CSS to add

```css
/* --- SHARED SECTION STYLES --- */
.section {
  padding: 7rem 0;
  position: relative;
  z-index: 1;
}

.section-lift { background: var(--bg-lift); }
.section-dark  { background: var(--bg); }

.section-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  margin-bottom: 1.25rem;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
}

.eyebrow-red {
  color: var(--red);
  border: 1px solid rgba(230,57,70,0.25);
  background: rgba(230,57,70,0.06);
}

.eyebrow-amber {
  color: var(--amber-warn);
  border: 1px solid rgba(245,158,11,0.25);
  background: rgba(245,158,11,0.06);
}

.eyebrow-cyber {
  color: var(--cyber);
  border: 1px solid rgba(34,211,238,0.25);
  background: rgba(34,211,238,0.06);
}

.section-h2 {
  font-size: clamp(1.9rem, 3.5vw, 2.9rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.1;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.section-h2 .accent-red   { color: var(--red); }
.section-h2 .accent-amber { color: var(--amber-warn); }
.section-h2 .accent-cyber { color: var(--cyber); }

.section-sub {
  font-size: 1rem;
  color: var(--text-mid);
  max-width: 520px;
  line-height: 1.7;
  margin-bottom: 2.5rem;
}

/* --- KILL SWITCH SECTION --- */
.ks-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5rem;
  align-items: center;
}

@media (max-width: 768px) {
  .ks-grid { grid-template-columns: 1fr; gap: 2.5rem; }
}

.ks-visual {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ks-switch {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ks-switch-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid;
  animation: ks-pulse 2.5s ease-in-out infinite;
}

.ks-switch-ring:nth-child(1) {
  width: 200px; height: 200px;
  border-color: rgba(230,57,70,0.15);
  animation-delay: 0s;
}

.ks-switch-ring:nth-child(2) {
  width: 160px; height: 160px;
  border-color: rgba(230,57,70,0.25);
  animation-delay: 0.3s;
}

.ks-switch-ring:nth-child(3) {
  width: 120px; height: 120px;
  border-color: rgba(230,57,70,0.4);
  animation-delay: 0.6s;
}

@keyframes ks-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.03); }
}

.ks-switch-button {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #ff4d5a, var(--red));
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  box-shadow:
    0 0 0 4px rgba(230,57,70,0.2),
    0 0 32px rgba(230,57,70,0.35),
    0 8px 24px rgba(0,0,0,0.5);
  position: relative;
  z-index: 2;
}

.ks-switch-button i {
  font-size: 2rem;
  color: #fff;
}

.ks-actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.75rem;
}

.ks-action {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 1.1rem;
  border-radius: var(--r-md);
  background: rgba(230,57,70,0.05);
  border: 1px solid rgba(230,57,70,0.12);
}

.ks-action i { color: var(--red); font-size: 1rem; width: 18px; flex-shrink: 0; }

.ks-action span { font-size: 0.875rem; color: var(--text-mid); }

.ks-authority-line {
  display: inline-block;
  margin-top: 2rem;
  padding: 0.85rem 1.5rem;
  border-radius: var(--r-md);
  background: rgba(230,57,70,0.08);
  border: 1px solid rgba(230,57,70,0.2);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

/* --- TRUST PASSPORT SECTION --- */
.tp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .tp-grid { grid-template-columns: 1fr; gap: 2.5rem; }
  .tp-grid .tp-content { order: 2; }
  .tp-grid .tp-visual { order: 1; }
}

.tp-card {
  border-radius: var(--r-lg);
  background: var(--bg-card);
  border: 1px solid rgba(34,211,238,0.2);
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(34,211,238,0.05);
}

.tp-card-header {
  padding: 1.25rem 1.5rem;
  background: rgba(34,211,238,0.05);
  border-bottom: 1px solid rgba(34,211,238,0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tp-card-title {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cyber);
  font-weight: 600;
}

.tp-trust-score {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--green-safe);
}

.tp-trust-score i { font-size: 0.9rem; }

.tp-card-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tp-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.tp-field-label {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  font-weight: 600;
}

.tp-field-value {
  font-size: 0.83rem;
  color: var(--text-mid);
}

.tp-field-value.ok  { color: var(--green-safe); }
.tp-field-value.warn { color: var(--amber-warn); }

.tp-attestations {
  padding: 0.85rem 1.5rem;
  background: rgba(34,211,238,0.03);
  border-top: 1px solid rgba(34,211,238,0.08);
}

.tp-attest-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.35rem 0;
  font-size: 0.78rem;
}

.tp-attest-row span { color: var(--text-dim); }

.tp-attest-row strong { color: var(--text-mid); font-weight: 500; }

.tp-content {}

.tp-proof-pillars {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.tp-pillar {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  padding: 1rem 1.25rem;
  border-radius: var(--r-md);
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.tp-pillar-icon {
  width: 36px; height: 36px;
  border-radius: var(--r);
  background: rgba(34,211,238,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tp-pillar-icon i { color: var(--cyber); font-size: 1rem; }

.tp-pillar-text h4 { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.2rem; }
.tp-pillar-text p  { font-size: 0.8rem; color: var(--text-mid); line-height: 1.5; }
```

---

## KILL SWITCH SECTION HTML

Insert after the hero section:

```html
<!-- SECTION 2: KILL SWITCH -->
<section id="kill-switch" class="section section-lift">
  <div class="container">
    <div class="ks-grid">
      <div class="ks-content">
        <div class="section-eyebrow eyebrow-red">
          <i class="ti ti-power"></i>
          Kill Switch
        </div>
        <h2 class="section-h2">
          Every Autonomous System<br>Needs <span class="accent-red">A Brake.</span>
        </h2>
        <p class="section-sub">
          When a governed agent drifts beyond policy, behaves unexpectedly, or encounters
          a security event, Scout gives you one action: stop everything, from one place,
          in one second.
        </p>

        <div class="ks-actions-list">
          <div class="ks-action"><i class="ti ti-robot-off"></i><span>Suspend all governed agents immediately</span></div>
          <div class="ks-action"><i class="ti ti-workflow-off"></i><span>Pause active workflows and automation</span></div>
          <div class="ks-action"><i class="ti ti-tool-off"></i><span>Block pending tool execution calls</span></div>
          <div class="ks-action"><i class="ti ti-world-off"></i><span>Cut external communications and egress</span></div>
          <div class="ks-action"><i class="ti ti-history"></i><span>Capture full audit snapshot at time of kill</span></div>
        </div>

        <div class="ks-authority-line">
          Human authority remains absolute.
        </div>
      </div>

      <div class="ks-visual">
        <div class="ks-switch">
          <div class="ks-switch-ring"></div>
          <div class="ks-switch-ring"></div>
          <div class="ks-switch-ring"></div>
          <div class="ks-switch-button" aria-label="Kill switch visual">
            <i class="ti ti-power"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## TRUST PASSPORT SECTION HTML

Insert after the Kill Switch section:

```html
<!-- SECTION 3: TRUST PASSPORT -->
<section id="trust-passport" class="section section-dark">
  <div class="container">
    <div class="tp-grid">
      <div class="tp-content">
        <div class="section-eyebrow eyebrow-cyber">
          <i class="ti ti-id-badge"></i>
          Trust Passport
        </div>
        <h2 class="section-h2">
          Don't Trust Agent Claims.<br>
          <span class="accent-cyber">Verify Them.</span>
        </h2>
        <p class="section-sub">
          Every agent under Scout management receives a continuously updated trust
          profile covering identity, compliance, behaviour history, and risk score.
          Evidence. Not promises.
        </p>

        <div class="tp-proof-pillars">
          <div class="tp-pillar">
            <div class="tp-pillar-icon"><i class="ti ti-fingerprint"></i></div>
            <div class="tp-pillar-text">
              <h4>Agent identity</h4>
              <p>Verified identity record linked to deployment metadata, ownership, and capabilities.</p>
            </div>
          </div>
          <div class="tp-pillar">
            <div class="tp-pillar-icon"><i class="ti ti-activity"></i></div>
            <div class="tp-pillar-text">
              <h4>Continuous behaviour scoring</h4>
              <p>Trust score updates in real time based on observed actions, policy compliance, and anomaly history.</p>
            </div>
          </div>
          <div class="tp-pillar">
            <div class="tp-pillar-icon"><i class="ti ti-file-certificate"></i></div>
            <div class="tp-pillar-text">
              <h4>Audit trail and attestations</h4>
              <p>Every action, approval, and governance event recorded and exportable as JSON, CSV, or PDF.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="tp-visual">
        <div class="tp-card">
          <div class="tp-card-header">
            <span class="tp-card-title">Trust Passport</span>
            <div class="tp-trust-score"><i class="ti ti-shield-check"></i> 94 / 100</div>
          </div>
          <div class="tp-card-body">
            <div class="tp-field">
              <span class="tp-field-label">Agent ID</span>
              <span class="tp-field-value">carina-prod-01</span>
            </div>
            <div class="tp-field">
              <span class="tp-field-label">Status</span>
              <span class="tp-field-value ok">Compliant</span>
            </div>
            <div class="tp-field">
              <span class="tp-field-label">Last policy check</span>
              <span class="tp-field-value">14:03:22 today</span>
            </div>
            <div class="tp-field">
              <span class="tp-field-label">Injection attempts blocked</span>
              <span class="tp-field-value warn">3 (last 7 days)</span>
            </div>
            <div class="tp-field">
              <span class="tp-field-label">Kill switch</span>
              <span class="tp-field-value ok">Armed and ready</span>
            </div>
            <div class="tp-field">
              <span class="tp-field-label">EU AI Act tier</span>
              <span class="tp-field-value">High Risk - Monitored</span>
            </div>
          </div>
          <div class="tp-attestations">
            <div class="tp-attest-row">
              <span>Governance policy applied</span>
              <strong>uk-property-v2</strong>
            </div>
            <div class="tp-attest-row">
              <span>Operator approvals required</span>
              <strong>Financial actions</strong>
            </div>
            <div class="tp-attest-row">
              <span>Audit log exported</span>
              <strong>14 days retained</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Notes

1. The Kill Switch visual is a pure CSS animated button with pulsing rings. No images, no GIFs, no external assets required. It works immediately. If a real screenshot or animation of the dashboard kill switch exists, use that instead.

2. The Trust Passport card uses real-looking but fictional data. Update any field values to reflect actual system data if the card is connected to a live API at `/api/trust` - but fictional values are fine for the landing page.

3. No blockchain language appears in either section. The Trust Passport card shows attestations as features, not as blockchain transactions. The implementation detail (how attestations are stored) does not need to be in the landing page.
