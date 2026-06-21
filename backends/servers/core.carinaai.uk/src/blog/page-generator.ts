import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureIncidentBlogSchema, getPublishedIncidents } from './store.js';
import type { BlogIncident, IncidentCategory } from './types.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUTPUT_PATH = path.join(root, '..', 'labyrinthscout.com', 'incidents', 'index.html');
const TEMP_PATH = `${OUTPUT_PATH}.tmp`;

const CATEGORY_META: Record<IncidentCategory, {
  eyebrowClass: string;
  icon: string;
  label: string;
  h2: string;
  intro: string;
  commentStart: string;
  commentEnd: string;
}> = {
  financial: {
    eyebrowClass: 'eyebrow-red',
    icon: 'ti-currency-dollar',
    label: 'Financial damage',
    h2: 'The bills that arrived without warning.',
    intro: 'AI agents run 24/7. They loop, retry, and chain calls without human awareness. Without budget controls, they are an open meter with no circuit breaker.',
    commentStart: '<!-- CATEGORY 1: FINANCIAL -->',
    commentEnd: '<!-- CATEGORY 2: SECURITY -->',
  },
  security: {
    eyebrowClass: 'eyebrow-red',
    icon: 'ti-lock-open',
    label: 'Security failures',
    h2: 'Agents with access are agents with attack surface.',
    intro: 'Shell access, file system access, and network egress are necessary for capable agents. Without governance they become the attack surface.',
    commentStart: '<!-- CATEGORY 2: SECURITY -->',
    commentEnd: '<!-- CATEGORY 3: BRAND DAMAGE -->',
  },
  brand: {
    eyebrowClass: 'eyebrow-amber',
    icon: 'ti-brand-x',
    label: 'Brand damage',
    h2: 'Public-facing AI requires one bad prompt to go viral.',
    intro: 'Every unguarded public AI is one adversarial user away from a 24-hour news cycle. Content policy enforcement and human-in-the-loop review for binding outputs are not optional at scale.',
    commentStart: '<!-- CATEGORY 3: BRAND DAMAGE -->',
    commentEnd: '<!-- CATEGORY 4: LEGAL LIABILITY -->',
  },
  legal: {
    eyebrowClass: 'eyebrow-amber',
    icon: 'ti-gavel',
    label: 'Legal and compliance liability',
    h2: 'Courts hold companies responsible for what their AI says.',
    intro: 'The "chatbot did it" defense has failed in court. GDPR fines for unmonitored AI-driven data exfiltration reach 4% of global annual turnover. Precedents are being set now.',
    commentStart: '<!-- CATEGORY 4: LEGAL LIABILITY -->',
    commentEnd: '<!-- SCOUT ANSWER TABLE -->',
  },
};

const CATEGORY_ORDER: IncidentCategory[] = ['financial', 'security', 'brand', 'legal'];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIncident(incident: BlogIncident): string {
  const sources = incident.sources.length
    ? incident.sources
        .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.label)}</a>`)
        .join(' | ')
    : 'No source linked';
  return `
    <article class="ir-incident" id="${escapeHtml(incident.slug)}">
      <header class="ir-incident-header">
        <div>
          <span class="ir-incident-company">${escapeHtml(incident.company)}</span>
          <span class="ir-incident-damage">${escapeHtml(incident.damage)}</span>
        </div>
        <span class="ir-incident-date">${escapeHtml(incident.dateOccurred)}</span>
      </header>
      <p class="ir-incident-body">${incident.bodyHtml}</p>
      <footer class="ir-incident-footer">
        <span class="ir-incident-source">Source: ${sources}</span>
        <span class="ir-scout-fix">Scout fix: ${incident.scoutFixHtml}</span>
      </footer>
    </article>`;
}

function renderCategorySection(meta: typeof CATEGORY_META[IncidentCategory], incidents: BlogIncident[]): string {
  return `
${meta.commentStart}
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow ${meta.eyebrowClass}">
      <i class="ti ${meta.icon}"></i>
      ${meta.label}
    </div>
    <h2>${meta.h2}</h2>
    <p class="ir-category-intro">${meta.intro}</p>
    ${incidents.map(renderIncident).join('\n')}
  </section>
