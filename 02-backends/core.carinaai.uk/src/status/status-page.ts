/**
 * Public status page model + static HTML (host separately from the main app).
 */
import type { StatusSnapshot } from './types.js';
import type { StatusStore } from './store.js';

export function buildStatusPageModel(store: StatusStore): StatusSnapshot {
  return store.snapshot();
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_LABEL: Record<string, string> = {
  operational: 'All systems operational',
  degraded: 'Degraded performance',
  outage: 'Service outage',
  maintenance: 'Scheduled maintenance',
};

export function renderStatusPageHtml(
  model: StatusSnapshot,
  opts?: {
    brand?: string;
    title?: string;
    canonicalUrl?: string;
    navHtml?: string;
    /** Note that this page is served off the app runtime. */
    hostingNote?: string;
  },
): string {
  const brand = opts?.brand || model.product;
  const title = opts?.title || `Status; ${brand}`;
  const canonical = opts?.canonicalUrl || '';
  const hosting =
    opts?.hostingNote ||
    'This status page is served from static marketing infrastructure, separate from the application runtime.';

  const services = model.services
    .map(
      (s) =>
        `<li class="svc"><span class="name">${esc(s.name)}</span><span class="pill ${esc(s.health)}">${esc(s.health)}</span></li>`,
    )
    .join('');

  const open = model.openIncidents
    .map((i) => {
      const timeline = i.updates
        .map(
          (u) =>
            `<li><time datetime="${esc(u.at)}">${esc(u.at)}</time> <strong>${esc(u.phase)}</strong>; ${esc(u.message)}</li>`,
        )
        .join('');
      return `<article class="incident"><h3>${esc(i.title)}</h3><p class="meta">${esc(i.severity)} · ${esc(i.phase)}</p><ol class="timeline">${timeline}</ol></article>`;
    })
    .join('');

  const recent = model.recentIncidents
    .filter((i) => i.phase === 'resolved')
    .slice(0, 8)
    .map(
      (i) =>
        `<li><strong>${esc(i.title)}</strong> <span class="meta">resolved ${esc(i.resolvedAt || '')}</span></li>`,
    )
    .join('');

  const maint = model.upcomingMaintenance
    .map(
      (m) =>
        `<li><strong>${esc(m.title)}</strong><br/><span class="meta">${esc(m.startsAt)} → ${esc(m.endsAt)}</span><br/>${esc(m.description)}</li>`,
    )
    .join('');

  const days = model.dailyUptime
    .slice(-90)
    .map((d) => {
      const cls = d.totalChecks === 0 ? 'empty' : d.uptimePct >= 99.5 ? 'good' : d.uptimePct >= 95 ? 'ok' : 'bad';
      return `<span class="day ${cls}" title="${esc(d.date)}: ${d.uptimePct}%"></span>`;
    })
    .join('');

  const nav =
    opts?.navHtml ||
    `<nav class="top"><a href="/">${esc(brand)}</a><a href="/status/">Status</a></nav>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="Live service status, incidents, and maintenance for ${esc(brand)}.">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
  <style>
    :root { --ink:#0b1220; --panel:#121a2b; --line:rgba(255,255,255,.12); --ok:#3ecf8e; --warn:#f5a623; --bad:#ef4444; --muted:#9aa8c0; --ff:ui-sans-serif,system-ui,sans-serif; }
    *{box-sizing:border-box} body{margin:0;font-family:var(--ff);background:linear-gradient(160deg,#0b1220,#152038 50%,#0b1220);color:#f4f7fb;min-height:100vh}
    .wrap{max-width:880px;margin:0 auto;padding:5.5rem 1.25rem 3rem}
    h1{font-size:clamp(1.8rem,4vw,2.4rem);margin:0 0 .4rem;font-weight:600}
    .lede{color:var(--muted);margin:0 0 1.5rem}
    .banner{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:1rem 1.2rem;margin-bottom:1.5rem;display:flex;justify-content:space-between;gap:1rem;align-items:center}
    .banner.operational{border-color:rgba(62,207,142,.45)} .banner.degraded{border-color:rgba(245,166,35,.5)} .banner.outage{border-color:rgba(239,68,68,.55)} .banner.maintenance{border-color:rgba(96,165,250,.5)}
    .uptime{font-size:1.4rem;font-weight:600}
    h2{font-size:1.05rem;margin:1.8rem 0 .8rem;color:var(--warn)}
    .svc{display:flex;justify-content:space-between;padding:.7rem 0;border-bottom:1px solid var(--line)}
    .pill{text-transform:uppercase;font-size:.7rem;letter-spacing:.04em;padding:.2rem .5rem;border-radius:999px;border:1px solid var(--line)}
    .pill.up{color:var(--ok)} .pill.down{color:var(--bad)} .pill.unknown{color:var(--muted)}
    .incident{border:1px solid var(--line);border-radius:10px;padding:1rem;margin:0 0 .8rem;background:rgba(0,0,0,.18)}
    .timeline{margin:.6rem 0 0;padding-left:1.1rem;color:var(--muted)} .timeline time{color:#c9d4ea}
    .meta{color:var(--muted);font-size:.85rem}
    .days{display:flex;gap:2px;flex-wrap:nowrap;overflow:auto;padding:.4rem 0}
    .day{width:6px;height:28px;border-radius:2px;background:rgba(255,255,255,.08)}
    .day.good{background:var(--ok)} .day.ok{background:var(--warn)} .day.bad{background:var(--bad)} .day.empty{background:rgba(255,255,255,.06)}
    .note{font-size:.8rem;color:var(--muted);margin-top:2rem}
    .top{position:fixed;inset:0 0 auto 0;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 1.25rem;background:rgba(11,18,32,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);z-index:5}
    .top a{color:#fff;text-decoration:none;margin-left:1rem;font-size:.9rem}
    ul{list-style:none;padding:0;margin:0}
  </style>
</head>
<body>
${nav}
<main class="wrap">
  <h1>${esc(brand)} status</h1>
  <p class="lede">${esc(STATUS_LABEL[model.overall] || model.overall)}. Updated ${esc(model.updatedAt)}.</p>
  <div class="banner ${esc(model.overall)}">
    <div><strong>${esc(STATUS_LABEL[model.overall] || model.overall)}</strong><div class="meta">90-day uptime</div></div>
    <div class="uptime">${model.uptime90d.toFixed(2)}%</div>
  </div>
  <h2>Services</h2>
  <ul>${services || '<li class="meta">No monitored services configured.</li>'}</ul>
  <h2>Active incidents</h2>
  ${open || '<p class="meta">No active incidents.</p>'}
  <h2>Incident history</h2>
  <ul>${recent || '<li class="meta">No resolved incidents yet.</li>'}</ul>
  <h2>Scheduled maintenance</h2>
  <ul>${maint || '<li class="meta">No upcoming maintenance windows.</li>'}</ul>
  <h2>90-day uptime</h2>
  <div class="days" aria-label="Daily uptime bars">${days}</div>
  <p class="note">${esc(hosting)}</p>
</main>
</body>
</html>`;
}
