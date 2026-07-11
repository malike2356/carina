import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCAL_MODEL_ID,
  LOCAL_MODEL_CATALOG,
  getCatalogEntry,
  requireCatalogEntry,
} from './local-model';

describe('local-model catalog', () => {
  it('includes Llama, Qwen, and Gemma', () => {
    const ids = LOCAL_MODEL_CATALOG.map((entry) => entry.id);
    expect(ids).toEqual([
      'llama-3.2-1b-instruct-q4km',
      'qwen2.5-1.5b-instruct-q4km',
      'gemma-2-2b-it-q4km',
    ]);
  });

  it('defaults to Llama 1B', () => {
    expect(DEFAULT_LOCAL_MODEL_ID).toBe('llama-3.2-1b-instruct-q4km');
    expect(requireCatalogEntry(DEFAULT_LOCAL_MODEL_ID).displayName).toContain('Llama');
  });

  it('resolves entries by id', () => {
    expect(getCatalogEntry('qwen2.5-1.5b-instruct-q4km')?.shortName).toBe('Qwen 1.5B');
    expect(getCatalogEntry('missing')).toBeNull();
  });
});