</div>
${meta.commentEnd}`;
}

function renderPage(incidents: BlogIncident[]): string {
  const count = incidents.length;
  const byCategory = new Map<IncidentCategory, BlogIncident[]>();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const incident of incidents) {
    const bucket = byCategory.get(incident.category);
    if (bucket) bucket.push(incident);
  }

  const categorySections = CATEGORY_ORDER
    .filter((cat) => (byCategory.get(cat)?.length ?? 0) > 0)
    .map((cat) => renderCategorySection(CATEGORY_META[cat], byCategory.get(cat) ?? []))
    .join('\n');

  const emptyPlaceholder = count === 0 ? `
<div class="container">
  <section class="ir-category">
    <div class="ir-category-eyebrow eyebrow-red"><i class="ti ti-clock"></i> Pending</div>
    <h2>No published incidents yet.</h2>
    <p class="ir-category-intro">Publish an incident from Carina or the admin panel and it will appear here.</p>
  </section>
</div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#06090f">
  <title>The AI Agent Incident Record - Labyrinth Scout</title>
  <meta name="description" content="${count} documented incidents where AI agents without oversight caused real financial, security, and brand damage. Sourced, dated, and linked.">
  <meta property="og:title" content="The AI Agent Incident Record">
  <meta property="og:description" content="$500M in one month. 13-hour cloud outage. rm -rf on production. These are not predictions. They happened.">
  <meta property="og:url" content="https://labyrinthscout.com/incidents/">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <link rel="icon" href="/assets/pwa/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/pwa/favicon.ico" sizes="any">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #06090f; --bg-lift: #0c1118; --bg-card: #111722;
      --border: rgba(255,255,255,0.07); --border-mid: rgba(255,255,255,0.12);
      --green: #16c97e; --green-dim: rgba(22,201,126,0.12);
      --red: #e63946; --amber-warn: #f59e0b;
      --text-primary: #f0f4f8; --text-mid: #8a9bb0; --text-dim: #4d6070;
      --ff-sans: 'Inter', system-ui, sans-serif;
      --r: 6px; --r-md: 10px; --r-lg: 16px;
      --transition: 200ms cubic-bezier(0.4,0,0.2,1);
    }
    html { scroll-behavior: smooth; overflow-x: clip; }
    body { font-family: var(--ff-sans); background: var(--bg); color: var(--text-primary); line-height: 1.65; overflow-x: clip; }
    .container { max-width: 860px; margin: 0 auto; padding: 0 1.5rem; }
    nav { position: fixed; top: 0; left: 0; right: 0; z-index: 200; height: 60px; background: rgba(6,9,15,0.90); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); }
    .nav-inner { height: 100%; display: flex; align-items: center; justify-content: space-between; max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
    .nav-logo { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); text-decoration: none; }
    .nav-logo span { color: var(--green); }
    .nav-right { display: flex; align-items: center; gap: 1.5rem; }
    .nav-right a { font-size: 0.8125rem; color: var(--text-mid); text-decoration: none; transition: color var(--transition); }
    .nav-right a:hover { color: var(--text-primary); }
    .nav-right .nav-cta { background: var(--green); color: #06090f; padding: 0.4rem 1rem; border-radius: var(--r); font-weight: 600; }
    .nav-right .nav-cta:hover { opacity: 0.88; color: #06090f; }
    @media (max-width: 600px) { .nav-right { gap: 1rem; } .nav-right a:not(.nav-cta) { display: none; } }
    .ir-hero { padding: 8rem 0 4rem; border-bottom: 1px solid var(--border); }
    .ir-eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--red); font-weight: 600; padding: 0.3rem 0.75rem; border: 1px solid rgba(230,57,70,0.25); border-radius: 999px; background: rgba(230,57,70,0.06); margin-bottom: 1.75rem; }
    .ir-hero h1 { font-size: clamp(2rem, 4.5vw, 3rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.08; color: var(--text-primary); margin-bottom: 1.25rem; }
    .ir-hero h1 span { color: var(--red); }
    .ir-hero-sub { font-size: 1rem; color: var(--text-mid); max-width: 560px; line-height: 1.7; margin-bottom: 2rem; }
    .ir-source-note { font-size: 0.75rem; color: var(--text-dim); max-width: 600px; line-height: 1.6; padding: 0.85rem 1.1rem; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--bg-card); }
    .ir-stats { display: grid; grid-template-columns: repeat(4, 1fr); border-radius: var(--r-lg); border: 1px solid var(--border); overflow: hidden; margin: 3rem 0; }
    @media (max-width: 700px) { .ir-stats { grid-template-columns: repeat(2, 1fr); } }
    .ir-stat { padding: 1.35rem 1.25rem; border-right: 1px solid var(--border); background: var(--bg-card); }
    .ir-stat:last-child { border-right: none; }
    @media (max-width: 700px) { .ir-stat:nth-child(2) { border-right: none; } .ir-stat:nth-child(3) { border-top: 1px solid var(--border); } .ir-stat:nth-child(4) { border-right: none; border-top: 1px solid var(--border); } }
    .ir-stat-value { font-size: 1.65rem; font-weight: 700; letter-spacing: -0.03em; color: var(--red); line-height: 1; margin-bottom: 0.3rem; }
    .ir-stat-label { font-size: 0.73rem; color: var(--text-dim); line-height: 1.4; }
    .ir-category { padding: 3.5rem 0; border-bottom: 1px solid var(--border); }
    .ir-category-eyebrow { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.67rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; padding: 0.25rem 0.65rem; border-radius: 999px; margin-bottom: 1.25rem; }
    .eyebrow-red { color: var(--red); border: 1px solid rgba(230,57,70,0.25); background: rgba(230,57,70,0.06); }
    .eyebrow-amber { color: var(--amber-warn); border: 1px solid rgba(245,158,11,0.25); background: rgba(245,158,11,0.06); }
    .eyebrow-green { color: var(--green); border: 1px solid rgba(22,201,126,0.25); background: rgba(22,201,126,0.06); }
    .ir-category h2 { font-size: 1.55rem; font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; color: var(--text-primary); margin-bottom: 0.6rem; }
    .ir-category-intro { font-size: 0.9rem; color: var(--text-mid); max-width: 540px; line-height: 1.65; margin-bottom: 2rem; }
    .ir-incident { border-radius: var(--r-lg); background: var(--bg-card); border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1rem; transition: border-color var(--transition); }
    .ir-incident:hover { border-color: var(--border-mid); }
    .ir-incident:last-child { margin-bottom: 0; }
    .ir-incident-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.85rem; }
    .ir-incident-company { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-dim); display: block; margin-bottom: 0.25rem; }
    .ir-incident-damage { font-size: 1.15rem; font-weight: 700; color: var(--red); letter-spacing: -0.02em; line-height: 1.1; display: block; }
    .ir-incident-date { font-size: 0.72rem; color: var(--text-dim); white-space: nowrap; flex-shrink: 0; margin-top: 0.15rem; }
    .ir-incident-body { font-size: 0.88rem; color: var(--text-mid); line-height: 1.65; margin-bottom: 1rem; }
    .ir-incident-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding-top: 0.85rem; border-top: 1px solid var(--border); }
    .ir-incident-source { font-size: 0.72rem; color: var(--text-dim); flex: 1; min-width: 160px; }
    .ir-incident-source a { color: var(--text-dim); text-decoration: none; transition: color var(--transition); }
    .ir-incident-source a:hover { color: var(--text-mid); }
    .ir-scout-fix { font-size: 0.72rem; color: var(--green); font-weight: 500; display: flex; align-items: flex-start; gap: 0.3rem; flex: 1; min-width: 160px; }
    .ir-scout-fix::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; margin-top: 0.35rem; }
    .ir-answer-section { padding: 3.5rem 0; border-top: 1px solid rgba(22,201,126,0.15); border-bottom: 1px solid var(--border); }
    .ir-answer-table { width: 100%; border-collapse: collapse; border-radius: var(--r-lg); overflow: hidden; margin-top: 2rem; font-size: 0.82rem; }
    .ir-answer-table th { padding: 0.85rem 1rem; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; text-align: left; }
    .ir-answer-table th:first-child { background: rgba(255,255,255,0.03); color: var(--text-dim); border: 1px solid var(--border); border-right: none; width: 30%; }
    .ir-answer-table th:nth-child(2) { background: rgba(230,57,70,0.06); color: var(--red); border: 1px solid rgba(230,57,70,0.15); border-right: none; width: 32%; }
    .ir-answer-table th:last-child { background: rgba(22,201,126,0.08); color: var(--green); border: 1px solid rgba(22,201,126,0.2); width: 38%; }
    .ir-answer-table td { padding: 0.75rem 1rem; border-left: 1px solid; border-right: 1px solid; vertical-align: top; line-height: 1.5; }
    .ir-answer-table tr:not(:last-child) td { border-bottom: 1px solid; }
    .ir-answer-table tr:last-child td { border-bottom: 1px solid; }
    .ir-answer-table td:first-child { color: var(--text-mid); border-color: var(--border); background: rgba(255,255,255,0.01); }
    .ir-answer-table td:nth-child(2) { color: rgba(230,57,70,0.85); font-size: 0.78rem; border-color: rgba(230,57,70,0.12); background: rgba(230,57,70,0.03); }
    .ir-answer-table td:last-child { color: var(--text-primary); font-weight: 500; border-color: rgba(22,201,126,0.12); background: rgba(22,201,126,0.03); font-size: 0.78rem; }
    .ir-answer-table tr:last-child td:first-child { border-bottom-color: var(--border); }
    .ir-answer-table tr:last-child td:nth-child(2) { border-bottom-color: rgba(230,57,70,0.12); }
    .ir-answer-table tr:last-child td:last-child { border-bottom-color: rgba(22,201,126,0.12); }
    @media (max-width: 640px) { .ir-answer-table { display: block; overflow-x: auto; } }
    .ir-subscribe { padding: 3rem 0; border-bottom: 1px solid var(--border); text-align: center; }
    .ir-subscribe h3 { font-size: 1.2rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    .ir-subscribe p { font-size: 0.88rem; color: var(--text-mid); margin-bottom: 1.5rem; }
    .ir-subscribe-form { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; max-width: 460px; margin: 0 auto; }
    .ir-subscribe-form input[type="email"] { flex: 1; min-width: 200px; padding: 0.75rem 1rem; border-radius: var(--r-md); border: 1px solid var(--border-mid); background: var(--bg-lift); color: var(--text-primary); font-family: var(--ff-sans); font-size: 0.88rem; }
    .ir-subscribe-form input[type="email"]:focus { outline: none; border-color: var(--green); }
    .ir-subscribe-message { min-height: 1.4em; font-size: 0.82rem; color: var(--text-mid); margin-top: 0.75rem; }
    .ir-cta { padding: 5rem 0; text-align: center; }
    .ir-cta h2 { font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 700; letter-spacing: -0.025em; line-height: 1.1; margin-bottom: 1rem; }
    .ir-cta p { font-size: 0.95rem; color: var(--text-mid); max-width: 420px; margin: 0 auto 2.25rem; line-height: 1.7; }
    .ir-cta-actions { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; }
    .btn-primary { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--green); color: #06090f; padding: 0.75rem 1.5rem; border-radius: var(--r-md); font-size: 0.9rem; font-weight: 600; text-decoration: none; border: none; cursor: pointer; font-family: var(--ff-sans); transition: opacity var(--transition), transform var(--transition); }
    .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); color: #06090f; }
    .btn-secondary { display: inline-flex; align-items: center; gap: 0.5rem; background: transparent; color: var(--text-mid); padding: 0.75rem 1.5rem; border-radius: var(--r-md); font-size: 0.9rem; font-weight: 500; text-decoration: none; border: 1px solid var(--border-mid); transition: color var(--transition), border-color var(--transition); }
    .btn-secondary:hover { color: var(--text-primary); border-color: var(--green); }
    .ir-methodology { padding: 2rem 0; border-top: 1px solid var(--border); }
    .ir-methodology p { font-size: 0.73rem; color: var(--text-dim); line-height: 1.7; max-width: 680px; }
    .ir-methodology strong { color: var(--text-mid); }
    .ir-footer { border-top: 1px solid var(--border); padding: 1.5rem 0 2.5rem; }
    .ir-footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; font-size: 0.75rem; color: var(--text-dim); }
    .ir-footer-links { display: flex; gap: 1.5rem; }
    .ir-footer-links a { color: var(--text-dim); text-decoration: none; transition: color var(--transition); }
    .ir-footer-links a:hover { color: var(--text-mid); }
  </style>
