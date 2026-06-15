export type WorkspacePageId =
  | 'hub'
  | 'chat'
  | 'notes'
  | 'documents'
  | 'images'
  | 'email'
  | 'calendar'
  | 'memory'
  | 'packs';

export interface WorkspaceNavItem {
  id: WorkspacePageId;
  href: string;
  label: string;
  description: string;
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { id: 'chat', href: '/', label: 'Chat', description: 'Agent conversations and slash commands' },
  { id: 'notes', href: '/notes', label: 'Notes', description: 'Notes, tasks, and reminders' },
  { id: 'calendar', href: '/calendar', label: 'Calendar', description: 'Reminder schedule from notes' },
  { id: 'documents', href: '/documents', label: 'Documents', description: 'Markdown, HTML, and CSV editor' },
  { id: 'images', href: '/images', label: 'Images', description: 'Generate, browse, and edit images' },
  { id: 'email', href: '/email', label: 'Email', description: 'Inbound triage, urgency, and archive' },
  { id: 'memory', href: '/memory', label: 'Memory', description: 'Persistent agent memory entries' },
  { id: 'packs', href: '/packs', label: 'Skill packs', description: 'Domain skill bundles' },
];

const WORKSPACE_BEGIN = '<!--CARINA_WORKSPACE_BEGIN-->';
const WORKSPACE_END = '<!--CARINA_WORKSPACE_END-->';

export function workspaceThemeCss(): string {
  return [
    ':root {',
    '  --bg: #0d0d0f; --surface: #111115; --surface-2: #18181d; --surface-3: #20202a;',
    '  --border: rgba(255,255,255,0.07); --border-strong: rgba(255,255,255,0.12);',
    '  --text: #e4e4e9; --muted: #575768;',
    '  --accent: #19c49a; --accent-dim: rgba(25,196,154,0.14);',
    '  --danger: #f05050; --success: #4ade80;',
    '}',
    '[data-theme="light"] {',
    '  --bg: #f8f8fb; --surface: #f0f0f5; --surface-2: #e8e8ef; --surface-3: #dddde6;',
    '  --border: rgba(0,0,0,0.07); --border-strong: rgba(0,0,0,0.12);',
    '  --text: #111118; --muted: #888898;',
    '  --accent: #0ea87e; --accent-dim: rgba(14,168,126,0.11);',
    '}',
    'body.carina-workspace {',
    '  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;',
    '  background: var(--bg); color: var(--text); height: 100vh; margin: 0;',
    '  display: flex; overflow: hidden;',
    '}',
    '.carina-ws-sidebar {',
    '  width: 220px; min-width: 220px; border-right: 1px solid var(--border);',
    '  background: var(--surface); display: flex; flex-direction: column; padding: 12px 10px;',
    '}',
    '.carina-ws-brand { display: flex; align-items: center; gap: 8px; padding: 4px 6px 12px; }',
    '.carina-ws-brand .logo {',
    '  width: 28px; height: 28px; border-radius: 8px; background: var(--accent-dim);',
    '  color: var(--accent); display: inline-flex; align-items: center; justify-content: center;',
    '  font-weight: 600; font-size: 0.85rem;',
    '}',
    '.carina-ws-brand .name { font-size: 0.9rem; font-weight: 600; }',
    '.carina-ws-brand a { color: inherit; text-decoration: none; }',
    '.carina-ws-section-label {',
    '  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em;',
    '  color: var(--muted); padding: 8px 8px 4px;',
    '}',
    '.carina-ws-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }',
    '.carina-ws-nav a {',
    '  display: block; padding: 8px 10px; border-radius: 8px; text-decoration: none;',
    '  color: var(--text); font-size: 0.84rem; border: 1px solid transparent;',
    '}',
    '.carina-ws-nav a:hover { background: rgba(255,255,255,0.04); }',
    '.carina-ws-nav a.active { background: var(--accent-dim); border-color: rgba(25,196,154,0.25); color: var(--accent); }',
    '.carina-ws-nav a .desc { display: block; font-size: 0.68rem; color: var(--muted); margin-top: 2px; }',
    '.carina-ws-foot { padding: 8px 6px 4px; font-size: 0.68rem; color: var(--muted); }',
    '.carina-ws-foot a { color: var(--accent); text-decoration: none; }',
    '.carina-ws-theme-btn {',
    '  width: 100%; margin-top: 6px; padding: 7px 10px; border-radius: 8px;',
    '  border: 1px solid var(--border); background: var(--surface-2); color: var(--text);',
    '  font-size: 0.78rem; cursor: pointer;',
    '}',
    '.carina-ws-main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }',
    '.ws-page-header {',
    '  display: flex; align-items: center; gap: 12px; padding: 12px 16px;',
    '  border-bottom: 1px solid var(--border); background: var(--surface);',
    '}',
    '.ws-page-header h1 { font-size: 1rem; font-weight: 600; flex: 1; margin: 0; }',
    '.ws-page-header .status { font-size: 0.75rem; color: var(--muted); }',
    'body.carina-workspace .layout { flex: 1; min-height: 0; }',
    'body.carina-workspace .top-nav { display: none; }',
    '.ws-scroll-page { flex: 1; overflow-y: auto; padding: 1rem 1.25rem 2rem; width: 100%; }',
    'body.carina-workspace[data-workspace-page="memory"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="packs"] .ws-scroll-page { max-width: 900px; margin: 0 auto; }',
    '@media (max-width: 820px) {',
    '  .carina-ws-sidebar { width: 64px; min-width: 64px; padding: 10px 6px; }',
    '  .carina-ws-brand .name, .carina-ws-section-label, .carina-ws-nav a .desc, .carina-ws-foot { display: none; }',
    '  .carina-ws-nav a { font-size: 0.72rem; text-align: center; padding: 10px 4px; }',
    '}',
  ].join('\n');
}

