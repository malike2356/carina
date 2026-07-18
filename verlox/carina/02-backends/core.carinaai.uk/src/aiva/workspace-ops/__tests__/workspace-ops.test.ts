import { describe, expect, it } from 'vitest';
import { hashDocumentContent } from '../hash.js';
import { templateBodiesForPack } from '../bootstrap.js';
import {
  COMMUNITY_SESSIONS_FOLDER_LABELS,
  FOLDER_LABELS,
  folderLabelsForPack,
  isOpsCategory,
  isOpsPackProfile,
  OPS_CATEGORIES,
  packProfileFromBindingMeta,
  resolveOpsPackProfile,
} from '../types.js';
import { OPS_REMINDER_TEMPLATES } from '../reminders.js';
import { getRoleTemplate } from '../../../workers/role-templates.js';

describe('workspace-ops hash', () => {
  it('hashes title + body stably', () => {
    const a = hashDocumentContent('Minutes', 'Hello\r\nWorld');
    const b = hashDocumentContent('Minutes', 'Hello\nWorld');
    expect(a).toBe(b);
    expect(hashDocumentContent('Minutes', 'Hello\nWorld!')).not.toBe(a);
  });
});

describe('workspace-ops categories', () => {
  it('includes ops folders without product brand words', () => {
    expect(OPS_CATEGORIES).toContain('minutes');
    expect(OPS_CATEGORIES).toContain('attendance');
    expect(OPS_CATEGORIES).toContain('next-meeting');
    expect(OPS_CATEGORIES).toContain('funder-month');
    expect(isOpsCategory('minutes')).toBe(true);
    expect(isOpsCategory('charity')).toBe(false);
  });
});

describe('workspace-ops pack profiles', () => {
  it('resolves default and community-sessions profiles', () => {
    expect(isOpsPackProfile('default')).toBe(true);
    expect(isOpsPackProfile('community-sessions')).toBe(true);
    expect(isOpsPackProfile('other')).toBe(false);
    expect(resolveOpsPackProfile(undefined)).toBe('default');
    expect(resolveOpsPackProfile('community-sessions')).toBe('community-sessions');
    expect(packProfileFromBindingMeta({ packProfile: 'community-sessions' })).toBe(
      'community-sessions',
    );
    expect(packProfileFromBindingMeta({})).toBe('default');
  });

  it('keeps category keys stable while swapping Drive labels', () => {
    const community = folderLabelsForPack('community-sessions');
    const defaults = folderLabelsForPack('default');
    for (const category of OPS_CATEGORIES) {
      expect(defaults[category]).toBe(FOLDER_LABELS[category]);
      expect(community[category]).toBe(COMMUNITY_SESSIONS_FOLDER_LABELS[category]);
    }
    expect(community.minutes).toBe('02-Session-Notes');
    expect(community['next-meeting']).toBe('04-Session-Planner');
    expect(community['funder-month']).toBe('05-Funder-Reports');
    expect(community.templates).toBe('06-Posters-and-Templates');
    expect(defaults.minutes).toBe('02-Minutes');
  });

  it('seeds community templates without inventing attendees or numbers', () => {
    const community = templateBodiesForPack('community-sessions');
    expect(community.minutes.title).toMatch(/Session notes/i);
    expect(community.attendance.body).toMatch(/Do not invent attendees/i);
    expect(community['funder-month'].body).toMatch(/Do not invent attendees or numbers/i);
    expect(community['next-meeting'].title).toMatch(/Session planner/i);
    expect(community.templates.title).toMatch(/Poster/i);
    const defaults = templateBodiesForPack('default');
    expect(defaults.minutes.title).toMatch(/Minutes/i);
  });
});

describe('workspace-ops drive folder reuse helpers', () => {
  it('exports ensureNamedDriveFolder from drive-client', async () => {
    const mod = await import('../drive-client.js');
    expect(typeof mod.ensureNamedDriveFolder).toBe('function');
    expect(typeof mod.findDriveFoldersByName).toBe('function');
  });
});

