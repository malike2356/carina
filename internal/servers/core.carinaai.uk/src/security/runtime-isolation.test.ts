import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('runtime isolation: approvals and sandbox session', () => {
  it('orchestrator does not import approval store or sandbox session directly', () => {
    const src = fs.readFileSync(path.join(ROOT, 'agents/orchestrator.ts'), 'utf8');
    expect(src).not.toMatch(/approval-store|approval-policy|sandbox-session/);
  });

  it('tool-runner loads approval policy lazily via security module only', () => {
    const src = fs.readFileSync(path.join(ROOT, 'agents/tool-runner.ts'), 'utf8');
    expect(src).toMatch(/approval-policy/);
    expect(src).not.toMatch(/sandbox-containers|sandbox-session/);
  });

  it('shell session sandbox is opt-in via env or param', () => {
    const src = fs.readFileSync(path.join(ROOT, 'tools/shell.ts'), 'utf8');
    expect(src).toMatch(/sessionSandboxEnabled/);
    expect(src).toMatch(/sandbox_session/);
  });

  it('orchestrator does not import channel ownership or DM pairing stores', () => {
    const src = fs.readFileSync(path.join(ROOT, 'agents/orchestrator.ts'), 'utf8');
    expect(src).not.toMatch(/thread-ownership|dm-pairing|inbound-guards|channel-status/);
  });

  it('orchestrator does not import node host or control status modules', () => {
    const src = fs.readFileSync(path.join(ROOT, 'agents/orchestrator.ts'), 'utf8');
    expect(src).not.toMatch(/node-host|control-status|node-command-policy|extensibility-status|taskflows/);
  });

  it('inbound guards short-circuit when features disabled', async () => {
    const src = fs.readFileSync(path.join(ROOT, 'gateway/channels/inbound-guards.ts'), 'utf8');
    expect(src).toMatch(/if \(!dmOn && !ownershipOn\)/);
  });
});
