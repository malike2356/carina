import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureIncidentBlogSchema, ensurePublishedIncidentSeed, getPublishedIncidents } from './store.js';
import type { BlogIncident } from './types.js';
import {
  archiveYearHref,
  categoryLabel,
  excerptFromHtml,
  groupIncidentsByYear,
  incidentHref,
  INCIDENTS_PER_PAGE,
  listPageHref,
  paginateIncidents,
  sortPublishedIncidents,
} from './page-utils.js';

const coreRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUTPUT_BASES = [
  path.join(coreRoot, 'labyrinthscout.com', 'incidents'),
  path.join(coreRoot, '..', '..', 'frontends', 'marketing', 'labyrinthscout.com', 'incidents'),
];

function resolveOutputBases(): string[] {
  const envBase = process.env.INCIDENT_BLOG_OUTPUT_DIR?.trim();
  const bases = envBase
    ? [path.join(envBase, 'incidents'), ...DEFAULT_OUTPUT_BASES]
    : DEFAULT_OUTPUT_BASES;
  return [...new Set(bases.map((entry) => path.resolve(entry)))];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sharedStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #06090f; --bg-lift: #0c1118; --bg-card: #111722;
      --border: rgba(255,255,255,0.07); --border-mid: rgba(255,255,255,0.12);
      --green: #16c97e; --green-dim: rgba(22,201,126,0.12);
      --red: #e63946; --amber-warn: #f59e0b;
      --text-primary: #f0f4f8; --text-mid: #8a9bb0; --text-dim: #4d6070;
      --ff-sans: 'Inter', system-ui, sans-serif;
      --r: 6px; --r-md: 10px; --r-lg: 14px;
      --transition: 200ms cubic-bezier(0.4,0,0.2,1);
    }
    html { scroll-behavior: smooth; overflow-x: clip; }
    body { font-family: var(--ff-sans); background: var(--bg); color: var(--text-primary); line-height: 1.6; overflow-x: clip; }
    .container { max-width: 760px; margin: 0 auto; padding: 0 1.25rem; }
    .ir-site-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 200; height: 56px; background: rgba(6,9,15,0.92); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
    .ir-site-nav .nav-inner { height: 100%; display: flex; align-items: center; justify-content: space-between; max-width: 960px; margin: 0 auto; padding: 0 1.25rem; }
    .ir-site-nav .nav-logo { font-size: 1rem; font-weight: 600; color: var(--text-primary); text-decoration: none; letter-spacing: -0.01em; }
    .ir-site-nav .nav-logo span { color: var(--green); }
    .ir-site-nav .nav-links { display: flex; align-items: center; gap: 1.25rem; }
    .ir-site-nav .nav-links a { font-size: 0.8125rem; color: var(--text-mid); text-decoration: none; transition: color var(--transition); }
    .ir-site-nav .nav-links a:hover, .ir-site-nav .nav-links a.is-active { color: var(--text-primary); }
    .ir-site-nav .nav-links a.nav-cta { background: var(--green); color: #06090f; padding: 0.38rem 0.9rem; border-radius: var(--r); font-weight: 600; }
    .ir-site-nav .nav-links a.nav-cta:hover { opacity: 0.9; color: #06090f; }
    @media (max-width: 720px) { .ir-site-nav .nav-links a.nav-hide-sm { display: none; } }
    .ir-hero-slim { padding: 5.5rem 0 1.75rem; border-bottom: 1px solid var(--border); }
    .ir-hero-compact { padding: 5.5rem 0 1.5rem; border-bottom: 1px solid var(--border); }
    .ir-kicker { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.65rem; }
    .ir-hero-slim h1, .ir-hero-compact h1 { font-size: clamp(1.75rem, 3.5vw, 2.35rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 0.65rem; }
    .ir-hero-lead { font-size: 0.95rem; color: var(--text-mid); max-width: 540px; line-height: 1.65; }
    .ir-hero-stats { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border); }
    .ir-hero-stat { min-width: 120px; }
    .ir-hero-stat-value { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }
    .ir-hero-stat-label { font-size: 0.72rem; color: var(--text-dim); margin-top: 0.15rem; max-width: 160px; line-height: 1.4; }
    .ir-main { padding: 1.75rem 0 3rem; }
    .ir-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem 1rem; margin-bottom: 1.25rem; }
    .ir-toolbar h2 { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; color: var(--text-primary); }
    .ir-toolbar-meta { font-size: 0.78rem; color: var(--text-dim); }
    .ir-archive-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; }
    .ir-archive-bar-label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-dim); margin-right: 0.25rem; }
    .ir-chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.7rem; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-mid); font-size: 0.78rem; text-decoration: none; transition: border-color var(--transition), color var(--transition); }
    .ir-chip:hover { border-color: var(--border-mid); color: var(--text-primary); }
    .ir-chip.is-active { border-color: rgba(22,201,126,0.35); color: var(--green); background: rgba(22,201,126,0.06); }
    .ir-feed { border: 1px solid var(--border); border-radius: var(--r-lg); overflow: hidden; background: var(--bg-card); }
    .ir-entry { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.1rem; text-decoration: none; color: inherit; border-bottom: 1px solid var(--border); transition: background var(--transition); }
    .ir-entry:last-child { border-bottom: none; }
    .ir-entry:hover { background: rgba(255,255,255,0.02); }
    .ir-entry-main { flex: 1; min-width: 0; }
    .ir-entry-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem 0.65rem; margin-bottom: 0.35rem; font-size: 0.72rem; color: var(--text-dim); }
    .ir-badge { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; padding: 0.15rem 0.45rem; border-radius: 999px; border: 1px solid var(--border-mid); color: var(--text-mid); }
    .ir-badge.financial, .ir-badge.security { color: #f08a93; border-color: rgba(230,57,70,0.22); }
    .ir-badge.brand, .ir-badge.legal { color: #d4a056; border-color: rgba(245,158,11,0.22); }
    .ir-entry-title { font-size: 0.98rem; font-weight: 600; letter-spacing: -0.015em; line-height: 1.35; color: var(--text-primary); margin-bottom: 0.2rem; }
    .ir-entry-damage { font-size: 0.82rem; color: var(--text-mid); line-height: 1.45; }
    .ir-entry-arrow { flex-shrink: 0; color: var(--text-dim); font-size: 1rem; transition: color var(--transition), transform var(--transition); }
    .ir-entry:hover .ir-entry-arrow { color: var(--green); transform: translateX(2px); }
    .ir-empty { padding: 2rem 1.1rem; color: var(--text-mid); font-size: 0.9rem; }
    .ir-pagination-wrap { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .ir-pagination-label { font-size: 0.78rem; color: var(--text-dim); }
    .ir-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
    .ir-page-link, .ir-page-current { min-width: 2rem; text-align: center; padding: 0.4rem 0.65rem; border-radius: var(--r); font-size: 0.8rem; text-decoration: none; border: 1px solid transparent; }
    .ir-page-link { color: var(--text-mid); border-color: var(--border); background: var(--bg-card); transition: border-color var(--transition), color var(--transition); }
    .ir-page-link:hover { color: var(--text-primary); border-color: var(--border-mid); }
    .ir-page-current { color: var(--text-primary); background: rgba(22,201,126,0.08); border-color: rgba(22,201,126,0.25); font-weight: 600; }
    .ir-breadcrumb { padding-top: 5.5rem; font-size: 0.78rem; color: var(--text-dim); }
    .ir-breadcrumb a { color: var(--text-mid); text-decoration: none; }
    .ir-breadcrumb a:hover { color: var(--green); }
    .ir-article { padding: 1.25rem 0 2.5rem; }
    .ir-article-header { margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
    .ir-article-company { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-dim); display: block; margin: 0.5rem 0 0.35rem; }
    .ir-article-title { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.12; margin-bottom: 0.45rem; }
    .ir-article-damage { font-size: 1rem; font-weight: 600; color: #f08a93; margin-bottom: 0.5rem; }
    .ir-article-meta { font-size: 0.78rem; color: var(--text-dim); }
    .ir-article-body { font-size: 0.94rem; color: var(--text-mid); line-height: 1.75; margin-bottom: 1.25rem; }
    .ir-article-body p { margin-bottom: 0.85rem; }
    .ir-article-scout { border-radius: var(--r-lg); border: 1px solid rgba(22,201,126,0.18); background: rgba(22,201,126,0.04); padding: 0.95rem 1rem; margin-bottom: 1rem; }
    .ir-article-scout-label { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--green); margin-bottom: 0.35rem; }
    .ir-article-scout-body { font-size: 0.86rem; color: var(--text-primary); line-height: 1.6; }
    .ir-article-sources { font-size: 0.78rem; color: var(--text-dim); }
    .ir-article-sources a { color: var(--text-mid); text-decoration: none; }
    .ir-article-sources a:hover { color: var(--green); }
    .ir-article-nav { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 1.25rem; }
    .ir-subscribe-compact { margin-top: 2.5rem; padding: 1.25rem 0; border-top: 1px solid var(--border); }
    .ir-subscribe-compact h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.35rem; }
    .ir-subscribe-compact p { font-size: 0.82rem; color: var(--text-mid); margin-bottom: 0.85rem; }
    .ir-subscribe-form { display: flex; gap: 0.65rem; flex-wrap: wrap; max-width: 420px; }
    .ir-subscribe-form input[type="email"] { flex: 1; min-width: 180px; padding: 0.65rem 0.85rem; border-radius: var(--r-md); border: 1px solid var(--border-mid); background: var(--bg-lift); color: var(--text-primary); font-family: var(--ff-sans); font-size: 0.85rem; }
    .ir-subscribe-form input[type="email"]:focus { outline: none; border-color: var(--green); }
    .ir-subscribe-message { min-height: 1.2em; font-size: 0.78rem; color: var(--text-mid); margin-top: 0.55rem; }
    .btn-primary, .btn-secondary { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.65rem 1.1rem; border-radius: var(--r-md); font-size: 0.85rem; font-weight: 600; text-decoration: none; font-family: var(--ff-sans); transition: opacity var(--transition), color var(--transition), border-color var(--transition); }
    .btn-primary { background: var(--green); color: #06090f; border: none; cursor: pointer; }
    .btn-primary:hover { opacity: 0.9; color: #06090f; }
    .btn-secondary { background: transparent; color: var(--text-mid); border: 1px solid var(--border-mid); }
    .btn-secondary:hover { color: var(--text-primary); border-color: var(--green); }
    .ir-footer { border-top: 1px solid var(--border); padding: 1.25rem 0 2rem; margin-top: 1rem; }
    .ir-footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; font-size: 0.72rem; color: var(--text-dim); }
    .ir-footer-links { display: flex; gap: 1rem; }
    .ir-footer-links a { color: var(--text-dim); text-decoration: none; }
    .ir-footer-links a:hover { color: var(--text-mid); }
    .ir-method-note { margin-top: 1rem; font-size: 0.72rem; color: var(--text-dim); line-height: 1.55; }
  `;
}

function renderNav(active: 'incidents' | 'archive' = 'incidents'): string {
  const incidentsClass = active === 'incidents' ? ' class="is-active"' : '';
  const archiveClass = active === 'archive' ? ' class="is-active"' : '';
  return `
<nav class="ir-site-nav" aria-label="Site">
  <div class="nav-inner">
    <a href="/" class="nav-logo" title="Back to Labyrinth Scout home">Scout<span>.</span></a>
    <div class="nav-links">
      <a href="/">Home</a>
      <a href="/incidents/"${incidentsClass}>Incidents</a>
      <a href="/incidents/archive/"${archiveClass}>Archive</a>
      <a href="/#pricing" class="nav-hide-sm">Pricing</a>
      <a href="https://carinaai.uk" class="nav-hide-sm">Carina</a>
      <a href="/#pricing" class="nav-cta">Get Scout</a>
    </div>
  </div>
</nav>`;
}

function renderFooter(): string {
  return `
<footer class="ir-footer">
  <div class="container">
    <div class="ir-footer-inner">
      <span>Labyrinth Scout. A VERLOX product.</span>
      <div class="ir-footer-links">
        <a href="https://labyrinthscout.com">Home</a>
        <a href="https://labyrinthscout.com/incidents/">Incidents</a>
        <a href="https://labyrinthscout.com/incidents/archive/">Archive</a>
        <a href="https://carinaai.uk">Carina</a>
      </div>
      <span>Research compiled June 2026.</span>
    </div>
  </div>
</footer>`;
}

function renderSubscribeBlock(): string {
  return `
<section class="ir-subscribe-compact">
  <h3>Weekly incident report</h3>
  <p>New sourced incidents by email. One message per week.</p>
  <form class="ir-subscribe-form" id="subscribe-form">
    <input type="email" id="subscribe-email" name="email" placeholder="your@email.com" required>
    <button type="submit" class="btn-primary">Subscribe</button>
  </form>
  <p class="ir-subscribe-message" id="subscribe-message"></p>
</section>`;
}

function renderSubscribeScript(): string {
  return `
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
</script>`;
}

function renderPageShell(title: string, description: string, canonical: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#06090f">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <link rel="icon" href="/assets/pwa/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/pwa/favicon.ico" sizes="any">
  <style>${sharedStyles()}</style>
</head>
<body>
${body}
${renderSubscribeScript()}
</body>
</html>`;
}

function renderBlogCard(incident: BlogIncident): string {
  return `
<a class="ir-entry" href="${incidentHref(incident.slug)}">
  <div class="ir-entry-main">
    <div class="ir-entry-meta">
      <span class="ir-badge ${incident.category}">${categoryLabel(incident.category)}</span>
      <span>${escapeHtml(incident.dateOccurred)}</span>
    </div>
    <div class="ir-entry-title">${escapeHtml(incident.title)}</div>
    <div class="ir-entry-damage">${escapeHtml(incident.damage)}</div>
  </div>
  <span class="ir-entry-arrow" aria-hidden="true">→</span>
</a>`;
}

function renderPagination(currentPage: number, totalPages: number): string {
  if (totalPages <= 1) return '';
  const links: string[] = [];
  if (currentPage > 1) {
    links.push(`<a class="ir-page-link" href="${listPageHref(currentPage - 1)}">Prev</a>`);
  }
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === currentPage) {
      links.push(`<span class="ir-page-current">${page}</span>`);
    } else {
      links.push(`<a class="ir-page-link" href="${listPageHref(page)}">${page}</a>`);
    }
  }
  if (currentPage < totalPages) {
    links.push(`<a class="ir-page-link" href="${listPageHref(currentPage + 1)}">Next</a>`);
  }
  return `
<div class="ir-pagination-wrap">
  <div class="ir-pagination-label">Page ${currentPage} of ${totalPages}</div>
  <div class="ir-pagination" role="navigation" aria-label="Incident pages">${links.join('')}</div>
</div>`;
}

