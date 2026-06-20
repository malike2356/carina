# Scout Prompt 04 - Pricing, Final CTA, and Footer

## Target file

`/opt/lampp/htdocs/verlox/carina/labyrinthscout.com/index.html`

## What this prompt adds

The Pricing section (keep the existing tier structure but restyled), the Final CTA section ("Before You Deploy Agents. Deploy Authority."), and the footer. After this, only the JavaScript remains (Prompt 05).

---

## CSS to add

```css
/* --- PRICING SECTION --- */
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-top: 3rem;
}

@media (max-width: 900px) {
  .pricing-grid { grid-template-columns: 1fr; max-width: 420px; margin-left: auto; margin-right: auto; }
}

.pricing-card {
  border-radius: var(--r-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: border-color var(--transition);
}

.pricing-card:hover { border-color: var(--border-mid); }

.pricing-card.featured {
  border-color: rgba(230,57,70,0.3);
  background: linear-gradient(180deg, rgba(230,57,70,0.05) 0%, var(--bg-card) 60%);
  position: relative;
}

.pricing-card.featured::before {
  content: 'Most Popular';
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--red);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.25rem 0.9rem;
  border-radius: 0 0 var(--r) var(--r);
}

.pricing-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.pricing-price {
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 0.35rem;
}

.pricing-price small {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-dim);
  letter-spacing: 0;
}

.pricing-period {
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-bottom: 1.75rem;
}

.pricing-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: 1.5rem;
}

.pricing-features {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  flex: 1;
  margin-bottom: 2rem;
}

.pricing-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.83rem;
  color: var(--text-mid);
  line-height: 1.45;
}

.pricing-features li i {
  color: var(--red);
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.pricing-features li.muted i { color: var(--text-dim); }
.pricing-features li.muted { color: var(--text-dim); }

.btn-pricing-primary {
  display: block;
  text-align: center;
  background: var(--red);
  color: #fff;
  padding: 0.75rem;
  border-radius: var(--r-md);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity var(--transition);
}

.btn-pricing-primary:hover { opacity: 0.88; color: #fff; }

.btn-pricing-outline {
  display: block;
  text-align: center;
  background: transparent;
  color: var(--text-mid);
  padding: 0.75rem;
  border-radius: var(--r-md);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid var(--border-mid);
  transition: color var(--transition), border-color var(--transition);
}

.btn-pricing-outline:hover { color: var(--text-primary); border-color: var(--red); }

.pricing-note {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-top: 0.75rem;
}

/* --- FINAL CTA SECTION --- */
.cta-section {
  background: var(--bg-lift);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 8rem 0;
  text-align: center;
  position: relative;
  z-index: 1;
}

.cta-section::before {
  content: '';
  position: absolute;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 700px;
  height: 400px;
  background: radial-gradient(ellipse at 50% 0%, rgba(230,57,70,0.07) 0%, transparent 65%);
  pointer-events: none;
}

.cta-h2 {
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.1;
  color: var(--text-primary);
  margin-bottom: 1.25rem;
}

.cta-h2 .accent-red { color: var(--red); }

.cta-sub {
  font-size: 1rem;
  color: var(--text-mid);
  max-width: 480px;
  margin: 0 auto 2.5rem;
  line-height: 1.7;
}

.cta-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-cta-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--red);
  color: #fff;
  padding: 0.85rem 1.75rem;
  border-radius: var(--r-md);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity var(--transition), transform var(--transition);
}

.btn-cta-primary:hover { opacity: 0.88; transform: translateY(-1px); color: #fff; }

.btn-cta-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: var(--text-mid);
  padding: 0.85rem 1.75rem;
  border-radius: var(--r-md);
  font-size: 0.95rem;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid var(--border-mid);
  transition: color var(--transition), border-color var(--transition);
}

.btn-cta-ghost:hover { color: var(--text-primary); border-color: var(--red); }

/* --- FOOTER --- */
footer {
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 3.5rem 0 2rem;
  position: relative;
  z-index: 1;
}

.footer-inner {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

@media (max-width: 900px) {
  .footer-inner { grid-template-columns: 1fr 1fr; gap: 2rem; }
}

@media (max-width: 520px) {
  .footer-inner { grid-template-columns: 1fr; gap: 1.5rem; }
}

.footer-logo {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  text-decoration: none;
  display: block;
  margin-bottom: 0.85rem;
}

.footer-logo span { color: var(--red); }

.footer-tagline {
  font-size: 0.8rem;
  color: var(--text-dim);
  line-height: 1.6;
  max-width: 260px;
}

.footer-col h4 {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 1rem;
}

.footer-col a {
  display: block;
  font-size: 0.83rem;
  color: var(--text-mid);
  text-decoration: none;
  margin-bottom: 0.6rem;
  transition: color var(--transition);
}

.footer-col a:hover { color: var(--text-primary); }

.footer-bottom {
  padding-top: 2rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-bottom-left {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.footer-bottom-links {
  display: flex;
  gap: 1.5rem;
}

.footer-bottom-links a {
  font-size: 0.75rem;
  color: var(--text-dim);
  text-decoration: none;
  transition: color var(--transition);
}

.footer-bottom-links a:hover { color: var(--text-mid); }
```

