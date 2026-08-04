import { describe, expect, it } from 'vitest';
import {
  AIVA_PREPAID_PACKS,
  isAivaPrepaidPackId,
  listAivaPrepaidPacks,
} from './aiva-prepaid-packs.js';

describe('aiva-prepaid-packs', () => {
  it('defines £5 / £10 / £25 packs at 20 messages per pound', () => {
    expect(AIVA_PREPAID_PACKS.gbp5.messages).toBe(100);
    expect(AIVA_PREPAID_PACKS.gbp10.messages).toBe(200);
    expect(AIVA_PREPAID_PACKS.gbp25.messages).toBe(500);
    expect(listAivaPrepaidPacks()).toHaveLength(3);
    expect(isAivaPrepaidPackId('gbp10')).toBe(true);
    expect(isAivaPrepaidPackId('nope')).toBe(false);
  });
});
