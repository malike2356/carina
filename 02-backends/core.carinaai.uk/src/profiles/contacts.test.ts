import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  deleteManualContact,
  findContact,
  loadAllContacts,
  manualContactsFile,
  upsertManualContact,
} from './contacts.js';

describe('contacts', () => {
  let tmp = '';

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-contacts-'));
    process.env.CARINA_HOME = tmp;
    delete process.env.HOSTED_MODE;
    delete process.env.CARINA_OPS_PRODUCT_ENABLED;
    await fs.writeFile(path.join(tmp, 'contacts.json'), JSON.stringify([
      { id: 'landlord-1', name: 'Mr Patel', role: 'landlord', whatsapp: '+447700900001', notes: 'Unit 4' },
    ]), 'utf8');
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    delete process.env.HOSTED_MODE;
    delete process.env.CARINA_OPS_PRODUCT_ENABLED;
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

  it('matches partial person names in contact search', async () => {
    await fs.mkdir(path.join(tmp, 'profiles', 'contacts'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'profiles', 'contacts', 'google-test.json'),
      JSON.stringify([
        {
          id: 'people/alex',
          name: 'Mr. Alex Karikari Frempong',
          phone: '+23324 381 4009',
          source: 'google',
        },
        {
          id: 'people/1102',
          name: '1102',
          phone: '+233549167764',
          source: 'google',
        },
      ]),
      'utf8',
    );
    // Host/single-tenant mode (no HOSTED_MODE): unscoped load still works.
    const hits = await findContact('Alex Karikari');
    expect(hits[0]?.name).toBe('Mr. Alex Karikari Frempong');
    expect(hits[0]?.phone).toBe('+23324 381 4009');
  });

  it('isolates google contacts by workspace id', async () => {
    process.env.HOSTED_MODE = 'true';
    await fs.mkdir(path.join(tmp, 'profiles', 'contacts'), { recursive: true });
    const laudWs = 'cbfccc8e-5406-47b2-a325-edb107793043';
    const otherWs = 'b4a6ce73-b3ca-46a7-8de1-72f0a9a49ed6';
    await fs.writeFile(
      path.join(tmp, 'profiles', 'contacts', `google-${laudWs}.json`),
      JSON.stringify([
        { id: 'people/alex', name: 'Mr. Alex Karikari Frempong', phone: '+23324 381 4009', source: 'google' },
      ]),
      'utf8',
    );
    const { loadContactsForWorkspace, loadAllContacts } = await import('./contacts.js');
    expect((await loadContactsForWorkspace(laudWs)).map((c) => c.name)).toEqual([
      'Mr. Alex Karikari Frempong',
    ]);
    expect(await loadContactsForWorkspace(otherWs)).toEqual([]);
    expect(await loadAllContacts()).toEqual([]);
    expect((await findContact('Alex', laudWs))[0]?.name).toBe('Mr. Alex Karikari Frempong');
    expect(await findContact('Alex', otherWs)).toEqual([]);
  });

  it('enriches google contacts with email and telegram overlays', async () => {
    await fs.mkdir(path.join(tmp, 'profiles', 'contacts'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'profiles', 'contacts', 'google-test.json'),
      JSON.stringify([
        {
          id: 'people/alex',
          name: 'Mr. Alex Karikari Frempong',
          phone: '+23324 381 4009',
          source: 'google',
        },
      ]),
      'utf8',
    );
    const { enrichContactChannels } = await import('./contacts.js');
    const enriched = await enrichContactChannels('people/alex', {
      email: 'ceo@kariboreholes.com',
      telegram: '@Baffour19',
    });
    expect(enriched?.email).toBe('ceo@kariboreholes.com');
    expect(enriched?.telegram).toBe('@Baffour19');
    const hits = await findContact('Alex Karikari');
    expect(hits[0]?.email).toBe('ceo@kariboreholes.com');
    expect(hits[0]?.telegram).toBe('@Baffour19');
  });

  it('fuzzy-matches close spellings like Apigey to Appiah', async () => {
    await fs.mkdir(path.join(tmp, 'profiles', 'contacts'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'profiles', 'contacts', 'google-test.json'),
      JSON.stringify([
        { id: 'people/alex', name: 'Mr. Alex Karikari Frempong', phone: '+23324 381 4009', source: 'google' },
        { id: 'people/appiah', name: 'Mr Appiah', phone: '0202220269', source: 'google' },
        { id: 'people/michael', name: 'Michael Appiah @ Developer', phone: '024 545 5876', source: 'google' },
        { id: 'people/apple', name: 'Desmond @ Apple Store Circle', phone: '0240000000', source: 'google' },
        { id: 'people/aposa', name: 'APOSA', phone: '0241111111', source: 'google' },
      ]),
      'utf8',
    );
    const hits = await findContact('Apigey');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => /appiah/i.test(h.name))).toBe(true);
    expect(hits.some((h) => /karikari|apple|aposa/i.test(h.name))).toBe(false);
  });

  it('prefers real Afia token matches over noisy near-misses', async () => {
    await fs.mkdir(path.join(tmp, 'profiles', 'contacts'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'profiles', 'contacts', 'google-test.json'),
      JSON.stringify([
        { id: '1', name: 'Afia', phone: '1', source: 'google' },
        { id: '2', name: 'Afia @ Salon', phone: '2', source: 'google' },
        { id: '3', name: 'Afia Gablah @ UEWK', phone: '3', source: 'google' },
        { id: '4', name: 'Edinam Setsoafia', phone: '4', source: 'google' },
        { id: '5', name: 'AFI Developer', phone: '5', source: 'google' },
        { id: '6', name: 'Alia Kia Driver', phone: '6', source: 'google' },
        { id: '7', name: 'Prince Amia Kwofie', phone: '7', source: 'google' },
      ]),
      'utf8',
    );
    const hits = await findContact('Afia');
    expect(hits.map((h) => h.name)).toEqual([
      'Afia',
      'Afia @ Salon',
      'Afia Gablah @ UEWK',
    ]);
  });

  it('matches Larissa via email local-part when display name is numeric', async () => {
    await fs.mkdir(path.join(tmp, 'profiles', 'contacts'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'profiles', 'contacts', 'google-test.json'),
      JSON.stringify([
        {
          id: 'people/1199',
          name: '1199',
          email: 'mankahlarissa4@gmail.com',
          phone: '+447538576159',
          source: 'google',
        },
      ]),
      'utf8',
    );
    const hits = await findContact('Larissa');
    expect(hits[0]?.email).toBe('mankahlarissa4@gmail.com');
  });
});
