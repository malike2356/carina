import type { ProductMode } from '#core/product/types.js';
import { hostedShellConfig, privateShellConfig } from '#core/product/shell-config.js';

export type WorkspacePageId =
  | 'hub'
  | 'chat'
  | 'notes'
  | 'documents'
  | 'images'
  | 'email'
  | 'calendar'
  | 'scheduled'
  | 'trello'
  | 'memory'
  | 'packs'
  | 'prompt-packs'
  | 'playbook'
  | 'research'
  | 'compare'
  | 'kanban'
  | 'webhooks';

export interface WorkspaceNavItem {
  id: WorkspacePageId;
  href: string;
  label: string;
  description: string;
}

export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { id: 'chat', href: '/', label: 'Chat', description: 'Agent conversations and slash commands' },
  { id: 'notes', href: '/notes', label: 'Notes', description: 'Notes, tasks, and reminders' },
  { id: 'calendar', href: '/calendar', label: 'Calendar', description: 'Reminders and CalDAV events' },
  { id: 'scheduled', href: '/scheduled', label: 'Scheduled', description: 'Cron jobs and TaskFlow runs' },
  { id: 'trello', href: '/trello', label: 'Trello', description: 'Boards, lists, and cards' },
  { id: 'documents', href: '/documents', label: 'Documents', description: 'Markdown, HTML, and CSV editor' },
  { id: 'images', href: '/images', label: 'Images', description: 'Generate, browse, and edit images' },
  {
    id: 'research',
    href: '/research',
    label: 'Deep Research',
    description: 'AI-powered multi-step research with citations',
  },
  {
    id: 'compare',
    href: '/compare',
    label: 'Model Compare',
    description: 'Query all configured LLM providers side by side',
  },
  { id: 'email', href: '/email', label: 'Email', description: 'Inbound triage, urgency, and archive' },
  { id: 'memory', href: '/memory', label: 'Memory', description: 'Persistent agent memory entries' },
  { id: 'kanban', href: '/kanban', label: 'Kanban', description: 'Operator board for multi-step agent work' },
  { id: 'webhooks', href: '/webhooks', label: 'Webhooks', description: 'Subscriptions and delivery log' },
  { id: 'packs', href: '/packs', label: 'Skill packs', description: 'Domain skill bundles' },
  { id: 'prompt-packs', href: '/prompt-packs', label: 'Prompt packs', description: 'Internal gap-close prompts' },
  {
    id: 'playbook',
    href: '/playbook',
    label: 'Playbook',
    description: 'Hardware-aware local model serving',
  },
];

export function workspaceNavForMode(mode: ProductMode): WorkspaceNavItem[] {
  const shell = mode === 'hosted' ? hostedShellConfig() : privateShellConfig();
  const allowed = new Set(shell.primaryNav.map((item) => item.id));
  return WORKSPACE_NAV_ITEMS.filter((item) => allowed.has(item.id));
}

