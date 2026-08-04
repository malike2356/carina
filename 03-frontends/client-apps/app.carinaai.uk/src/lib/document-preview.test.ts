import { describe, expect, it } from 'vitest';
import { documentPreview, documentWordCount } from './document-preview';

describe('documentPreview', () => {
  it('strips HTML tags from previews', () => {
    const preview = documentPreview(
      '<h1>VERLOX</h1><p><em>One-page investor summary</em></p><p><strong>Company Name</strong> VERLOX Ltd</p>',
    );
    expect(preview).toContain('VERLOX');
    expect(preview).toContain('One-page investor summary');
    expect(preview).not.toContain('<h1>');
    expect(preview).not.toContain('<strong>');
  });

  it('strips markdown markers from previews', () => {
    const preview = documentPreview('# VERLOX - DBA Pitch Deck\n\n**12 slides** for Dorset Business Angels');
    expect(preview).toContain('VERLOX');
    expect(preview).toContain('12 slides');
    expect(preview).not.toContain('**');
    expect(preview).not.toMatch(/^#/);
  });

  it('counts words on plain text', () => {
    expect(documentWordCount('<p>Hello world from <strong>Aiva</strong></p>')).toBe(4);
  });
});
