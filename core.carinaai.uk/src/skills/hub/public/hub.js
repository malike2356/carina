const state = {
  view: 'packs',
  q: '',
  category: '',
  packs: [],
  skills: [],
};

const els = {
  stats: document.getElementById('stats'),
  search: document.getElementById('search'),
  category: document.getElementById('category'),
  packsView: document.getElementById('packs-view'),
  skillsView: document.getElementById('skills-view'),
  detail: document.getElementById('detail'),
  tabs: document.querySelectorAll('.tab'),
};

async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isVerified(pack) {
  return pack.featured === true || pack.pricing_tier === 'certified';
}

function isPremium(pack) {
  return pack.pricing_tier === 'premium' && (pack.price_gbp_cents ?? 0) > 0;
}

function formatPrice(cents) {
  return `£${(cents / 100).toFixed(2)} ex VAT`;
}

function tierBadges(pack) {
  const parts = [];
  if (pack.pricing_tier === 'certified') parts.push('<span class="pill certified">Carina-certified</span>');
  else if (isVerified(pack)) parts.push('<span class="pill verified">verified</span>');
  if (isPremium(pack)) parts.push(`<span class="pill premium">premium</span><span class="pill price">${formatPrice(pack.price_gbp_cents)}</span>`);
  else if ((pack.pricing_tier ?? 'free') === 'free') parts.push('<span class="pill">free</span>');
  return parts.join(' ');
}

function verifiedBadge(pack) {
  return tierBadges(pack);
}

function renderStats(summary) {
  els.stats.innerHTML = `
    <div class="stat"><strong>${summary.packCount}</strong><span>Packs</span></div>
    <div class="stat"><strong>${summary.skillCount}</strong><span>Skills</span></div>
    <div class="stat"><strong>${summary.totalDownloads}</strong><span>Downloads</span></div>
    <div class="stat"><strong>${summary.categories.length}</strong><span>Categories</span></div>
  `;
  for (const cat of summary.categories) {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    els.category.appendChild(opt);
  }
}

function renderPacks(packs) {
  els.packsView.innerHTML = packs.map((p) => `
    <article class="card" data-pack="${esc(p.name)}">
      <div class="card-head">
        <h3>${esc(p.name)}</h3>
        ${verifiedBadge(p)}
      </div>
      <p>${esc(p.description)}</p>
      <div class="meta">
        <span class="pill">${esc(p.author || 'community')}</span>
        <span class="pill">${esc(p.category || 'general')}</span>
        <span class="pill">${p.skill_count} skills</span>
        <span class="pill">v${esc(p.version)}</span>
      </div>
    </article>
  `).join('');
  els.packsView.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => showPackDetail(card.dataset.pack));
  });
}

function renderSkills(skills) {
  els.skillsView.innerHTML = skills.map((s) => `
    <article class="skill-row" data-pack="${esc(s.pack_name)}" data-skill="${esc(s.name)}">
      <h4>${esc(s.name)}</h4>
      <p>${esc(s.description)}</p>
      <div class="meta">
        <span class="pill">${esc(s.pack_name)}</span>
        ${(s.triggers || []).slice(0, 3).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}
      </div>
    </article>
  `).join('');
  els.skillsView.querySelectorAll('.skill-row').forEach((row) => {
    row.addEventListener('click', () => showSkillDetail(row.dataset.pack, row.dataset.skill));
  });
}

function installCommand(name) {
  return `carina pack install ${name}`;
}

async function startPackCheckout(packName, email) {
  const res = await fetch(`/api/packs/${encodeURIComponent(packName)}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Checkout failed (${res.status})`);
  }
  const data = await res.json();
  if (data.url) location.href = data.url;
}