---

## PRICING SECTION HTML

Insert after the Governance section:

```html
<!-- PRICING -->
<section id="pricing" class="section section-lift">
  <div class="container">
    <div style="text-align:center;">
      <div class="section-eyebrow eyebrow-red" style="display:inline-flex;margin-bottom:1.25rem;">
        <i class="ti ti-currency-pound"></i>
        Pricing
      </div>
      <h2 class="section-h2" style="max-width:480px;margin:0 auto 1rem;">
        Monitor or <span class="accent-red">Govern</span>
      </h2>
      <p style="font-size:1rem;color:var(--text-mid);max-width:480px;margin:0 auto;">
        One Scout licence per deployment. Monitor gives visibility. Pro adds response controls, approvals, and a kill switch.
      </p>
    </div>

    <div class="pricing-grid">
      <div class="pricing-card">
        <h3>Scout Monitor</h3>
        <div class="pricing-price">£79<small>/mo</small></div>
        <div class="pricing-period">per deployment</div>
        <div class="pricing-divider"></div>
        <ul class="pricing-features">
          <li><i class="ti ti-eye"></i> Live monitoring dashboard</li>
          <li><i class="ti ti-alert-triangle"></i> Risk signals and anomaly detection</li>
          <li><i class="ti ti-history"></i> Audit history and event export</li>
          <li><i class="ti ti-certificate"></i> EU AI Act tier classification</li>
          <li><i class="ti ti-browser"></i> Browser alerts (dashboard open)</li>
          <li class="muted"><i class="ti ti-lock"></i> Kill switch (Pro only)</li>
          <li class="muted"><i class="ti ti-gavel"></i> Approval workflows (Pro only)</li>
        </ul>
        <a href="https://core.carinaai.uk/checkout?plan=scout_monitor" class="btn-pricing-outline">Start Monitor</a>
      </div>

      <div class="pricing-card featured">
        <h3>Scout Pro</h3>
        <div class="pricing-price">£99<small>/mo</small></div>
        <div class="pricing-period">per deployment</div>
        <div class="pricing-divider"></div>
        <ul class="pricing-features">
          <li><i class="ti ti-check"></i> Everything in Monitor</li>
          <li><i class="ti ti-power"></i> Kill switch and response controls</li>
          <li><i class="ti ti-gavel"></i> Pre-action approval workflow</li>
          <li><i class="ti ti-building-bank"></i> Industry policy templates</li>
          <li><i class="ti ti-report-analytics"></i> Governance dashboard and PDF reports</li>
          <li><i class="ti ti-message"></i> Telegram, email, and Slack alerts</li>
          <li><i class="ti ti-id-badge"></i> Trust Passport and attestations</li>
        </ul>
        <a href="https://core.carinaai.uk/checkout?plan=scout_pro" class="btn-pricing-primary">Get Scout Pro</a>
        <p class="pricing-note">Console URL and API key emailed at provisioning.</p>
      </div>

      <div class="pricing-card">
        <h3>Enterprise</h3>
        <div class="pricing-price" style="font-size:1.8rem;">Custom</div>
        <div class="pricing-period">contact for pricing</div>
        <div class="pricing-divider"></div>
        <ul class="pricing-features">
          <li><i class="ti ti-check"></i> Everything in Scout Pro</li>
          <li><i class="ti ti-key"></i> Bring-your-own API keys (BYOK)</li>
          <li><i class="ti ti-certificate"></i> Custom compliance templates</li>
          <li><i class="ti ti-chart-pie"></i> Dedicated governance posture review</li>
          <li><i class="ti ti-clock"></i> 99.9% uptime SLA</li>
          <li><i class="ti ti-messages"></i> Dedicated support channel</li>
          <li><i class="ti ti-building"></i> On-premise deployment option</li>
        </ul>
        <a href="mailto:contact@verlox.uk" class="btn-pricing-outline">Contact sales</a>
      </div>
    </div>
  </div>
</section>
```

