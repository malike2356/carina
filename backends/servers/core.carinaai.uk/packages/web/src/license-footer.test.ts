import { describe, expect, it } from 'vitest';
import { injectMitLicenseFooter, mitLicenseFooterHtml } from './license-footer.js';

describe('injectMitLicenseFooter', () => {
  it('appends the footer by default', () => {
    const html = injectMitLicenseFooter('<html><body><main>app</main></body></html>', '1.2.3');
    expect(html).toContain('carina-mit-footer');
    expect(html).toContain('title="Carina v1.2.3 · MIT License"');
    expect(html).toContain('>MIT</a>');
  });

  it('skips injection when disabled', () => {
    const html = injectMitLicenseFooter('<html><body><main>login</main></body></html>', '1.2.3', false);
    expect(html).toBe('<html><body><main>login</main></body></html>');
  });

  it('keeps existing footer markup unchanged', () => {
    const html = '<html><body>' + mitLicenseFooterHtml('1.2.3') + '</body></html>';
    expect(injectMitLicenseFooter(html, '1.2.3')).toBe(html);
  });

  it('injects before closing body, not in the composer area', () => {
    const html = '<html><body><p class="composer-hint">Hint</p></body></html>';
    const out = injectMitLicenseFooter(html, '1.2.3');
    expect(out).toContain('carina-mit-footer');
    expect(out.indexOf('carina-mit-footer')).toBeGreaterThan(out.indexOf('composer-hint'));
    expect(out).toMatch(/carina-mit-footer[\s\S]*<\/body>/);
  });
});
