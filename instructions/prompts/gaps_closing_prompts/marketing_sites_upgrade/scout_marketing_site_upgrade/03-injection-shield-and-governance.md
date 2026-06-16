# Scout Prompt 03 - Injection Shield Section and Governance Section

## Target file

`/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html`

## What this prompt adds

Sections 4 and 5: Injection Shield ("Stop Prompt Injection Before It Becomes Action.") and Governance ("Security Tools Detect. Scout Governs."). Section 5 contains the comparison table which is the sharpest competitive differentiator in all of Scout's copy.

---

## CSS to add

```css
/* --- INJECTION SHIELD SECTION --- */
.inject-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .inject-grid { grid-template-columns: 1fr; gap: 2.5rem; }
}

.inject-layers {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 2rem;
}

.inject-layer {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.25rem 1.25rem;
  position: relative;
}

.inject-layer:not(:last-child)::after {
  content: '';
  position: absolute;
  left: calc(1.25rem + 15px);
  bottom: 0;
  width: 2px;
  height: 1.25rem;
  background: linear-gradient(to bottom, rgba(230,57,70,0.3), rgba(230,57,70,0.0));
  transform: translateY(100%);
}

.inject-layer-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(230,57,70,0.4);
  background: rgba(230,57,70,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--red);
  flex-shrink: 0;
}

.inject-layer-text h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.inject-layer-text p {
  font-size: 0.82rem;
  color: var(--text-mid);
  line-height: 1.55;
}

.inject-result {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  border-radius: var(--r-md);
  background: rgba(230,57,70,0.06);
  border: 1px solid rgba(230,57,70,0.15);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.inject-result i { color: var(--red); font-size: 1.1rem; }

.inject-console {
  border-radius: var(--r-lg);
  overflow: hidden;
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
  font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
}

.inject-console-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  background: var(--bg-lift);
  border-bottom: 1px solid var(--border);
}

.ic-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
}
.ic-r { background: #ff5f57; }
.ic-y { background: #febc2e; }
.ic-g { background: #28c840; }

.inject-console-title {
  margin-left: 0.4rem;
  font-size: 0.68rem;
  color: var(--text-dim);
  letter-spacing: 0.04em;
  font-family: var(--ff-sans);
}

.inject-console-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ic-line {
  display: flex;
  gap: 0.75rem;
  line-height: 1.5;
}

.ic-time { color: var(--text-dim); min-width: 48px; }

.ic-tag {
  padding: 0 0.45rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  min-width: 70px;
  text-align: center;
  line-height: 1.8;
}

.ic-tag-ok     { background: rgba(34,197,94,0.15); color: var(--green-safe); }
.ic-tag-warn   { background: rgba(245,158,11,0.15); color: var(--amber-warn); }
.ic-tag-alert  { background: rgba(230,57,70,0.2); color: var(--red); }
.ic-tag-kill   { background: var(--red); color: #fff; }

.ic-msg { color: var(--text-mid); }
.ic-msg .ic-highlight { color: var(--text-primary); }

/* --- GOVERNANCE SECTION --- */
.gov-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: start;
}

@media (max-width: 768px) {
  .gov-grid { grid-template-columns: 1fr; gap: 2.5rem; }
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  border-radius: var(--r-lg);
  overflow: hidden;
  margin-top: 2rem;
}

.compare-table th {
  padding: 0.85rem 1.25rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.compare-table th:first-child {
  background: rgba(255,255,255,0.03);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-right: none;
}

.compare-table th:last-child {
  background: rgba(230,57,70,0.08);
  color: var(--red);
  border: 1px solid rgba(230,57,70,0.2);
}

.compare-table td {
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  border-left: 1px solid;
  border-right: 1px solid;
}

.compare-table tr:not(:last-child) td {
  border-bottom: 1px solid;
}

.compare-table td:first-child {
  color: var(--text-dim);
  border-color: var(--border);
  background: rgba(255,255,255,0.01);
}

.compare-table td:last-child {
  color: var(--text-primary);
  font-weight: 500;
  border-color: rgba(230,57,70,0.15);
  background: rgba(230,57,70,0.04);
}

.compare-table tr:last-child td {
  border-bottom: 1px solid;
}

.compare-table tr:last-child td:first-child { border-bottom-color: var(--border); }
.compare-table tr:last-child td:last-child  { border-bottom-color: rgba(230,57,70,0.15); }

.gov-approval-flow {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 2rem;
}

.gov-flow-step {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  border-radius: var(--r-md);
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.gov-flow-connector {
  display: flex;
  justify-content: flex-start;
  padding-left: 1.5rem;
  height: 1.5rem;
}

.gov-flow-connector::before {
  content: '';
  width: 2px;
  background: var(--border);
  display: block;
}

.gov-flow-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--red-dim);
  border: 1px solid rgba(230,57,70,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--red);
  flex-shrink: 0;
}

.gov-flow-text h4 { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.15rem; }
.gov-flow-text p  { font-size: 0.78rem; color: var(--text-mid); line-height: 1.5; }

.gov-controls-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 2rem;
}

.gov-control {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.85rem;
  color: var(--text-mid);
}

.gov-control i { color: var(--amber-warn); font-size: 1rem; width: 18px; }
```

