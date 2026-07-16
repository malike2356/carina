import { describe, expect, it } from 'vitest';
import {
  filterToolsForPlanMode,
  isPlanModeAllowed,
} from './plan-mode-allowlist.js';
import type { Tool } from '../types/index.js';

function stubTool(name: string): Tool {
  return { name, description: name, parameters: {}, execute: async () => null };
}

describe('Plan Mode Allowlist', () => {
  it('blocks all mutating tools by default', () => {
    expect(isPlanModeAllowed('shell-exec')).toBe(false);
    expect(isPlanModeAllowed('file-write')).toBe(false);
    expect(isPlanModeAllowed('send-message')).toBe(false);
    expect(isPlanModeAllowed('delegate-task')).toBe(false);
  });

  it('allows explicitly listed read-only tools', () => {
    expect(isPlanModeAllowed('web-search')).toBe(true);
    expect(isPlanModeAllowed('file-read')).toBe(true);
    expect(isPlanModeAllowed('session-search')).toBe(true);
    expect(isPlanModeAllowed('skills-list')).toBe(true);
  });

  it('defaults to BLOCKED for unknown tools (fail-safe)', () => {
    expect(isPlanModeAllowed('some_new_tool')).toBe(false);
    expect(isPlanModeAllowed('')).toBe(false);
  });

  it('filters tool list correctly', () => {
    const tools = [
      stubTool('web-search'),
      stubTool('shell-exec'),
      stubTool('file-write'),
      stubTool('file-read'),
    ];
    const { allowed, blocked } = filterToolsForPlanMode(tools);
    expect(allowed.map((t) => t.name)).toEqual(['web-search', 'file-read']);
    expect(blocked).toEqual(['shell-exec', 'file-write']);
  });
});
