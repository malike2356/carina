import { describe, expect, it } from 'vitest';
import {
  injectWorkspaceChrome,
  workspaceHubCardsHtml,
  workspaceSidebarHtml,
  WORKSPACE_NAV_ITEMS,
} from './workspace-chrome.js';

describe('workspace-chrome', () => {
  it('injects sidebar and main wrapper between workspace markers', () => {
    const html = injectWorkspaceChrome(
      '<html><head></head><body><!--CARINA_WORKSPACE_BEGIN--><main>app</main><!--CARINA_WORKSPACE_END--></body></html>',
      'notes',
    );
    expect(html).toContain('carina-ws-sidebar');
    expect(html).toContain('carina-ws-main');
    expect(html).toContain('data-workspace-page="notes"');
    expect(html).toContain('href="/notes" class="active"');
    expect(html).toContain('<main>app</main>');
  });

  it('adds Inter font, shared theme CSS, and workspace prefs script', () => {
    const html = injectWorkspaceChrome('<html><head></head><body></body></html>', 'documents');
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(html).toContain('id="carina-workspace-theme"');
    expect(html).toContain('--accent: #19c49a');
    expect(html).toContain('workspace-prefs.js');
  });

  it('renders hub cards for each workspace app except chat', () => {
    const cards = workspaceHubCardsHtml();
    expect(cards).toContain('href="/notes"');
    expect(cards).toContain('href="/documents"');
    expect(cards).toContain('href="/email"');
    expect(cards).toContain('href="/calendar"');
    expect(cards).not.toContain('href="/"');
    expect(WORKSPACE_NAV_ITEMS.length).toBeGreaterThan(4);
  });

  it('sidebar marks the active page', () => {
    const sidebar = workspaceSidebarHtml('images');
    expect(sidebar).toContain('href="/images" class="active"');
    expect(sidebar).not.toContain('href="/notes" class="active"');
  });
});
