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
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description)}</p>
      <div class="meta">
        ${p.featured ? '<span class="pill featured">featured</span>' : ''}
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

async function showPackDetail(name) {
  const data = await api(`/api/packs/${encodeURIComponent(name)}`);
  const skills = data.skills || [];
  els.detail.classList.remove('hidden');
  els.detail.innerHTML = `
    <button type="button" class="btn secondary" id="back-btn">Back</button>
    <h2>${esc(data.name)}</h2>
    <p>${esc(data.description)}</p>
    <div class="meta">
      <span class="pill">${esc(data.author)}</span>
      <span class="pill">${esc(data.category || 'general')}</span>
      <span class="pill">${data.download_count} downloads</span>
    </div>
    <div class="actions">
      <a class="btn" href="/api/packs/${encodeURIComponent(name)}/download">Download pack</a>
      <code>carina packs install ${esc(name)}</code>
    </div>
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
  });
  els.detail.querySelectorAll('.skill-row').forEach((row) => {
    row.addEventListener('click', () => showSkillDetail(row.dataset.pack, row.dataset.skill));
  });
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
      <code>carina packs install ${esc(data.pack_name)}</code>
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
  const summary = await api('/api/registry');
  renderStats(summary);
  await refresh();
}

init().catch((err) => {
  document.body.innerHTML = `<main class="wrap"><h1>Skills Hub unavailable</h1><p>${esc(err.message)}</p></main>`;
});
