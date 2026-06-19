import { describe, expect, it } from 'vitest';
import {
  injectMitLicenseFooter,
  injectWhyCarinaSection,
  mitLicenseFooterHtml,
} from '../../packages/web/src/license-footer.js';

describe('MIT license footer injection', () => {
  it('adds a tiny fixed footer before closing body', () => {
    const html = injectMitLicenseFooter(
      '<html><body><footer><p class="composer-hint">Carina can make mistakes.</p></footer></body></html>',
      '1.0.0',
    );
    expect(html).toContain('id="carina-mit-footer"');
    expect(html).toContain('title="Carina v1.0.0 · MIT License"');
    expect(html).toContain('>MIT</a>');
    expect(html).toMatch(/carina-mit-footer[\s\S]*<\/body>/);
  });

  it('does not duplicate footer when already present', () => {
    const once = injectMitLicenseFooter('<body></body>', '1.0.0');
    const twice = injectMitLicenseFooter(once, '1.0.0');
    expect((twice.match(/id="carina-mit-footer"/g) ?? []).length).toBe(1);
  });

  it('injects why-carina panel above chat scroll', () => {
    const html = injectWhyCarinaSection('<div id="chat-scroll"></div>');
    expect(html).toContain('id="why-carina-panel"');
    expect(html).toContain('Why Carina');
    expect(html.indexOf('why-carina-panel')).toBeLessThan(html.indexOf('chat-scroll'));
  });

  it('footer links to GitHub LICENSE', () => {
    expect(mitLicenseFooterHtml('0.2.0')).toContain('github.com/carinaai/core');
  });
});
