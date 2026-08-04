import { describe, expect, it } from 'vitest';
import { matchSaveAsSkillPhrase } from './conversational-skills.js';
import { loadDepthFeatures } from './features.js';
import { getCatalogTool } from './catalog.js';

describe('aiva maturity features (config-driven)', () => {
  it('enables accounts, org switcher, and conversational save phrases', () => {
    const features = loadDepthFeatures(true);
    expect(features.tools?.accountsEnabled).toBe(true);
    expect(features.orgs.switcherEnabled).toBe(true);
    expect(features.skills.conversationalSave).toBe(true);
    expect((features.skills.savePhrases ?? []).length).toBeGreaterThan(0);
  });
});

describe('conversational save-as-skill phrases', () => {
  it('matches configured phrases without hardcoded only strings', () => {
    expect(matchSaveAsSkillPhrase('please save this as a skill for me')).toBeTruthy();
    expect(matchSaveAsSkillPhrase('remember how to do this')).toBeTruthy();
    expect(matchSaveAsSkillPhrase('just say hello')).toBeNull();
  });
});

describe('deeper google + crm catalog actions', () => {
  it('exposes gmail draft, calendar create/update, sheets append', () => {
    const gmail = getCatalogTool('gmail');
    const cal = getCatalogTool('google-calendar');
    const sheets = getCatalogTool('google-sheets');
    const drive = getCatalogTool('google-drive');
    expect(gmail?.actions?.some((a) => a.id === 'draft')).toBe(true);
    expect(gmail?.actions?.some((a) => a.id === 'get')).toBe(true);
    expect(gmail?.actions?.some((a) => a.id === 'get-attachment')).toBe(true);
    expect(cal?.actions?.some((a) => a.id === 'create')).toBe(true);
    expect(cal?.actions?.some((a) => a.id === 'update')).toBe(true);
    expect(sheets?.actions?.some((a) => a.id === 'append')).toBe(true);
    expect(drive?.actions?.some((a) => a.id === 'search')).toBe(true);
    expect(drive?.actions?.some((a) => a.id === 'read')).toBe(true);
  });

  it('exposes deeper hubspot/pipedrive and live salesforce query', () => {
    expect(getCatalogTool('hubspot')?.actions?.some((a) => a.id === 'get_contact')).toBe(true);
    expect(getCatalogTool('pipedrive')?.actions?.some((a) => a.id === 'create_person')).toBe(true);
    expect(getCatalogTool('salesforce')?.status).toBe('live');
    expect(getCatalogTool('salesforce')?.actions?.some((a) => a.id === 'query')).toBe(true);
  });
});