---

## INJECTION SHIELD SECTION HTML

Insert after the Trust Passport section:

```html
<!-- SECTION 4: INJECTION SHIELD -->
<section id="injection" class="section section-lift">
  <div class="container">
    <div class="inject-grid">
      <div class="inject-content">
        <div class="section-eyebrow eyebrow-amber">
          <i class="ti ti-shield-lock"></i>
          Injection Shield
        </div>
        <h2 class="section-h2">
          Stop Prompt Injection<br>Before It Becomes
          <span class="accent-red"> Action.</span>
        </h2>
        <p class="section-sub">
          Three independent protection layers evaluate every input, tool response,
          and model context before any action is executed. Malicious prompts are
          blocked before they become behaviour.
        </p>

        <div class="inject-layers">
          <div class="inject-layer">
            <div class="inject-layer-num">1</div>
            <div class="inject-layer-text">
              <h4>Input Analysis</h4>
              <p>Regex pre-filter and pattern matching on all user input and injected content before it reaches the model.</p>
            </div>
          </div>
          <div class="inject-layer">
            <div class="inject-layer-num">2</div>
            <div class="inject-layer-text">
              <h4>Policy Validation</h4>
              <p>LLM judge layer evaluates context against active governance policy before approving execution.</p>
            </div>
          </div>
          <div class="inject-layer">
            <div class="inject-layer-num">3</div>
            <div class="inject-layer-text">
              <h4>Runtime Monitoring</h4>
              <p>Output guard inspects model responses and tool calls for unsafe, unexpected, or policy-violating content.</p>
            </div>
          </div>
        </div>

        <div class="inject-result">
          <i class="ti ti-circle-x"></i>
          Malicious prompts are blocked before they become behaviour.
        </div>
      </div>

      <div class="inject-console">
        <div class="inject-console-bar">
          <span class="ic-dot ic-r"></span>
          <span class="ic-dot ic-y"></span>
          <span class="ic-dot ic-g"></span>
          <span class="inject-console-title">scout-injection-log</span>
        </div>
        <div class="inject-console-body">
          <div class="ic-line">
            <span class="ic-time">14:02:11</span>
            <span class="ic-tag ic-tag-ok">INPUT</span>
            <span class="ic-msg">Tool call received <span class="ic-highlight">read_file</span></span>
          </div>
          <div class="ic-line">
            <span class="ic-time">14:02:11</span>
            <span class="ic-tag ic-tag-warn">ANALYSE</span>
            <span class="ic-msg">Pattern match: suspicious instruction fragment</span>
          </div>
          <div class="ic-line">
            <span class="ic-time">14:02:12</span>
            <span class="ic-tag ic-tag-warn">POLICY</span>
            <span class="ic-msg">LLM judge: injection signature confidence 0.91</span>
          </div>
          <div class="ic-line">
            <span class="ic-time">14:02:12</span>
            <span class="ic-tag ic-tag-alert">BLOCK</span>
            <span class="ic-msg">Execution halted - awaiting operator review</span>
          </div>
          <div class="ic-line">
            <span class="ic-time">14:03:16</span>
            <span class="ic-tag ic-tag-ok">INPUT</span>
            <span class="ic-msg">Tool call received <span class="ic-highlight">send_email</span></span>
          </div>
          <div class="ic-line">
            <span class="ic-time">14:03:16</span>
            <span class="ic-tag ic-tag-kill">KILL</span>
            <span class="ic-msg">Agent suspended - kill switch activated</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## GOVERNANCE SECTION HTML

Insert after the Injection Shield section:

```html
<!-- SECTION 5: GOVERNANCE -->
<section id="governance" class="section section-dark">
  <div class="container">
    <div class="gov-grid">
      <div class="gov-content">
        <div class="section-eyebrow eyebrow-red">
          <i class="ti ti-gavel"></i>
          Governance Engine
        </div>
        <h2 class="section-h2">
          Security Tools <span class="accent-red">Detect.</span><br>
          Scout <span class="accent-red">Governs.</span>
        </h2>
        <p class="section-sub">
          Monitoring tells you what happened. Scout decides what happens next.
        </p>

        <table class="compare-table">
          <thead>
            <tr>
              <th>Traditional Security</th>
              <th>Scout</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Alerts</td><td>Intervention</td></tr>
            <tr><td>Monitoring</td><td>Governance</td></tr>
            <tr><td>Logging</td><td>Decisions</td></tr>
            <tr><td>Reports</td><td>Control</td></tr>
            <tr><td>Detection</td><td>Prevention</td></tr>
          </tbody>
        </table>
      </div>

      <div class="gov-right">
        <div class="section-eyebrow eyebrow-amber" style="margin-top:0;">
          <i class="ti ti-users"></i>
          Human-in-the-loop
        </div>
        <h3 style="font-size:1.15rem;font-weight:600;color:var(--text-primary);margin-bottom:0.75rem;letter-spacing:-0.01em;">
          Approval workflow
        </h3>
        <p style="font-size:0.875rem;color:var(--text-mid);line-height:1.65;margin-bottom:0;">
          Before agents take high-risk actions, Scout pauses and waits. Operators
          approve or reject from the dashboard.
        </p>

        <div class="gov-approval-flow">
          <div class="gov-flow-step">
            <div class="gov-flow-num">1</div>
            <div class="gov-flow-text">
              <h4>Agent requests action</h4>
              <p>Tool call or external action triggers policy evaluation.</p>
            </div>
          </div>
          <div class="gov-flow-connector"></div>
          <div class="gov-flow-step">
            <div class="gov-flow-num">2</div>
            <div class="gov-flow-text">
              <h4>Scout evaluates risk</h4>
              <p>Policy engine compares action against active governance template and risk thresholds.</p>
            </div>
          </div>
          <div class="gov-flow-connector"></div>
          <div class="gov-flow-step">
            <div class="gov-flow-num">3</div>
            <div class="gov-flow-text">
              <h4>Operator approves or rejects</h4>
              <p>High-risk actions pause. Human approves from the dashboard. Agent proceeds only on approval.</p>
            </div>
          </div>
        </div>

        <div class="gov-controls-list">
          <div class="gov-control"><i class="ti ti-sliders"></i> Set approval thresholds before deployment</div>
          <div class="gov-control"><i class="ti ti-alert-circle"></i> Configure risk levels per tool and action type</div>
          <div class="gov-control"><i class="ti ti-arrow-up"></i> Define escalation rules for policy violations</div>
          <div class="gov-control"><i class="ti ti-certificate"></i> EU AI Act, GDPR, SOC2, ISO 42001 frameworks</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Notes

1. The comparison table is the sharpest competitive copy in the entire Scout brand. It must be visible, not buried. Its placement in Section 5 means it appears after the visitor has already understood what Kill Switch, Trust Passport, and Injection Shield do - so the "Scout Governs" claim lands with full weight.

2. The inject console log uses the same data as the existing Scout site's console preview but slightly condensed. It is fictional but realistic data. Update with live API-driven content if the Scout dashboard provides a public events feed.

3. The governance approval flow has no border or extra card wrapping - it uses the flow connector lines to show sequence. This is lighter visually than a card-per-step approach and reads faster.
