import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { findContact, loadAllContacts } from './contacts.js';

describe('contacts', () => {
  let tmp = '';

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-contacts-'));
    process.env.CARINA_HOME = tmp;
    await fs.writeFile(path.join(tmp, 'contacts.json'), JSON.stringify([
      { id: 'landlord-1', name: 'Mr Patel', role: 'landlord', whatsapp: '+447700900001', notes: 'Unit 4' },
    ]), 'utf8');
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('loads contacts.json', async () => {
    const all = await loadAllContacts();
    expect(all.some((c) => c.name === 'Mr Patel')).toBe(true);
  });

  it('searches by role', async () => {
    const found = await findContact('landlord');
    expect(found[0]?.name).toBe('Mr Patel');
  });
});
