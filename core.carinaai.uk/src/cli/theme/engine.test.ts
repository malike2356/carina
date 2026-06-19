import { describe, expect, it } from 'vitest';
import { spinnerLabel } from './engine.js';
import { pickSpinnerFace } from './faces.js';
import { pickVerb } from './verbs.js';

describe('cli theme engine', () => {
  it('cycles spinner faces and verbs', () => {
    expect(pickSpinnerFace('dots', 0)).toBeTruthy();
    expect(pickVerb('playful', 1)).toBeTruthy();
    expect(spinnerLabel(2)).toMatch(/\.\.\./);
  });
});