async function fulfillPurchase(packName, sessionId) {
  const res = await fetch(`/api/packs/${encodeURIComponent(packName)}/license/fulfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.license ?? null;
}

async function showPackDetail(name) {
  const data = await api(`/api/packs/${encodeURIComponent(name)}`);
  const skills = data.skills || [];
  const premium = isPremium(data);
  els.detail.classList.remove('hidden');
  els.detail.innerHTML = `
    <button type="button" class="btn secondary" id="back-btn">Back</button>
    <div class="card-head">
      <h2>${esc(data.name)}</h2>
      ${verifiedBadge(data)}
    </div>
    <p>${esc(data.description)}</p>
    <div class="meta">
      <span class="pill">${esc(data.author)}</span>
      <span class="pill">${esc(data.category || 'general')}</span>
      <span class="pill">v${esc(data.version)}</span>
      <span class="pill">${data.skill_count} skills</span>
      <span class="pill">${data.download_count} downloads</span>
    </div>
    <div class="actions">
      ${premium ? '' : `<a class="btn" href="/api/packs/${encodeURIComponent(name)}/download">Download tarball</a>`}
      <code>${esc(installCommand(name))}</code>
    </div>
    ${premium ? `
      <div class="notice">
        <p><strong>Premium pack.</strong> Purchase grants a license for Hub download and CLI install. Source may remain MIT; payment is for maintained Hub distribution.</p>
        <div class="buy-form">
          <input type="email" id="buy-email" placeholder="your@email.com" required />
          <button type="button" class="btn" id="buy-btn">Buy ${formatPrice(data.price_gbp_cents)}</button>
        </div>
      </div>
    ` : ''}
    <p class="muted">Requires <code>@carina/core</code> installed. See <a href="https://docs.carinaai.uk/docs/user/hub">Hub guide</a>.</p>
    <h3>Skills in this pack</h3>
    <div class="list">
      ${skills.map((s) => `
        <article class="skill-row" data-pack="${esc(s.pack_name)}" data-skill="${esc(s.name)}">
          <h4>${esc(s.name)}</h4>
          <p>${esc(s.description)}</p>
        </article>
      `).join('')}
    </div>
  `;
  document.getElementById('back-btn').addEventListener('click', () => {
    els.detail.classList.add('hidden');
    history.replaceState(null, '', location.pathname);
  });
  if (premium) {
    document.getElementById('buy-btn').addEventListener('click', async () => {
      const email = document.getElementById('buy-email').value.trim();
      if (!email) return;
      try {
        await startPackCheckout(name, email);
      } catch (err) {
        alert(err.message || 'Checkout failed');
      }
    });
  }
  els.detail.querySelectorAll('.skill-row').forEach((row) => {
    row.addEventListener('click', () => showSkillDetail(row.dataset.pack, row.dataset.skill));
  });
  history.replaceState(null, '', `?pack=${encodeURIComponent(name)}`);
  els.detail.scrollIntoView({ behavior: 'smooth' });
}

async function showSkillDetail(packName, skillName) {
  const data = await api(`/api/skills/${encodeURIComponent(packName)}/${encodeURIComponent(skillName)}`);
  els.detail.classList.remove('hidden');
  els.detail.innerHTML = `
    <button type="button" class="btn secondary" id="back-btn">Back</button>
    <h2>${esc(data.name)}</h2>
    <p>${esc(data.description)}</p>
    <div class="meta">
      <span class="pill">pack: ${esc(data.pack_name)}</span>
      ${(data.triggers || []).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}
      ${(data.tools_used || []).map((t) => `<span class="pill">tool: ${esc(t)}</span>`).join('')}
    </div>
    <div class="actions">
      <button type="button" class="btn secondary" id="pack-btn">View pack</button>
      <code>${esc(installCommand(data.pack_name))}</code>
    </div>
  `;
  document.getElementById('back-btn').addEventListener('click', () => {
    els.detail.classList.add('hidden');
  });
  document.getElementById('pack-btn').addEventListener('click', () => showPackDetail(packName));
  els.detail.scrollIntoView({ behavior: 'smooth' });
}

function queryParams() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  const q = params.toString();
  return q ? `?${q}` : '';
}

async function refresh() {
  const q = queryParams();
  if (state.view === 'packs') {
    const data = await api(`/api/packs${q}`);
    state.packs = data.packs;
    renderPacks(state.packs);
  } else {
    const data = await api(`/api/skills${q}${q ? '&' : '?'}limit=200`);
    state.skills = data.skills;
    renderSkills(state.skills);
  }
}

function setView(view) {
  state.view = view;
  els.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  els.packsView.classList.toggle('hidden', view !== 'packs');
  els.skillsView.classList.toggle('hidden', view !== 'skills');
  els.detail.classList.add('hidden');
  refresh().catch(console.error);
}

els.search.addEventListener('input', (e) => {
  state.q = e.target.value.trim();
  refresh().catch(console.error);
});

els.category.addEventListener('change', (e) => {
  state.category = e.target.value;
  refresh().catch(console.error);
});

els.tabs.forEach((tab) => {
  tab.addEventListener('click', () => setView(tab.dataset.view));
});

async function init() {
  const params = new URLSearchParams(location.search);
  const initialQ = params.get('q');
  if (initialQ) {
    state.q = initialQ;
    els.search.value = initialQ;
  }

  const summary = await api('/api/registry');
  renderStats(summary);
  await refresh();

  const packSlug = params.get('pack');
  if (packSlug) {
    await showPackDetail(packSlug);
  }

  const purchase = params.get('purchase');
  const sessionId = params.get('session_id');
  const purchasedPack = params.get('pack');
  if (purchase === 'success' && sessionId && purchasedPack) {
    const license = await fulfillPurchase(purchasedPack, sessionId);
    if (license) {
      alert(`License granted for ${purchasedPack}. Run: carina pack install ${purchasedPack}`);
    }
  }
}

init().catch((err) => {
  document.body.innerHTML = `<main class="wrap"><h1>Carina Hub unavailable</h1><p>${esc(err.message)}</p><p>Try again later or run a local hub: <code>pnpm hub</code></p></main>`;
});