describe('workspace-ops claim export', () => {
  it('exports claimDriveFileIntoAiva', async () => {
    const mod = await import('../sync-engine.js');
    expect(typeof mod.claimDriveFileIntoAiva).toBe('function');
  });
});

describe('workspace-ops reminders', () => {
  it('ships three primary + sync health templates', () => {
    expect(OPS_REMINDER_TEMPLATES.length).toBeGreaterThanOrEqual(3);
    expect(OPS_REMINDER_TEMPLATES.map((t) => t.key)).toEqual(
      expect.arrayContaining([
        'day-before-meeting',
        'day-after-meeting',
        'monthly-funder-pack',
        'sync-health',
      ]),
    );
  });

  it('uses community session language for monthly funder pack', () => {
    const monthly = OPS_REMINDER_TEMPLATES.find((t) => t.key === 'monthly-funder-pack');
    expect(monthly?.name).toMatch(/funder evidence/i);
    expect(monthly?.prompt).toMatch(/attendance sheets/i);
    expect(monthly?.prompt).toMatch(/charts come later/i);
    expect(monthly?.prompt.toLowerCase()).not.toMatch(/pie|dashboard|demographics/);
  });
});

describe('workspace-ops capture content', () => {
  it('builds funder-usable attendance sheets with session metadata', async () => {
    const { buildAttendanceContent } = await import('../capture.js');
    const { title, content } = buildAttendanceContent({
      meetingDate: '2026-07-10',
      sessionTitle: 'Coffee morning',
      venueOrSessionType: 'Community hall',
      present: ['Ada', 'Ben'],
      apologies: ['Chris'],
    });
    expect(title).toBe('Attendance 2026-07-10: Coffee morning');
    expect(content).toContain('Attendance sheet');
    expect(content).toContain('Session date: 2026-07-10');
    expect(content).toContain('Session name: Coffee morning');
    expect(content).toContain('Venue / session type: Community hall');
    expect(content).toContain('- Ada');
    expect(content).toContain('- Chris');
    expect(content).toMatch(/must not invent attendees/i);
    expect(content).toMatch(/Charts come later/i);
  });

  it('builds monthly funder evidence packs without inventing counts', async () => {
    const { buildFunderMonthContent } = await import('../capture.js');
    const { title, content } = buildFunderMonthContent({
      month: '2026-07',
      count: 12,
      sessionsHeldCount: 4,
      bullets: ['Hosted coffee morning', 'Delivered wellbeing group'],
      postersComms: ['Shared WhatsApp flyer'],
      outcomesQuotes: ['"I felt welcome"'],
    });
    expect(title).toBe('Monthly funder report 2026-07');
    expect(content).toContain('Monthly funder evidence pack');
    expect(content).toContain('Sessions held (count only if verified): 4');
    expect(content).toContain('People supported (count only if verified): 12');
    expect(content).toContain('- Hosted coffee morning');
    expect(content).toContain('- Shared WhatsApp flyer');
    expect(content).toContain('- "I felt welcome"');
    expect(content).toContain('Draft status: draft');
    expect(content).toContain('Human approval required before send.');
    expect(content).toMatch(/Charts come later/i);

    const blank = buildFunderMonthContent({
      month: '2026-06',
      count: null,
      sessionsHeldCount: null,
      bullets: [],
    });
    expect(blank.content).toContain('People supported (count only if verified): (not recorded)');
    expect(blank.content).toContain('Sessions held (count only if verified): (not recorded)');
  });
});

describe('workspace-ops-admin persona', () => {
  it('registers Operations Admin without charity identifiers', () => {
    const template = getRoleTemplate('workspace-ops-admin');
    expect(template).toBeDefined();
    expect(template!.id).toBe('workspace-ops-admin');
    expect(template!.name).toBe('Operations Admin');
    const blob = JSON.stringify(template);
    expect(blob.toLowerCase()).not.toContain('charity');
    expect(blob.toLowerCase()).not.toContain('nonprofit');
    expect(template!.personaBlocks.boundaries.join(' ')).toMatch(/Never invent attendees/i);
  });
});
