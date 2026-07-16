import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Migrated Defense dashboard surface', () => {
  const html = readFileSync(path.join(ROOT, 'public/dashboard.html'), 'utf8');
  const defenseJs = readFileSync(path.join(ROOT, 'public/dashboard/js/widgets/defense-tab.js'), 'utf8');
  const governanceJs = readFileSync(path.join(ROOT, 'public/dashboard/js/widgets/governance-tab.js'), 'utf8');
  const governanceRenderJs = readFileSync(path.join(ROOT, 'public/dashboard/js/widgets/governance-render.js'), 'utf8');

  it('redirects the retired operator dashboard to Ops', () => {
    expect(html).toContain('http-equiv="refresh"');
    expect(html).toContain('content="0;url=https://ops.carinaai.uk/scout"');
    expect(html).toContain('href="https://ops.carinaai.uk/scout"');
  });

  it('does not retain a second set of operator defense controls', () => {
    expect(html).not.toContain('id="defense-shield-panel"');
    expect(html).not.toContain('id="defense-packs-panel"');
    expect(html).not.toContain('id="defense-jit-panel"');
    expect(html).not.toContain('id="defense-simulation-panel"');
    expect(html).not.toContain('id="defense-remediation-panel"');
    expect(html).not.toContain('id="defense-tripwire-panel"');
  });

  it('does not expose the retired local response terminal', () => {
    expect(html).not.toContain('id="response-terminal-panel"');
  });

  it('retains shared posture API wiring in the migrated widget assets', () => {
    expect(governanceJs).toContain('/api/governance/posture');
    expect(governanceRenderJs).toContain('DASHBOARD_TAB_IDS');
    expect(defenseJs).toContain("view !== 'governance'");
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

  it('retains confirmation logic without exposing a stale local overlay', () => {
    expect(defenseJs).toContain('confirmAction');
    expect(html).not.toContain('id="defense-confirm-overlay"');
  });
});
