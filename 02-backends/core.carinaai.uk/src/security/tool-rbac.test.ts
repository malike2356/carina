import { describe, expect, it } from 'vitest';
import { evaluateToolRbac, minRoleForToolTier } from './tool-rbac.js';

describe('tool-rbac', () => {
  it('allows all tools when no org role (local operator)', () => {
    expect(evaluateToolRbac('shell-exec', undefined).allowed).toBe(true);
  });

  it('blocks shell-exec for viewer', () => {
    const decision = evaluateToolRbac('shell-exec', 'viewer');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('viewer');
  });

  it('blocks shell-exec for auditor', () => {
    expect(evaluateToolRbac('shell-exec', 'auditor').allowed).toBe(false);
  });

  it('allows medium-risk file-read for auditor', () => {
    expect(evaluateToolRbac('file-read', 'auditor').allowed).toBe(true);
  });

  it('allows high-risk file-write for operator', () => {
    expect(evaluateToolRbac('file-write', 'operator').allowed).toBe(true);
  });

  it('allows critical shell for admin', () => {
    expect(evaluateToolRbac('shell-exec', 'admin').allowed).toBe(true);
  });

  it('maps minimum role for critical tier', () => {
    expect(minRoleForToolTier('critical')).toBe('admin');
    expect(minRoleForToolTier('low')).toBe('viewer');
  });
});
