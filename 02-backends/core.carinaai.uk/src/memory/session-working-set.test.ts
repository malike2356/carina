import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSessionWorkingSet,
  demoteDurableMemorySuffix,
  extractWorkingSetItem,
  formatSessionWorkingSetForPrompt,
  recordSessionWorkingSetEvidence,
  stripWorkingSetDigestsFromHistory,
} from './session-working-set.js';

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-ws-'));

afterEach(() => {
  clearSessionWorkingSet('sess-a');
  clearSessionWorkingSet('sess-b');
});

describe('session working set', () => {
  it('extracts drive read evidence', () => {
    const item = extractWorkingSetItem('google-drive-read', {
      name: 'LaudPaul_cv_ITH_0626.docx',
      text: 'Laud Paul-Gablah Linux sysadmin MSc Cyber Security',
    });
    expect(item?.title).toContain('LaudPaul_cv');
    expect(item?.excerpt).toContain('Linux sysadmin');
  });

  it('persists and formats working set for fixed prompt injection', () => {
    process.env.CARINA_DATA_DIR = path.join(tmpHome, 'data');
    recordSessionWorkingSetEvidence('sess-a', 'google-drive-read', {
      name: 'CV-Linux.docx',
      text: 'Service Facilities Assistant at Portsmouth',
    });
    recordSessionWorkingSetEvidence('sess-a', 'google-drive-search', {
      query: 'cvs',
      text: 'Found 8 CV files',
    });
    const prompt = formatSessionWorkingSetForPrompt('sess-a');
    expect(prompt).toContain('ACTIVE WORKING SET');
    expect(prompt).toContain('CV-Linux.docx');
    expect(prompt).toContain('authoritative for follow-ups');
  });

  it('demotes durable memory when working set is active', () => {
    const durable = [
      'Persona and tools stay here.',
      'Durable memory (Hermes-style clear split):',
      'USER PROFILE',
      `${'BDAG note\n'.repeat(400)}`,
    ].join('\n');
    const demoted = demoteDurableMemorySuffix(durable, { workingSetActive: true, maxChars: 200 });
    expect(demoted).toContain('Persona and tools stay here.');
    expect(demoted).toContain('Durable memory demoted');
    expect(demoted.length).toBeLessThan(durable.length);
  });

  it('strips episodic working-set digests from history text', () => {
    const history = [
      'user: read my cvs',
      'assistant: here they are',
      'Working set from this turn (tool evidence; prefer over older memory notes):',
      '1. google-drive-read: huge blob',
      'user: from my cvs what do you know',
    ].join('\n');
    const cleaned = stripWorkingSetDigestsFromHistory(history);
    expect(cleaned).not.toContain('Working set from this turn');
    expect(cleaned).toContain('from my cvs what do you know');
  });
});
