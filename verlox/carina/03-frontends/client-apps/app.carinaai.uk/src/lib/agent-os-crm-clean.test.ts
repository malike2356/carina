import { describe, expect, it } from 'vitest';
import { cleanCrmCsv, rowsToCsv } from './agent-os-crm-clean';

describe('cleanCrmCsv', () => {
  it('normalizes headers and removes duplicate email rows', () => {
    const result = cleanCrmCsv(
      ' Full Name , Email \n"Ada Lovelace",ADA@example.com\nAda,ada@example.com\n',
    );
    expect(result.columns).toEqual(['full name', 'email']);
    expect(result.rows).toEqual([{ 'full name': 'Ada Lovelace', email: 'ADA@example.com' }]);
    expect(result.removedDuplicates).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('returns actionable validation errors for unusable input', () => {
    expect(cleanCrmCsv('email').errors).toContain(
      'File needs a header row and at least one data row.',
    );
    expect(cleanCrmCsv('company,phone\nAcme,123').errors).toContain(
      'Add an email or name column so rows can be identified.',
    );
  });
});

describe('rowsToCsv', () => {
  it('escapes commas and quotes', () => {
    expect(rowsToCsv(['name'], [{ name: 'Ada, "Countess"' }])).toBe(
      'name\n"Ada, ""Countess"""\n',
    );
  });
});
