/**
 * Render public proof page HTML (no carousels; inline testimonials + schema.org).
 */
import type { ProofPageModel, Testimonial } from './types.js';

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reviewJsonLd(items: Testimonial[]): string {
  const reviews = items.map((t) => ({
    '@type': 'Review',
    reviewBody: t.text,
    datePublished: t.date,
    url: t.url,
    author: {
      '@type': 'Person',
      name: t.author,
      ...(t.authorTitle ? { jobTitle: t.authorTitle } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: t.platform,
    },
  }));
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': reviews,
  });
}

export function buildProofPageModel(
  testimonials: Testimonial[],
  extras: Partial<ProofPageModel> = {},
): ProofPageModel {
  const approved = testimonials.filter((t) => t.status === 'approved');
  return {
    product: extras.product,
    tag: extras.tag,
    testimonials: approved.filter((t) => {
      if (extras.product && extras.product !== 'all' && t.product !== extras.product) return false;
      if (extras.tag && !t.tags.includes(extras.tag)) return false;
      return true;
    }),
    logos: extras.logos ?? [],
    metrics: extras.metrics ?? [],
    press: extras.press ?? [],
    videos: extras.videos ?? [],
  };
}

export function renderProofPageHtml(
  model: ProofPageModel,
  options: {
    brand: string;
    title?: string;
    navHtml?: string;
    canonicalUrl?: string;
  },
): string {
  const title = options.title || `Proof; ${options.brand}`;
  const byProduct = new Map<string, Testimonial[]>();
  for (const t of model.testimonials) {
    const list = byProduct.get(t.product) || [];
    list.push(t);
    byProduct.set(t.product, list);
  }

  const sections = [...byProduct.entries()]
    .map(([product, rows]) => {
      const cards = rows
        .map(
          (t) => `
<article class="proof-card" itemscope itemtype="https://schema.org/Review">
  <blockquote itemprop="reviewBody">${escapeHtml(t.text)}</blockquote>
  <footer>
    <strong itemprop="author">${escapeHtml(t.author)}</strong>
    ${t.authorTitle ? `<span class="title">${escapeHtml(t.authorTitle)}</span>` : ''}
    <a href="${escapeHtml(t.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(t.platform)} source</a>
    <time datetime="${escapeHtml(t.date)}">${escapeHtml(t.date)}</time>
  </footer>
</article>`,
        )
        .join('\n');
      return `<section class="proof-section"><h2>${escapeHtml(product)}</h2>${cards}</section>`;
    })
    .join('\n');

  const logos = model.logos.length
    ? `<section class="proof-section"><h2>Teams</h2><ul class="logo-list">${model.logos
        .map((l) => `<li>${l.href ? `<a href="${escapeHtml(l.href)}">${escapeHtml(l.name)}</a>` : escapeHtml(l.name)}</li>`)
        .join('')}</ul></section>`
    : '';

  const metrics = model.metrics.length
    ? `<section class="proof-section"><h2>Outcomes</h2><ul class="metrics">${model.metrics
        .map((m) => `<li><strong>${escapeHtml(m.value)}</strong><span>${escapeHtml(m.label)}</span></li>`)
        .join('')}</ul></section>`
    : '';

  const press = model.press.length
    ? `<section class="proof-section"><h2>Press</h2><ul>${model.press
        .map(
          (p) =>
            `<li><a href="${escapeHtml(p.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(p.title)}</a> — ${escapeHtml(p.outlet)}${p.date ? ` (${escapeHtml(p.date)})` : ''}</li>`,
        )
        .join('')}</ul></section>`
    : '';

  const videos = model.videos.length
    ? `<section class="proof-section"><h2>Video</h2><ul>${model.videos
        .map((v) => `<li><a href="${escapeHtml(v.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(v.title)}</a></li>`)
        .join('')}</ul></section>`
    : '';

  const empty =
    model.testimonials.length === 0
      ? `<p class="empty">Approved testimonials will appear here after human curation. We never publish unverified quotes.</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Verifiable social proof for ${escapeHtml(options.brand)}: testimonials, reviews, and press with source links.">
  ${options.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">` : ''}
  <script type="application/ld+json">${reviewJsonLd(model.testimonials)}</script>
  <style>
    :root { --ink:#09161e; --amber:#f5a623; --silver:#7a9daf; --white:#fff; --border:rgba(26,95,122,.18); --ff-serif:'Georgia',serif; --ff-sans:system-ui,sans-serif; }
    *{box-sizing:border-box} body{margin:0;font-family:var(--ff-sans);background:var(--ink);color:var(--white);line-height:1.6}
    .wrap{max-width:900px;margin:0 auto;padding:6rem 1.5rem 4rem}
    h1{font-family:var(--ff-serif);font-weight:500;font-size:clamp(2rem,5vw,3rem);margin:0 0 .5rem}
    .lede{color:var(--silver);max-width:40rem;margin-bottom:2rem}
    .proof-section{margin:2.5rem 0} .proof-section h2{font-size:1.25rem;margin-bottom:1rem;color:var(--amber)}
    .proof-card{border:1px solid var(--border);border-radius:10px;padding:1.1rem 1.2rem;margin:0 0 1rem}
    .proof-card blockquote{margin:0 0 .85rem;font-size:1.05rem}
    .proof-card footer{display:flex;flex-wrap:wrap;gap:.6rem 1rem;font-size:.85rem;color:var(--silver)}
    .proof-card a{color:var(--amber)}
    .logo-list,.metrics{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:1rem}
    .metrics li{border:1px solid var(--border);border-radius:8px;padding:.8rem 1rem;min-width:8rem}
    .metrics strong{display:block;font-size:1.3rem;color:var(--amber)}
    .empty{color:var(--silver)}
    @media (max-width:640px){.wrap{padding-top:5rem}}
  </style>
</head>
<body>
${options.navHtml || ''}
<main class="wrap">
  <h1>${escapeHtml(options.brand)} proof</h1>
  <p class="lede">Real quotes with source links. No carousels. No paraphrasing. Human-approved only.</p>
  ${metrics}
  ${logos}
  ${sections || empty}
  ${videos}
  ${press}
</main>
</body>
</html>`;
}