</head>
<body>

<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">Scout<span>.</span></a>
    <div class="nav-right">
      <a href="/">Home</a>
      <a href="/#governance">Governance</a>
      <a href="/#pricing">Pricing</a>
      <a href="https://carinaai.uk">Carina</a>
      <a href="/#pricing" class="nav-cta">Get Scout</a>
    </div>
  </div>
</nav>

<div class="ir-hero">
  <div class="container">
    <div class="ir-eyebrow"><i class="ti ti-alert-triangle"></i> Documented damage</div>
    <h1>The AI Agent<br><span>Incident Record.</span></h1>
    <p class="ir-hero-sub">${count} documented incidents where AI agents operating without oversight caused real financial, security, and brand damage. Every claim is sourced. Every source is linked. No hyperbole required.</p>
    <div class="ir-source-note">Sources: The Guardian, Bloomberg, Ars Technica, Forbes, BBC, Docker, OWASP, Axios. The $500M and Uber budget claims originate from a single Axios article citing unnamed sources and should be treated as reported, not independently verified. Full methodology at the bottom of this page.</div>
  </div>
</div>

<div class="container">
  <div class="ir-stats">
    <div class="ir-stat"><div class="ir-stat-value">$500M+</div><div class="ir-stat-label">single-incident financial loss, reported May 2026</div></div>
    <div class="ir-stat"><div class="ir-stat-value">13 hrs</div><div class="ir-stat-label">AWS downtime from one AI coding agent, 2025</div></div>
    <div class="ir-stat"><div class="ir-stat-value">1,000+</div><div class="ir-stat-label">incidents in the public AI Incident Database</div></div>
    <div class="ir-stat"><div class="ir-stat-value">#1</div><div class="ir-stat-label">Prompt Injection -- OWASP LLM Top 10, two editions running</div></div>
  </div>