export function workspaceSidebarHtml(active: WorkspacePageId): string {
  const navLinks = WORKSPACE_NAV_ITEMS.map((item) => {
    const activeClass = item.id === active ? ' class="active"' : '';
    return [
      `<a href="${item.href}"${activeClass}>`,
      item.label,
      `<span class="desc">${item.description}</span>`,
      '</a>',
    ].join('');
  }).join('\n');

  const hubActive = active === 'hub' ? ' class="active"' : '';
  return [
    '<aside class="carina-ws-sidebar" aria-label="Workspace navigation">',
    '<div class="carina-ws-brand"><a href="/workspace">',
    '<span class="logo">C</span><span class="name">Carina Workspace</span>',
    '</a></div>',
    '<div class="carina-ws-section-label">Apps</div>',
    '<nav class="carina-ws-nav">',
    `<a href="/workspace"${hubActive}>Overview<span class="desc">All workspace apps</span></a>`,
    navLinks,
    '</nav>',
    '<div class="carina-ws-foot">',
    '<a href="/">Back to chat</a>',
    '<button type="button" class="carina-ws-theme-btn" id="ws-theme-toggle">Toggle theme</button>',
    '</div>',
    '</aside>',
    '<div class="carina-ws-main">',
  ].join('\n');
}

export function injectWorkspaceHead(html: string): string {
  let out = html;
  if (!out.includes('fonts.googleapis.com/css2?family=Inter')) {
    out = out.replace(
      '</head>',
      [
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">',
        `<style id="carina-workspace-theme">${workspaceThemeCss()}</style>`,
        '</head>',
      ].join('\n'),
    );
  } else if (!out.includes('id="carina-workspace-theme"')) {
    out = out.replace('</head>', `<style id="carina-workspace-theme">${workspaceThemeCss()}</style>\n</head>`);
  }
  if (!out.includes('workspace-prefs.js')) {
    out = out.replace('</body>', '<script src="/workspace-prefs.js"></script>\n</body>');
  }
  return out;
}

export function injectWorkspaceChrome(
  html: string,
  active: WorkspacePageId,
): string {
  if (!html.includes(WORKSPACE_BEGIN)) return injectWorkspaceHead(html);

  let out = injectWorkspaceHead(html);
  const sidebar = workspaceSidebarHtml(active);
  out = out.replace(WORKSPACE_BEGIN, sidebar);
  out = out.replace(WORKSPACE_END, '</div>');
  if (!out.includes('class="carina-workspace"')) {
    out = out.replace('<body>', `<body class="carina-workspace" data-workspace-page="${active}">`);
  }
  return out;
}

export function workspaceHubCardsHtml(): string {
  const cards = WORKSPACE_NAV_ITEMS.filter((item) => item.id !== 'chat').map((item) => [
    `<a class="ws-card" href="${item.href}">`,
    `<h3>${item.label}</h3>`,
    `<p>${item.description}</p>`,
    '</a>',
  ].join('')).join('\n');

  return [
    '<header class="ws-page-header"><h1>Workspace</h1></header>',
    '<div class="ws-hub">',
    '<p class="ws-hub-intro">Your Carina workspace: chat-linked apps for notes, documents, images, email triage, calendar, memory, and skill packs.</p>',
    '<div class="ws-card-grid">',
    cards,
    '</div>',
    '</div>',
  ].join('\n');
}

export function injectWorkspaceHub(html: string): string {
  let out = injectWorkspaceChrome(html, 'hub');
  return out.replace('<!--CARINA_WORKSPACE_HUB-->', workspaceHubCardsHtml());
}