export function workspaceBrandingForMode(mode: ProductMode): {
  productName: string;
  workspaceName: string;
  sectionLabel: string;
} {
  if (mode === 'hosted') {
    return {
      productName: 'Carina Cloud',
      workspaceName: 'Cloud Workspace',
      sectionLabel: 'Apps',
    };
  }
  return {
    productName: 'Carina',
    workspaceName: 'Instance Workspace',
    sectionLabel: 'Engine',
  };
}

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
    '.carina-ws-profile-scope { font-size: 0.65rem; color: var(--muted); margin-bottom: 6px; word-break: break-all; }',
    '.carina-ws-foot a { color: var(--accent); text-decoration: none; }',
    '.carina-ws-shell-links { padding: 8px 6px 4px; font-size: 0.72rem; }',
    '.carina-ws-shell-links a { display: block; padding: 6px 8px; color: var(--text); text-decoration: none; border-radius: 6px; }',
    '.carina-ws-shell-links a:hover { background: rgba(255,255,255,0.04); }',
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
    'body.carina-workspace[data-workspace-page="packs"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="prompt-packs"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="playbook"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="research"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="compare"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="scheduled"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="trello"] .ws-scroll-page,',
    'body.carina-workspace[data-workspace-page="kanban"] .ws-scroll-page { max-width: none; margin: 0; }',
    '@media (max-width: 820px) {',
    '  .carina-ws-sidebar { width: 64px; min-width: 64px; padding: 10px 6px; }',
    '  .carina-ws-brand .name, .carina-ws-section-label, .carina-ws-nav a .desc, .carina-ws-foot { display: none; }',
    '  .carina-ws-nav a { font-size: 0.72rem; text-align: center; padding: 10px 4px; }',
    '}',
    /* Mobile: sidebar off-canvas, bottom nav takes over */
    '@media (max-width: 640px) {',
    '  .carina-ws-sidebar {',
    '    position: fixed; top: 0; bottom: 0; left: 0; z-index: 60;',
    '    width: 240px; min-width: 240px; padding: 12px 10px;',
    '    transform: translateX(-100%); transition: transform 0.22s ease;',
    '    box-shadow: none;',
    '  }',
    '  .carina-ws-sidebar.mobile-open {',
    '    transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.55);',
    '  }',
    '  .carina-ws-brand .name, .carina-ws-section-label, .carina-ws-nav a .desc, .carina-ws-foot { display: block; }',
    '  .carina-ws-nav a { font-size: 0.84rem; text-align: left; padding: 8px 10px; }',
    '  .carina-ws-overlay {',
    '    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 59;',
    '  }',
    '  .carina-ws-sidebar.mobile-open ~ .carina-ws-overlay { display: block; }',
    '  .carina-ws-main { padding-bottom: 60px; }',
    '}',
    /* Mobile bottom navigation bar */
    '.carina-ws-bottom-nav {',
    '  display: none; position: fixed; bottom: 0; left: 0; right: 0;',
    '  background: var(--surface); border-top: 1px solid var(--border);',
    '  justify-content: space-around; align-items: stretch;',
    '  padding-bottom: env(safe-area-inset-bottom, 0px); z-index: 50;',
    '}',
    '@media (max-width: 640px) { .carina-ws-bottom-nav { display: flex; } }',
    '.carina-ws-theme-picker-wrap { padding: 0.5rem 0.85rem; margin-top: auto; }',
    '@media (max-width: 640px) { .carina-ws-theme-picker-wrap { display: none; } }',
    '.carina-ws-bottom-nav a, .carina-ws-bottom-nav button {',
    '  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;',
    '  gap: 3px; padding: 8px 4px; font-size: 0.6rem; letter-spacing: 0.01em;',
    '  color: var(--muted); text-decoration: none; background: none; border: none;',
    '  cursor: pointer; line-height: 1; min-width: 0;',
    '}',
    '.carina-ws-bottom-nav a.active { color: var(--accent); }',
    '.carina-ws-bottom-nav .bnav-icon {',
    '  font-size: 1.1rem; line-height: 1; display: block;',
    '}',
    /* Card hover lift */
    '.ws-card { transition: transform 0.12s ease, box-shadow 0.12s ease; }',
    '.ws-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.32); }',
    /* Loading skeleton */
    '.skeleton {',
    '  background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);',
    '  background-size: 200% 100%; animation: ws-shimmer 1.4s ease-in-out infinite; border-radius: 7px;',
    '}',
    '@keyframes ws-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }',
    /* Smooth page transitions */
    '.carina-ws-main { transition: opacity 0.1s ease; }',
  ].join('\n');
}

function shellFootLinks(mode: ProductMode): string {
  const shell = mode === 'hosted' ? hostedShellConfig() : privateShellConfig();
  const links = mode === 'hosted' ? shell.accountNav : shell.instanceNav;
  if (links.length === 0) return '';
  const items = links.map((link) => `<a href="${link.href}">${link.label}</a>`).join(' · ');
  const label = mode === 'hosted' ? 'Account' : 'Instance';
  return `<div class="carina-ws-shell-links" data-shell="${mode}"><span class="carina-ws-section-label">${label}</span>${items}</div>`;
}

