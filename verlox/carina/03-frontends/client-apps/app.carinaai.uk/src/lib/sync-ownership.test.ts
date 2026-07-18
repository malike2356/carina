import { describe, expect, it } from 'vitest';
import {
  calendarOwnershipFromSource,
  claimInboxItemKeepsProvenance,
  classifyDocumentOrigin,
  classifyEmailOrigin,
  classifyFromCalendarSource,
  classifyInboxOrigin,
  classifyTaskOrigin,
  matchesOriginFilter,
} from './sync-ownership';

describe('classifyFromCalendarSource', () => {
  it('maps google and caldav to google', () => {
    expect(classifyFromCalendarSource('google')).toBe('google');
    expect(classifyFromCalendarSource('caldav')).toBe('google');
  });

  it('maps aiva source and aivaManaged flag to aiva', () => {
    expect(classifyFromCalendarSource('aiva')).toBe('aiva');
    expect(classifyFromCalendarSource('google', { aivaManaged: true })).toBe('aiva');
  });

  it('maps local and note_reminder to local', () => {
    expect(classifyFromCalendarSource('local')).toBe('local');
    expect(classifyFromCalendarSource('note_reminder')).toBe('local');
  });
});

describe('matchesOriginFilter', () => {
  const rows = [
    { id: '1', origin: 'aiva' as const },
    { id: '2', origin: 'google' as const },
    { id: '3', origin: 'local' as const },
  ];

  it('returns all buckets for all filter', () => {
    expect(rows.filter((row) => matchesOriginFilter(row, 'all'))).toHaveLength(3);
  });

  it('filters each origin bucket', () => {
    expect(rows.filter((row) => matchesOriginFilter(row, 'aiva')).map((r) => r.id)).toEqual(['1']);
    expect(rows.filter((row) => matchesOriginFilter(row, 'google')).map((r) => r.id)).toEqual(['2']);
    expect(rows.filter((row) => matchesOriginFilter(row, 'local')).map((r) => r.id)).toEqual(['3']);
  });
});

describe('calendarOwnershipFromSource', () => {
  it('marks imported google events as pull and not aiva managed', () => {
    const ownership = calendarOwnershipFromSource('google', { externalUid: 'evt-1' });
    expect(ownership.origin).toBe('google');
    expect(ownership.aivaManaged).toBe(false);
    expect(ownership.syncDirection).toBe('pull');
    expect(ownership.externalId).toBe('evt-1');
  });

  it('keeps Aiva-created events as aiva after round-trip', () => {
    const ownership = calendarOwnershipFromSource('aiva', { externalUid: 'evt-aiva' });
    expect(ownership.origin).toBe('aiva');
    expect(ownership.aivaManaged).toBe(true);
  });
});

describe('classifyEmailOrigin', () => {
  it('treats external_id as google import', () => {
    expect(classifyEmailOrigin({ externalId: 'gmail-1', status: 'inbox' })).toBe('google');
  });

  it('treats draft_reply and sent as aiva', () => {
    expect(classifyEmailOrigin({ status: 'draft_reply' })).toBe('aiva');
    expect(classifyEmailOrigin({ status: 'sent' })).toBe('aiva');
    expect(classifyEmailOrigin({ status: 'inbox', aiDraftReply: 'Hi' })).toBe('aiva');
  });

  it('treats plain local rows as local', () => {
    expect(classifyEmailOrigin({ status: 'inbox' })).toBe('local');
  });
});

describe('classifyTaskOrigin', () => {
  it('uses builtIn as aiva and default as local', () => {
    expect(classifyTaskOrigin({ builtIn: true })).toBe('aiva');
    expect(classifyTaskOrigin({ builtIn: false })).toBe('local');
  });

  it('does not invent google without external id', () => {
    expect(classifyTaskOrigin({})).toBe('local');
  });
});

describe('classifyDocumentOrigin', () => {
  it('classifies ops mapped and capture docs as aiva', () => {
    expect(
      classifyDocumentOrigin({ category: 'minutes', driveWebViewLink: 'https://drive.google.com/x' }),
    ).toBe('aiva');
    expect(classifyDocumentOrigin({ syncStatus: 'synced' })).toBe('aiva');
  });

  it('classifies inbox drops as google (claim keeps provenance)', () => {
    expect(classifyDocumentOrigin({ category: 'inbox' })).toBe('google');
    expect(classifyDocumentOrigin({ category: 'inbox', claimedByAiva: true })).toBe('google');
  });

  it('classifies workspace-only docs as local', () => {
    expect(classifyDocumentOrigin({})).toBe('local');
  });
});

describe('inbox claim provenance', () => {
  it('keeps google origin when claimed', () => {
    expect(classifyInboxOrigin({ kind: 'drive_drop' })).toBe('google');
    expect(claimInboxItemKeepsProvenance('google')).toEqual({
      origin: 'google',
      aivaManaged: true,
    });
  });

  it('classifies approvals as aiva', () => {
    expect(classifyInboxOrigin({ kind: 'approval' })).toBe('aiva');
  });
});
