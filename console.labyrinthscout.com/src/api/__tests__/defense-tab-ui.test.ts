import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Defense tab dashboard markup', () => {
  const html = readFileSync(path.join(ROOT, 'public/dashboard.html'), 'utf8');
  const defenseJs = readFileSync(path.join(ROOT, 'public/dashboard/js/widgets/defense-tab.js'), 'utf8');

  it('includes Overview and Defense tabs', () => {
    expect(html).toContain('data-view="overview"');
    expect(html).toContain('data-view="defense"');
    expect(html).toContain('id="view-defense"');
    expect(html).toContain('id="view-overview"');
  });

  it('groups defense control panels', () => {
    expect(html).toContain('id="defense-shield-panel"');
    expect(html).toContain('id="defense-packs-panel"');
    expect(html).toContain('id="defense-jit-panel"');
    expect(html).toContain('id="defense-simulation-panel"');
    expect(html).toContain('id="defense-remediation-panel"');
    expect(html).toContain('id="defense-tripwire-panel"');
  });

  it('keeps overview response terminal intact', () => {
    expect(html).toContain('id="response-terminal-panel"');
  });

  it('wires policy pack apply to API', () => {
    expect(defenseJs).toContain('/api/policy-packs/apply');
    expect(defenseJs).toContain('/api/policy-packs/rollback');
  });

  it('wires JIT grant create and revoke', () => {
    expect(defenseJs).toContain('/api/jit/grants');
    expect(defenseJs).toContain("method: 'DELETE'");
  });

  it('wires simulation preview API', () => {
    expect(defenseJs).toContain('/api/simulation/preview');
  });

  it('marks remediation rule toggle as config only', () => {
    expect(defenseJs).toContain('config only');
    expect(defenseJs).not.toContain('toggleRule');
  });

  it('requires confirmation before destructive actions', () => {
    expect(defenseJs).toContain('confirmAction');
    expect(html).toContain('id="defense-confirm-overlay"');
  });
});