---

## FINAL CTA SECTION HTML

Insert after the Pricing section:

```html
<!-- FINAL CTA -->
<section class="cta-section">
  <div class="container">
    <h2 class="cta-h2">
      Before You Deploy Agents.<br>
      <span class="accent-red">Deploy Authority.</span>
    </h2>
    <p class="cta-sub">
      Govern AI systems with trust, visibility, and intervention capabilities
      designed for real-world autonomy.
    </p>
    <div class="cta-actions">
      <a href="https://core.carinaai.uk/checkout?plan=scout_pro" class="btn-cta-primary">
        <i class="ti ti-radar"></i>
        Start Monitoring
      </a>
      <a href="/docs/" class="btn-cta-ghost">
        <i class="ti ti-book"></i>
        View docs
      </a>
      <a href="https://carinaai.uk/trust" class="btn-cta-ghost">
        <i class="ti ti-id-badge"></i>
        Trust Dashboard
      </a>
    </div>
  </div>
</section>
```

---

## FOOTER HTML

Replace the existing `<footer>` with:

```html
<footer>
  <div class="container">
    <div class="footer-inner">
      <div>
        <a href="/" class="footer-logo">Labyrinth<span>Scout</span></a>
        <p class="footer-tagline">
          Observe. Verify. Control.<br>
          Mission Control for Autonomous Agents. Integrates with
          <a href="https://carinaai.uk" style="color:var(--red);text-decoration:none;">Carina</a>
          and any agent stack.
        </p>
      </div>
      <div class="footer-col">
        <h4>Controls</h4>
        <a href="#kill-switch">Kill Switch</a>
        <a href="#trust-passport">Trust Passport</a>
        <a href="#injection">Injection Shield</a>
        <a href="#governance">Governance</a>
      </div>
      <div class="footer-col">
        <h4>Product</h4>
        <a href="#pricing">Pricing</a>
        <a href="/docs/">Documentation</a>
        <a href="/docs/integration/carina">Carina integration</a>
        <a href="https://carinaai.uk/trust">Trust API</a>
        <a href="https://carinaai.uk">Carina</a>
      </div>
      <div class="footer-col">
        <h4>Get Scout</h4>
        <a href="https://core.carinaai.uk/checkout?plan=scout_pro">Scout Pro - £99/mo</a>
        <a href="https://core.carinaai.uk/checkout?plan=scout_monitor">Scout Monitor - £79/mo</a>
        <a href="mailto:contact@verlox.uk">Enterprise contact</a>
        <a href="mailto:contact@verlox.uk">Contact</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span class="footer-bottom-left">
        &copy; 2026 VERLOX Ltd. All rights reserved. labyrinthscout.com
      </span>
      <div class="footer-bottom-links">
        <a href="/docs/privacy/">Privacy</a>
        <a href="/docs/terms/">Terms</a>
      </div>
    </div>
  </div>
</footer>
```

---

## Notes

1. The "Most Popular" badge on the Pro card uses a CSS `::before` pseudo-element - no extra HTML element needed.

2. The muted pricing features (kill switch and approvals listed as greyed-out in Monitor) are intentional: they remind Monitor buyers of what they are missing and create upgrade pressure.

3. The footer tagline is now "Observe. Verify. Control. / Mission Control for Autonomous Agents." - the complete Scout identity in two lines.