function renderArchiveBar(grouped: Map<string, BlogIncident[]>, activeYear?: string): string {
  const years = [...grouped.keys()].sort((a, b) => Number(b) - Number(a));
  if (!years.length) return '';
  const chips = years.slice(0, 6).map((year) => {
    const active = activeYear === year ? ' is-active' : '';
    return `<a class="ir-chip${active}" href="${archiveYearHref(year)}">${year} <span>${grouped.get(year)?.length ?? 0}</span></a>`;
  }).join('');
  return `
<div class="ir-archive-bar">
  <span class="ir-archive-bar-label">Archive</span>
  ${chips}
  <a class="ir-chip" href="/incidents/archive/">All years</a>
</div>`;
}

function renderHero(count: number): string {
  return `
<section class="ir-hero-slim">
  <div class="container">
    <div class="ir-kicker">Documented damage</div>
    <h1>The AI Agent Incident Record</h1>
    <p class="ir-hero-lead">${count} sourced incidents where ungoverned AI agents caused financial, security, brand, or legal harm.</p>
    <div class="ir-hero-stats">
      <div class="ir-hero-stat"><div class="ir-hero-stat-value">${count}</div><div class="ir-hero-stat-label">incidents in this record</div></div>
      <div class="ir-hero-stat"><div class="ir-hero-stat-value">$500M+</div><div class="ir-hero-stat-label">largest reported single-incident loss</div></div>
      <div class="ir-hero-stat"><div class="ir-hero-stat-value">13 hrs</div><div class="ir-hero-stat-label">AWS outage from one coding agent</div></div>
    </div>
  </div>
</section>`;
}

