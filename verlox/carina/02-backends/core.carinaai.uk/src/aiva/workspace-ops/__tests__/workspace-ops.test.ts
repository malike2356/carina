import { describe, expect, it } from 'vitest';
import { hashDocumentContent } from '../hash.js';
import { isOpsCategory, OPS_CATEGORIES } from '../types.js';
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
