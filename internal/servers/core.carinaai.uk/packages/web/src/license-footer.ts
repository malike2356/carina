const DEFAULT_VERSION = '0.2.0';

const FOOTER_STYLE = [
  'position:fixed',
  'right:5px',
  'bottom:3px',
  'z-index:2',
  'margin:0',
  'padding:0',
  'font-size:8px',
  'line-height:1',
  'color:var(--muted,#8b949e)',
  'opacity:0.18',
  'letter-spacing:0',
  'pointer-events:auto',
  'user-select:none',
].join(';');

const LINK_STYLE = 'color:inherit;text-decoration:none';

export function mitLicenseFooterHtml(version = DEFAULT_VERSION): string {
  const title = `Carina v${version} · MIT License`;
  return [
    `<p id="carina-mit-footer" class="carina-mit-footer" style="${FOOTER_STYLE}" aria-hidden="true">`,
    `<a href="https://github.com/carinaai/core/blob/main/LICENSE" target="_blank" rel="noopener" `,
    `title="${title}" style="${LINK_STYLE}">MIT</a>`,
    '</p>',
  ].join('');
}

export function injectMitLicenseFooter(html: string, version = DEFAULT_VERSION, include = true): string {
  if (!include) return html;
  if (html.includes('id="carina-mit-footer"')) return html;

  const footer = mitLicenseFooterHtml(version);
  if (!html.includes('</body>')) return html;
  return html.replace('</body>', `${footer}\n</body>`);
}

export function injectWhyCarinaSection(html: string): string {
  if (html.includes('id="why-carina-panel"')) return html;
  const panel = [
    '<section id="why-carina-panel" style="max-width:48rem;margin:0 auto 12px;padding:12px 16px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);font-size:0.82rem;line-height:1.5;">',
    '<h3 style="font-size:0.95rem;margin-bottom:8px;">Why Carina</h3>',
    '<ul style="margin:0;padding-left:18px;color:var(--muted);">',
    '<li>MIT license: build and sell products without open-sourcing your app code</li>',
    '<li>Scout security layer: injection shield, kill switch, audit log, egress filtering</li>',
    '<li>Multi-tenancy and hosted mode: not just a single-user workspace</li>',
    '<li>Domain packs: vertical skill sets for specific industries</li>',
    '<li>Channel breadth: 18+ adapters vs web-only stacks</li>',
    '</ul>',
    '</section>',
  ].join('');
  return html.replace('<div id="chat-scroll">', `${panel}\n    <div id="chat-scroll">`);
}
