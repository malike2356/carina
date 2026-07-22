import { describe, expect, it } from 'vitest';
import { aivaCreatedSubject } from './aiva-created-content.js';

describe('aiva-created-content', () => {
  it('builds a clear subject with the worker name', () => {
    expect(aivaCreatedSubject('Nova')).toBe('Meet Nova, your new Aiva');
  });
});