function renderCompactHeader(title: string, subtitle: string): string {
  return `
<section class="ir-hero-compact">
  <div class="container">
    <div class="ir-kicker">Incident Record</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="ir-hero-lead">${escapeHtml(subtitle)}</p>
  </div>
</section>`;
}

function renderListPage(options: {
  incidents: BlogIncident[];
  allIncidents: BlogIncident[];
  page: number;
  totalPages: number;
}): string {
  const { incidents, allIncidents, page, totalPages } = options;
  const grouped = groupIncidentsByYear(allIncidents);
  const count = allIncidents.length;
  const start = count ? (page - 1) * INCIDENTS_PER_PAGE + 1 : 0;
  const end = count ? start + incidents.length - 1 : 0;
  const feed = incidents.length
    ? incidents.map(renderBlogCard).join('')
    : `<div class="ir-empty">No published incidents yet. Publish from the ops panel, then regenerate the page.</div>`;

  const body = `
${renderNav()}
${page === 1 ? renderHero(count) : renderCompactHeader(`Page ${page}`, `Older entries from the incident record.`)}
<div class="container">
  <main class="ir-main">
    ${renderArchiveBar(grouped)}
    <div class="ir-toolbar">
      <h2>${page === 1 ? 'Latest incidents' : `Incidents ${start}${end > start ? `-${end}` : ''}`}</h2>
      <div class="ir-toolbar-meta">${count} total</div>
    </div>
    <div class="ir-feed">${feed}</div>
    ${renderPagination(page, totalPages)}
    ${page === 1 ? renderSubscribeBlock() : ''}
    <p class="ir-method-note">All incidents are verified against published press sources. Methodology and sourcing appear on each incident page.</p>
  </main>
</div>
${renderFooter()}`;

  const canonical = page === 1
    ? 'https://labyrinthscout.com/incidents/'
    : `https://labyrinthscout.com/incidents/page/${page}/`;
  const title = page === 1
    ? 'The AI Agent Incident Record - Labyrinth Scout'
    : `Incident Record · Page ${page} - Labyrinth Scout`;
  const description = page === 1
    ? `${count} documented AI agent incidents with sources, damage figures, and Scout prevention guidance.`
    : `Page ${page} of the AI Agent Incident Record. ${count} sourced incidents in total.`;

  return renderPageShell(title, description, canonical, body);
}

