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
      'private',
    );
    expect(html).toContain('carina-ws-sidebar');
    expect(html).toContain('carina-ws-main');
    expect(html).toContain('data-workspace-page="notes"');
    expect(html).toContain('data-product-mode="private"');
    expect(html).toContain('href="/notes" class="active"');
    expect(html).toContain('<main>app</main>');
  });

  it('uses different branding for hosted vs private shells', () => {
    const hosted = workspaceSidebarHtml('memory', 'hosted');
    const priv = workspaceSidebarHtml('memory', 'private');
    expect(hosted).toContain('Cloud Workspace');
    expect(hosted).toContain('data-product-mode="hosted"');
    expect(priv).toContain('Instance Workspace');
    expect(priv).toContain('Control Center');
    expect(hosted).not.toContain('Control Center');
    expect(priv).not.toContain('Cloud Workspace');
  });

  it('omits operator-only nav items from hosted shell', () => {
    const hosted = workspaceSidebarHtml('chat', 'hosted');
    const priv = workspaceSidebarHtml('chat', 'private');
    expect(hosted).not.toContain('href="/kanban"');
    expect(hosted).not.toContain('href="/email"');
    expect(hosted).not.toContain('href="/prompt-packs"');
    expect(hosted).not.toContain('href="/trello"');
    expect(priv).toContain('href="/kanban"');
    expect(priv).toContain('href="/email"');
    expect(priv).toContain('href="/prompt-packs"');
    expect(priv).toContain('href="/trello"');
  });

  it('adds Inter font, shared theme CSS, and workspace prefs script', () => {
    const html = injectWorkspaceChrome('<html><head></head><body></body></html>', 'documents');
    expect(html).toContain('fonts.googleapis.com/css2?family=Inter');
    expect(html).toContain('id="carina-workspace-theme"');
    expect(html).toContain('--accent: #19c49a');
    expect(html).toContain('workspace-prefs.js');
  });

  it('renders a locale switcher in the workspace sidebar', () => {
    const sidebar = workspaceSidebarHtml('documents', 'private');
    expect(sidebar).toContain('locale-switcher');
    expect(sidebar).toContain('Language');
  });

  it('renders a profile scope placeholder in the workspace sidebar', () => {
    const sidebar = workspaceSidebarHtml('documents', 'private');
    expect(sidebar).toContain('ws-profile-scope');
  });

  it('renders hub cards for each workspace app except chat', () => {
    const cards = workspaceHubCardsHtml('private');
    expect(cards).toContain('href="/notes"');
    expect(cards).toContain('href="/documents"');
    expect(cards).toContain('href="/email"');
    expect(cards).toContain('href="/calendar"');
    expect(cards).toContain('href="/research"');
    expect(cards).toContain('href="/compare"');
    expect(cards).toContain('Deep Research');
    expect(cards).toContain('href="/prompt-packs"');
    expect(cards).toContain('Prompt packs');
    expect(cards).toContain('href="/playbook"');
    expect(cards).toContain('Playbook');
    expect(cards).toContain('New</span>');
    expect(cards).not.toContain('href="/"');
    expect(WORKSPACE_NAV_ITEMS.length).toBeGreaterThan(4);
  });

  it('hosted hub intro does not mention private instance', () => {
    const hosted = workspaceHubCardsHtml('hosted');
    const priv = workspaceHubCardsHtml('private');
    expect(hosted).toContain('Carina Cloud');
    expect(priv).toContain('private instance');
    expect(hosted).not.toContain('private instance');
  });

  it('renders custom brand logo and product name in hosted sidebar', () => {
    const sidebar = workspaceSidebarHtml('chat', 'hosted', {
      productName: 'Nova Cloud',
      shortName: 'Nova',
      logoUrl: 'https://cdn.example/logo.png',
      colorTokens: { '--accent': '#3366ff' },
    });
    expect(sidebar).toContain('https://cdn.example/logo.png');
    expect(sidebar).toContain('Nova Cloud');
  });

  it('orders research and compare before email in nav', () => {
    const researchIdx = WORKSPACE_NAV_ITEMS.findIndex((item) => item.id === 'research');
    const compareIdx = WORKSPACE_NAV_ITEMS.findIndex((item) => item.id === 'compare');
    const emailIdx = WORKSPACE_NAV_ITEMS.findIndex((item) => item.id === 'email');
    expect(researchIdx).toBeGreaterThan(-1);
    expect(compareIdx).toBeGreaterThan(researchIdx);
    expect(emailIdx).toBeGreaterThan(compareIdx);
  });

  it('sidebar marks the active page', () => {
    const sidebar = workspaceSidebarHtml('images', 'private');
    expect(sidebar).toContain('href="/images" class="active"');
    expect(sidebar).not.toContain('href="/notes" class="active"');
  });

  it('includes mobile bottom nav markup for both modes', () => {
    const hosted = workspaceSidebarHtml('chat', 'hosted');
    const priv = workspaceSidebarHtml('chat', 'private');
    expect(hosted).toContain('carina-ws-bottom-nav');
    expect(priv).toContain('carina-ws-bottom-nav');
    expect(hosted).toContain('bnav-icon');
  });
});