export function workspaceSidebarHtml(active: WorkspacePageId, mode: ProductMode = 'private'): string {
  const branding = workspaceBrandingForMode(mode);
  const navItems = workspaceNavForMode(mode);
  const navLinks = navItems.map((item) => {
    const activeClass = item.id === active ? ' class="active"' : '';
    return [
      `<a href="${item.href}"${activeClass}>`,
      item.label,
      `<span class="desc">${item.description}</span>`,
      '</a>',
    ].join('');
  }).join('\n');

  const hubActive = active === 'hub' ? ' class="active"' : '';
  const bottomNavIds = mode === 'hosted'
    ? ['chat', 'notes', 'documents', 'memory', 'hub']
    : ['chat', 'notes', 'documents', 'email', 'hub'];
  const bottomNavMeta: Record<string, { href: string; label: string; icon: string }> = {
    chat: { href: '/', label: 'Chat', icon: 'C' },
    notes: { href: '/notes', label: 'Notes', icon: 'N' },
    documents: { href: '/documents', label: 'Docs', icon: 'D' },
    email: { href: '/email', label: 'Email', icon: 'M' },
    memory: { href: '/memory', label: 'Memory', icon: 'M' },
    hub: { href: '/workspace', label: 'More', icon: '+' },
  };
  const bnavItems = bottomNavIds.map((id) => ({ id, ...bottomNavMeta[id]! }));
  const bottomNavLinks = bnavItems.map((item) => {
    const activeClass = item.id === active ? ' class="active"' : '';
    return `<a href="${item.href}"${activeClass}><span class="bnav-icon">${item.icon}</span>${item.label}</a>`;
  }).join('');

  const themePicker = [
    '<div class="carina-ws-theme-picker-wrap">',
    '<label style="font-size:0.7rem;color:var(--muted);display:block;margin-bottom:0.3rem">Theme</label>',
    '<select id="ws-theme-picker" style="width:100%;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:0.3rem 0.4rem;font-size:0.78rem"></select>',
    '</div>',
  ].join('');

  return [
    `<aside class="carina-ws-sidebar" id="ws-sidebar" aria-label="Workspace navigation" data-product-mode="${mode}">`,
    '<div class="carina-ws-brand"><a href="/workspace">',
    `<span class="logo">C</span><span class="name">${branding.workspaceName}</span>`,
    '</a></div>',
    `<div class="carina-ws-section-label">${branding.sectionLabel}</div>`,
    '<nav class="carina-ws-nav">',
    `<a href="/workspace"${hubActive}>Overview<span class="desc">All workspace apps</span></a>`,
    navLinks,
    '</nav>',
    themePicker,
    shellFootLinks(mode),
    '<div class="carina-ws-foot">',
    '<div id="ws-profile-scope" class="carina-ws-profile-scope"></div>',
    '<a href="/">Back to chat</a>',
    '<button type="button" class="carina-ws-theme-btn" id="ws-theme-toggle">Toggle theme</button>',
    '</div>',
    '</aside>',
    '<div class="carina-ws-overlay" id="ws-overlay" aria-hidden="true"></div>',
    `<nav class="carina-ws-bottom-nav" aria-label="Quick navigation">${bottomNavLinks}</nav>`,
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
  mode: ProductMode = 'private',
): string {
  if (!html.includes(WORKSPACE_BEGIN)) return injectWorkspaceHead(html);

  let out = injectWorkspaceHead(html);
  const sidebar = workspaceSidebarHtml(active, mode);
  out = out.replace(WORKSPACE_BEGIN, sidebar);
  out = out.replace(WORKSPACE_END, '</div>');
  if (!out.includes('class="carina-workspace"')) {
    out = out.replace(
      '<body>',
      `<body class="carina-workspace" data-workspace-page="${active}" data-product-mode="${mode}">`,
    );
  }
  return out;
}

export function workspaceHubCardsHtml(mode: ProductMode = 'private'): string {
  const featuredIds = ['research', 'compare', 'playbook'];
  const navItems = workspaceNavForMode(mode);
  const intro = mode === 'hosted'
    ? 'Your Carina Cloud workspace: shared engine apps for notes, documents, memory, and skill packs.'
    : 'Your private instance workspace: local engine apps, operator tools, and host diagnostics.';
  const cards = navItems.filter((item) => item.id !== 'chat').map((item) => {
    const badge = featuredIds.includes(item.id)
      ? '<span style="font-size:0.62rem;background:var(--accent);color:#0d0d0f;padding:0.1rem 0.35rem;border-radius:4px;margin-left:0.4rem;font-weight:700;vertical-align:middle">New</span>'
      : '';
    return [
      `<a class="ws-card" href="${item.href}">`,
      `<h3>${item.label}${badge}</h3>`,
      `<p>${item.description}</p>`,
      '</a>',
    ].join('');
  }).join('\n');

  return [
    `<header class="ws-page-header"><h1>${mode === 'hosted' ? 'Cloud Workspace' : 'Instance Workspace'}</h1></header>`,
    '<div class="ws-hub">',
    `<p class="ws-hub-intro">${intro}</p>`,
    '<div class="ws-card-grid">',
    cards,
    '</div>',
    '</div>',
  ].join('\n');
}

export function injectWorkspaceHub(html: string, mode: ProductMode = 'private'): string {
  let out = injectWorkspaceChrome(html, 'hub', mode);
  return out.replace('<!--CARINA_WORKSPACE_HUB-->', workspaceHubCardsHtml(mode));
}

export function injectChatShellBranding(html: string, mode: ProductMode): string {
  const branding = workspaceBrandingForMode(mode);
  let out = html;
  const title = mode === 'hosted' ? 'Carina Cloud' : 'Carina Agent';
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  out = out.replace(
    '<span class="name">Carina</span>',
    `<span class="name" id="product-brand-name">${branding.productName}</span>`,
  );
  if (!out.includes('data-product-mode=')) {
    out = out.replace('<body>', `<body data-product-mode="${mode}">`);
  }
  return out;
}