function renderArchiveIndex(grouped: Map<string, BlogIncident[]>, total: number): string {
  const years = [...grouped.keys()].sort((a, b) => Number(b) - Number(a));
  const items = years.map((year) => `
<li style="margin-bottom:0.85rem;">
  <a href="${archiveYearHref(year)}" style="color:var(--text-primary);text-decoration:none;font-weight:600;">${year}</a>
  <span style="color:var(--text-dim);font-size:0.82rem;"> · ${grouped.get(year)?.length ?? 0} incidents</span>
</li>`).join('');

  const body = `
${renderNav('archive')}
${renderCompactHeader('Archive', `${total} incidents organized by year.`)}
<div class="container">
  <main class="ir-main">
    ${renderArchiveBar(grouped)}
    <ul style="list-style:none;padding:0;">${items || '<li class="ir-empty">No published incidents yet.</li>'}</ul>
    <p style="margin-top:1.25rem;"><a href="/incidents/" class="btn-secondary">Back to latest incidents</a></p>
  </main>
</div>
${renderFooter()}`;

  return renderPageShell(
    'Incident Archive - Labyrinth Scout',
    `Browse ${total} AI agent incidents by year.`,
    'https://labyrinthscout.com/incidents/archive/',
    body,
  );
}

function renderArchiveYearPage(year: string, incidents: BlogIncident[], grouped: Map<string, BlogIncident[]>): string {
  const body = `
${renderNav('archive')}
${renderCompactHeader(`${year} archive`, `${incidents.length} incidents from ${year}.`)}
<div class="container">
  <main class="ir-main">
    ${renderArchiveBar(grouped, year)}
    <div class="ir-feed">${incidents.map(renderBlogCard).join('')}</div>
    <p style="margin-top:1.25rem;"><a href="/incidents/archive/" class="btn-secondary">All archives</a></p>
  </main>
</div>
${renderFooter()}`;

  return renderPageShell(
    `${year} Incident Archive - Labyrinth Scout`,
    `${incidents.length} AI agent incidents from ${year}.`,
    `https://labyrinthscout.com/incidents/archive/${year}/`,
    body,
  );
}

