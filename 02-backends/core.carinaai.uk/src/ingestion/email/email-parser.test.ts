import { describe, expect, it } from 'vitest';
import { parseEmailDigest } from './email-parser.js';

describe('parseEmailDigest', () => {
  it('extracts amounts, dates, and property reference', () => {
    const digest = parseEmailDigest({
      from: 'manager@property.co.uk',
      subject: 'Rent received Flat 4',
      body: 'Rent of GBP 850 received on 12/06/2026 for Flat 4. Action required by Friday.',
      roleTag: 'property_manager',
    });

    expect(digest.role).toBe('property_manager');
    expect(digest.propertyRef).toBe('4');
    expect(digest.amounts.length).toBeGreaterThan(0);
    expect(digest.dates.length).toBeGreaterThan(0);
    expect(digest.actionRequired).toBe(true);
    expect(digest.summary).toContain('Rent received Flat 4');
  });
});
