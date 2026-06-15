import { describe, expect, it } from 'vitest';
import { aboutText, versionWithLicenseLine } from './about-cli.js';

describe('about command copy', () => {
  it('includes MIT license statement', () => {
    const text = aboutText('1.2.3');
    expect(text).toContain('License: MIT');
    expect(text).toContain('Build commercial products on Carina');
    expect(text).toContain('AGPL-3.0 alternatives');
    expect(text).toContain('Carina does not.');
  });

  it('version line includes MIT license', () => {
    const line = versionWithLicenseLine('9.9.9');
    expect(line).toContain('9.9.9');
    expect(line).toContain('MIT License');
    expect(line).toContain('Build commercial products freely');
  });
});