function renderIncidentDetailPage(incident: BlogIncident, allIncidents: BlogIncident[]): string {
  const sorted = sortPublishedIncidents(allIncidents);
  const index = sorted.findIndex((row) => row.slug === incident.slug);
  const prev = index >= 0 ? sorted[index + 1] : undefined;
  const next = index > 0 ? sorted[index - 1] : undefined;
  const sources = incident.sources.length
    ? incident.sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.label)}</a>`).join(' · ')
    : 'No source linked';

  const body = `
${renderNav()}
<div class="container">
  <div class="ir-breadcrumb"><a href="/incidents/">Incidents</a> / <a href="/incidents/archive/">Archive</a> / ${escapeHtml(incident.title)}</div>
  <article class="ir-article">
    <header class="ir-article-header">
      <span class="ir-badge ${incident.category}">${categoryLabel(incident.category)}</span>
      <span class="ir-article-company">${escapeHtml(incident.company)}</span>
      <h1 class="ir-article-title">${escapeHtml(incident.title)}</h1>
      <div class="ir-article-damage">${escapeHtml(incident.damage)}</div>
      <div class="ir-article-meta">${escapeHtml(incident.dateOccurred)}</div>
    </header>
    <div class="ir-article-body">${incident.bodyHtml}</div>
    <div class="ir-article-scout">
      <div class="ir-article-scout-label">Scout fix</div>
      <div class="ir-article-scout-body">${incident.scoutFixHtml}</div>
    </div>
    <div class="ir-article-sources"><strong>Sources:</strong> ${sources}</div>
    <div class="ir-article-nav">
      ${prev ? `<a href="${incidentHref(prev.slug)}" class="btn-secondary">← ${escapeHtml(prev.title)}</a>` : '<span></span>'}
      ${next ? `<a href="${incidentHref(next.slug)}" class="btn-secondary">${escapeHtml(next.title)} →</a>` : '<span></span>'}
    </div>
    <p style="margin-top:1.25rem;"><a href="/incidents/" class="btn-secondary">Back to incident list</a></p>
  </article>