</div>

${count === 0 ? emptyPlaceholder : categorySections}

<!-- SCOUT ANSWER TABLE -->
<div class="container">
  <section class="ir-answer-section">
    <div class="ir-category-eyebrow eyebrow-green"><i class="ti ti-shield-bolt"></i> The Scout answer</div>
    <h2 style="font-size:1.55rem;font-weight:700;letter-spacing:-0.025em;line-height:1.1;color:var(--text-primary);margin-bottom:0.6rem;">What Scout would have done.</h2>
    <p style="font-size:0.88rem;color:var(--text-mid);max-width:520px;line-height:1.65;">Every incident above was preventable with controls Scout provides. This is not retrofitting. It is exactly what Scout was designed to enforce.</p>
    <table class="ir-answer-table">
      <thead>
        <tr>
          <th>Incident</th>
          <th>Why it happened</th>
          <th>Scout prevention</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>$500M Claude bill</td><td>No spending caps, no agent budget controls</td><td>Per-agent quotas, real-time usage dashboard, threshold alerts</td></tr>
        <tr><td>13-hour AWS outage</td><td>Agent ran with full human-level permissions, no approval gate</td><td>Dangerous operation detection, approval gates, permission scoping</td></tr>
        <tr><td>rm -rf filesystem destruction</td><td>Unchecked shell execution, no command classification</td><td>Command flagging intercepts DANGER operations before execution</td></tr>
        <tr><td>Samsung source code leak</td><td>No egress filtering, data sent to external provider</td><td>Egress filtering keeps data inside your infrastructure</td></tr>
        <tr><td>Air Canada hallucinated policy</td><td>No output validation, no human-in-loop for binding outputs</td><td>Output validation, human-in-loop flag for commitment-generating responses</td></tr>
        <tr><td>DPD and Chevy brand meltdowns</td><td>No content policy enforcement on public-facing AI</td><td>Prompt guard, content policy, operator-defined output rules</td></tr>
        <tr><td>Bing Chat prompt injection</td><td>Injection bypassed system prompt, no gateway-level defense</td><td>Prompt guard middleware intercepts injection at the gateway</td></tr>
        <tr><td>GDPR silent breach exposure</td><td>No egress control, no audit trail for breach notification</td><td>Egress filtering plus full audit log provides breach evidence and compliance posture</td></tr>
      </tbody>
    </table>
  </section>
