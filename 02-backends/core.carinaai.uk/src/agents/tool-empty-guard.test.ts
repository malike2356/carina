import { describe, expect, it } from 'vitest';
import { guardEmptyToolResult, isVacuousToolResult } from './tool-empty-guard.js';

describe('tool-empty-guard', () => {
  it('treats null, empty arrays, and empty objects as vacuous', () => {
    expect(isVacuousToolResult(null)).toBe(true);
    expect(isVacuousToolResult(undefined)).toBe(true);
    expect(isVacuousToolResult([])).toBe(true);
    expect(isVacuousToolResult({})).toBe(true);
    expect(isVacuousToolResult('   ')).toBe(true);
  });

  it('treats common empty collection payloads as vacuous', () => {
    expect(isVacuousToolResult({ contacts: [], count: 0, query: 'Sam' })).toBe(true);
    expect(isVacuousToolResult({ results: [] })).toBe(true);
    expect(isVacuousToolResult({ files: [], total: 0 })).toBe(true);
  });

  it('keeps non-empty and error payloads intact', () => {
    expect(isVacuousToolResult({ contacts: [{ name: 'Sam' }], count: 1 })).toBe(false);
    expect(isVacuousToolResult({ ok: true })).toBe(false);
    expect(isVacuousToolResult({ error: 'missing credentials', contacts: [] })).toBe(false);
    expect(isVacuousToolResult({ contacts: [], hint: 'run sync first' })).toBe(false);
  });

  it('wraps vacuous results with an explicit empty marker for the model', () => {
    const guarded = guardEmptyToolResult('contacts', { contacts: [], count: 0 });
    expect(guarded).toMatchObject({
      status: 'empty',
      code: 'TOOL_EMPTY_RESULT',
      message: expect.stringContaining('found no matching records'),
      result: { contacts: [], count: 0 },
    });
    expect(guardEmptyToolResult('contacts', { contacts: [{ id: '1' }], count: 1 })).toEqual({
      contacts: [{ id: '1' }],
      count: 1,
    });
  });
});