</div>
<div class="container">
  ${renderSubscribeBlock()}
  ${renderFooter()}
</div>`;

  return renderPageShell(
    `${incident.title} - Labyrinth Scout`,
    excerptFromHtml(incident.bodyHtml, 160),
    `https://labyrinthscout.com/incidents/${incident.slug}/`,
    body,
  );
}

async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, contents, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function removeIfExists(targetPath: string): Promise<void> {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // ignore missing paths
  }
}

async function writeSiteTree(baseDir: string, incidents: BlogIncident[]): Promise<number> {
  const sorted = sortPublishedIncidents(incidents);
  const pages = paginateIncidents(sorted, INCIDENTS_PER_PAGE);
  const grouped = groupIncidentsByYear(sorted);
  const totalPages = Math.max(pages.length, 1);
  const validSlugs = new Set(sorted.map((row) => row.slug));

  await writeFileAtomic(path.join(baseDir, 'index.html'), renderListPage({
    incidents: pages[0] ?? [],
    allIncidents: sorted,
    page: 1,
    totalPages,
  }));

  for (let page = 2; page <= totalPages; page += 1) {
    await writeFileAtomic(
      path.join(baseDir, 'page', String(page), 'index.html'),
      renderListPage({
        incidents: pages[page - 1] ?? [],
        allIncidents: sorted,
        page,
        totalPages,
      }),
    );
  }

  for (let page = totalPages + 1; page <= 50; page += 1) {
    await removeIfExists(path.join(baseDir, 'page', String(page)));
  }

  await writeFileAtomic(path.join(baseDir, 'archive', 'index.html'), renderArchiveIndex(grouped, sorted.length));
  for (const [year, rows] of grouped.entries()) {
    await writeFileAtomic(path.join(baseDir, 'archive', year, 'index.html'), renderArchiveYearPage(year, rows, grouped));
  }

  const archiveDir = path.join(baseDir, 'archive');
  try {
    const entries = await fs.readdir(archiveDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'index.html') continue;
      if (!grouped.has(entry.name)) {
        await removeIfExists(path.join(archiveDir, entry.name));
      }
    }
  } catch {
    // archive dir may not exist yet on first run
  }

  for (const incident of sorted) {
    await writeFileAtomic(
      path.join(baseDir, incident.slug, 'index.html'),
      renderIncidentDetailPage(incident, sorted),
    );
  }

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['page', 'archive'].includes(entry.name)) continue;
      if (!validSlugs.has(entry.name)) {
        await removeIfExists(path.join(baseDir, entry.name));
      }
    }
  } catch {
    // ignore
  }

  return sorted.length;
}

export async function generateIncidentPage(): Promise<{ path: string; incidentCount: number; pages: number }> {
  await ensureIncidentBlogSchema();
  await ensurePublishedIncidentSeed();
  const incidents = await getPublishedIncidents();
  const outputBases = resolveOutputBases();
  let lastPath = outputBases[0] ?? DEFAULT_OUTPUT_BASES[0];
  let writtenCount = 0;

  for (const baseDir of outputBases) {
    try {
      writtenCount = await writeSiteTree(baseDir, incidents);
      lastPath = baseDir;
    } catch (err) {
      console.warn('[blog] page generation skipped for', baseDir, err instanceof Error ? err.message : String(err));
    }
  }

  const pages = Math.max(paginateIncidents(sortPublishedIncidents(incidents), INCIDENTS_PER_PAGE).length, 1);
  return { path: lastPath, incidentCount: writtenCount, pages };
}