</div>

<div class="container">
  <section class="ir-subscribe">
    <h3>Get the weekly incident report.</h3>
    <p>New AI agent incidents, documented and sourced, every week. One email. No spam.</p>
    <form class="ir-subscribe-form" id="subscribe-form">
      <input type="email" id="subscribe-email" name="email" placeholder="your@email.com" required>
      <button type="submit" class="btn-primary">Subscribe</button>
    </form>
    <p class="ir-subscribe-message" id="subscribe-message"></p>
  </section>
</div>

<div class="container">
  <section class="ir-cta">
    <h2>Nobody was watching.<br>Scout is the watching.</h2>
    <p>From £49/mo. Pre-wired for Carina. Connects to any agent stack via API. One config value to enable.</p>
    <div class="ir-cta-actions">
      <a href="https://labyrinthscout.com/#pricing" class="btn-primary"><i class="ti ti-shield-lock"></i> See Scout pricing</a>
      <a href="https://carinaai.uk" class="btn-secondary"><i class="ti ti-sparkles"></i> Start with Carina free</a>
    </div>
  </section>
</div>

<div class="container">
  <div class="ir-methodology">
    <p><strong>Methodology.</strong> All incidents verified via published press sources (Ars Technica, BBC, Bloomberg, Business Insider, Docker, Forbes, The Guardian, NPR, The Register, Tom's Hardware). Academic papers verified via arXiv. OWASP data verified via genai.owasp.org. The $500M and Uber budget claims originate from a single Axios article citing unnamed sources; both are presented as reported rather than independently verified. Reddit and developer forum posts were reviewed for pattern evidence but are not cited as primary sources for individual incidents. AI Incident Database: incidentdatabase.ai. GDPR citation: Regulation (EU) 2016/679, Articles 33 and 83. Page generated ${new Date().toISOString().slice(0, 10)}.</p>
  </div>
</div>

<footer class="ir-footer">
  <div class="container">
    <div class="ir-footer-inner">
      <span>Labyrinth Scout. A VERLOX product.</span>
      <div class="ir-footer-links">
        <a href="https://labyrinthscout.com">Home</a>
        <a href="https://labyrinthscout.com/#pricing">Pricing</a>
        <a href="https://carinaai.uk">Carina</a>
        <a href="https://docs.carinaai.uk">Docs</a>
      </div>
      <span>Research compiled June 2026.</span>
    </div>
  </div>
</footer>

<script>
  (function () {
    var form = document.getElementById('subscribe-form');
    var message = document.getElementById('subscribe-message');
    var params = new URLSearchParams(window.location.search);
    if (message) {
      if (params.has('subscribed')) message.textContent = 'Subscription confirmed.';
      if (params.has('unsubscribed')) message.textContent = 'You have been unsubscribed.';
      if (params.has('error')) message.textContent = 'There was a problem with that link.';
    }
    if (!form) return;
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var input = document.getElementById('subscribe-email');
      var email = String(input && input.value ? input.value : '').trim();
      if (!email || !message) return;
      try {
        var response = await fetch('https://app.carinaai.uk/api/incident-blog/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, source: 'labyrinthscout.com/incidents' }),
        });
        var payload = await response.json();
        message.textContent = payload.message || 'Check your email to confirm your subscription.';
        form.reset();
      } catch (err) {
        message.textContent = 'Something went wrong. Try again.';
      }
    });
  })();
</script>

</body>
</html>`;
}

export async function generateIncidentPage(): Promise<{ path: string; incidentCount: number }> {
  await ensureIncidentBlogSchema();
  const incidents = await getPublishedIncidents();
  try {
    const current = await fs.readFile(OUTPUT_PATH, 'utf8');
    if (incidents.length === 0 && current) {
      return { path: OUTPUT_PATH, incidentCount: 0 };
    }
  } catch {
    // output file missing, proceed to write
  }
  const html = renderPage(incidents);
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(TEMP_PATH, html, 'utf8');
  await fs.rename(TEMP_PATH, OUTPUT_PATH);
  return { path: OUTPUT_PATH, incidentCount: incidents.length };
}
