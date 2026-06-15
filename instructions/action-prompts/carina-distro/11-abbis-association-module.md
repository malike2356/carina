# Carina Distro Prompt 11: ABBIS Association module (GBDA)

## Goal

Build the Ghana Borehole Drillers Association (GBDA) module: database schema, REST API,
and constitutional business rules. This module manages GBDA membership, dues, meetings,
resolutions, and elections with the exact quorum and procedural constraints from the GBDA
constitution.

## Context

GBDA is the primary professional association for Ghana's borehole drilling industry.
ABBIS manages GBDA membership for the Association tier subscribers. The module must
enforce GBDA constitutional rules in code, not just as documentation.

### GBDA Constitutional rules (hard constraints - must be enforced)

These are not suggestions. The API must reject requests that violate them:

1. **Quorum for general meeting:** 10 members minimum for any vote to proceed
2. **Quorum for committee meeting:** 3 committee members minimum
3. **AGM notice period:** 14 days written notice required before Annual General Meeting
4. **Term length:** All officer terms are 2 years, non-renewable without an election
5. **Nomination rule:** A candidate nomination requires signatures from 2 existing members
6. **No double candidacy:** A candidate cannot contest 2 positions in the same election
7. **Expulsion:** Expulsion from GBDA requires a majority vote at a general meeting
   (not a committee decision; committee can only suspend pending a general meeting)

## Dependencies

`08-abbis-crm-module.md` (contacts table used for member profiles)

## Files to create

```
abbis/packages/db/src/schema/association.ts
abbis/packages/db/src/migrations/0006_association.sql
abbis/apps/api/src/routes/association.ts
abbis/apps/api/src/routes/association.test.ts
```

## Step-by-step

### 1. Database schema

`abbis/packages/db/src/schema/association.ts`:
```typescript
import {
  pgTable, uuid, text, timestamp, pgEnum, boolean,
  integer, jsonb, unique,
} from 'drizzle-orm/pg-core';
import { contacts } from './crm.js';

export const memberStatusEnum = pgEnum('member_status', [
  'applicant', 'active', 'suspended', 'expelled', 'lapsed', 'honorary',
]);

export const members = pgTable('gbda_members', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull(),
  contactId:     uuid('contact_id').references(() => contacts.id),
  memberNumber:  text('member_number').notNull().unique(),
  fullName:      text('full_name').notNull(),
  phone:         text('phone'),
  email:         text('email'),
  region:        text('region'),
  companyName:   text('company_name'),
  status:        memberStatusEnum('status').notNull().default('applicant'),
  joinedAt:      timestamp('joined_at', { withTimezone: true }),
  duesLastPaidAt: timestamp('dues_last_paid_at', { withTimezone: true }),
  duesPaidUntil: timestamp('dues_paid_until', { withTimezone: true }),
  notes:         text('notes'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const meetingTypeEnum = pgEnum('meeting_type', [
  'agm', 'general', 'committee', 'emergency',
]);

export const meetingStatusEnum = pgEnum('meeting_status', [
  'scheduled', 'quorum_failed', 'in_progress', 'completed', 'cancelled',
]);

export const meetings = pgTable('gbda_meetings', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull(),
  type:           meetingTypeEnum('type').notNull(),
  status:         meetingStatusEnum('status').notNull().default('scheduled'),
  title:          text('title').notNull(),
  scheduledAt:    timestamp('scheduled_at', { withTimezone: true }).notNull(),
  noticeSentAt:   timestamp('notice_sent_at', { withTimezone: true }),
  location:       text('location'),
  attendeeCount:  integer('attendee_count'),
  quorumMet:      boolean('quorum_met'),
  agenda:         text('agenda'),
  minutes:        text('minutes'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const resolutionStatusEnum = pgEnum('resolution_status', [
  'proposed', 'passed', 'failed', 'withdrawn',
]);

export const resolutions = pgTable('gbda_resolutions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull(),
  meetingId:     uuid('meeting_id').notNull().references(() => meetings.id),
  title:         text('title').notNull(),
  description:   text('description'),
  status:        resolutionStatusEnum('status').notNull().default('proposed'),
  votesFor:      integer('votes_for').notNull().default(0),
  votesAgainst:  integer('votes_against').notNull().default(0),
  votesAbstain:  integer('votes_abstain').notNull().default(0),
  passedAt:      timestamp('passed_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const electionStatusEnum = pgEnum('election_status', [
  'open', 'nominations_closed', 'voting', 'completed', 'cancelled',
]);

export const elections = pgTable('gbda_elections', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull(),
  position:        text('position').notNull(),
  status:          electionStatusEnum('status').notNull().default('open'),
  nominationsOpenUntil: timestamp('nominations_open_until', { withTimezone: true }).notNull(),
  votingDate:      timestamp('voting_date', { withTimezone: true }),
  meetingId:       uuid('meeting_id').references(() => meetings.id),
  winnerId:        uuid('winner_id').references(() => members.id),
  termStartDate:   timestamp('term_start_date', { withTimezone: true }),
  termEndDate:     timestamp('term_end_date', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const nominations = pgTable('gbda_nominations', {
  id:              uuid('id').primaryKey().defaultRandom(),
  electionId:      uuid('election_id').notNull().references(() => elections.id),
  tenantId:        uuid('tenant_id').notNull(),
  candidateId:     uuid('candidate_id').notNull().references(() => members.id),
  nominator1Id:    uuid('nominator_1_id').notNull().references(() => members.id),
  nominator2Id:    uuid('nominator_2_id').notNull().references(() => members.id),
  acceptedAt:      timestamp('accepted_at', { withTimezone: true }),
  votesReceived:   integer('votes_received').default(0),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ unique: unique().on(t.electionId, t.candidateId) }));

export const disciplinaryActionEnum = pgEnum('disciplinary_action_type', [
  'warning', 'suspension', 'expulsion_proposed', 'expulsion_confirmed',
]);

export const disciplinaryRecords = pgTable('gbda_disciplinary', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull(),
  memberId:    uuid('member_id').notNull().references(() => members.id),
  type:        disciplinaryActionEnum('type').notNull(),
  description: text('description').notNull(),
  meetingId:   uuid('meeting_id').references(() => meetings.id),
  votesFor:    integer('votes_for'),
  votesAgainst: integer('votes_against'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### 2. Migration SQL

`abbis/packages/db/src/migrations/0006_association.sql`:
```sql
CREATE TYPE member_status AS ENUM ('applicant','active','suspended','expelled','lapsed','honorary');
CREATE TYPE meeting_type AS ENUM ('agm','general','committee','emergency');
CREATE TYPE meeting_status AS ENUM ('scheduled','quorum_failed','in_progress','completed','cancelled');
CREATE TYPE resolution_status AS ENUM ('proposed','passed','failed','withdrawn');
CREATE TYPE election_status AS ENUM ('open','nominations_closed','voting','completed','cancelled');
CREATE TYPE disciplinary_action_type AS ENUM ('warning','suspension','expulsion_proposed','expulsion_confirmed');

CREATE TABLE gbda_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  contact_id      UUID REFERENCES contacts(id),
  member_number   TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  region          TEXT,
  company_name    TEXT,
  status          member_status NOT NULL DEFAULT 'applicant',
  joined_at       TIMESTAMPTZ,
  dues_last_paid_at TIMESTAMPTZ,
  dues_paid_until TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gbda_meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  type            meeting_type NOT NULL,
  status          meeting_status NOT NULL DEFAULT 'scheduled',
  title           TEXT NOT NULL,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  notice_sent_at  TIMESTAMPTZ,
  location        TEXT,
  attendee_count  INTEGER,
  quorum_met      BOOLEAN,
  agenda          TEXT,
  minutes         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gbda_resolutions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  meeting_id     UUID NOT NULL REFERENCES gbda_meetings(id),
  title          TEXT NOT NULL,
  description    TEXT,
  status         resolution_status NOT NULL DEFAULT 'proposed',
  votes_for      INTEGER NOT NULL DEFAULT 0,
  votes_against  INTEGER NOT NULL DEFAULT 0,
  votes_abstain  INTEGER NOT NULL DEFAULT 0,
  passed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gbda_elections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  position                TEXT NOT NULL,
  status                  election_status NOT NULL DEFAULT 'open',
  nominations_open_until  TIMESTAMPTZ NOT NULL,
  voting_date             TIMESTAMPTZ,
  meeting_id              UUID REFERENCES gbda_meetings(id),
  winner_id               UUID REFERENCES gbda_members(id),
  term_start_date         TIMESTAMPTZ,
  term_end_date           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gbda_nominations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id   UUID NOT NULL REFERENCES gbda_elections(id),
  tenant_id     UUID NOT NULL,
  candidate_id  UUID NOT NULL REFERENCES gbda_members(id),
  nominator_1_id UUID NOT NULL REFERENCES gbda_members(id),
  nominator_2_id UUID NOT NULL REFERENCES gbda_members(id),
  accepted_at   TIMESTAMPTZ,
  votes_received INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (election_id, candidate_id)
);

CREATE TABLE gbda_disciplinary (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  member_id    UUID NOT NULL REFERENCES gbda_members(id),
  type         disciplinary_action_type NOT NULL,
  description  TEXT NOT NULL,
  meeting_id   UUID REFERENCES gbda_meetings(id),
  votes_for    INTEGER,
  votes_against INTEGER,
  confirmed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_tenant  ON gbda_members (tenant_id);
CREATE INDEX idx_members_status  ON gbda_members (tenant_id, status);
CREATE INDEX idx_meetings_tenant ON gbda_meetings (tenant_id, scheduled_at DESC);
```

### 3. Constitutional rule helpers

Create `abbis/apps/api/src/lib/gbda-rules.ts` with pure functions for each rule:

```typescript
export const GBDA_GENERAL_MEETING_QUORUM = 10;
export const GBDA_COMMITTEE_QUORUM = 3;
export const GBDA_AGM_NOTICE_DAYS = 14;
export const GBDA_TERM_YEARS = 2;
export const GBDA_NOMINATION_SIGNATORIES = 2;

export type QuorumCheckResult =
  | { ok: true }
  | { ok: false; reason: string; required: number; present: number };

export function checkMeetingQuorum(
  meetingType: 'agm' | 'general' | 'committee' | 'emergency',
  attendeeCount: number,
): QuorumCheckResult {
  const required =
    meetingType === 'committee' ? GBDA_COMMITTEE_QUORUM : GBDA_GENERAL_MEETING_QUORUM;

  if (attendeeCount >= required) return { ok: true };
  return {
    ok: false,
    reason: `GBDA constitution requires ${required} members for a ${meetingType} meeting. Only ${attendeeCount} present.`,
    required,
    present: attendeeCount,
  };
}

export function checkAgmNotice(
  meetingScheduledAt: Date,
  noticeSentAt: Date | null,
): { ok: boolean; reason?: string } {
  if (!noticeSentAt) {
    return { ok: false, reason: 'AGM notice has not been sent' };
  }
  const daysDiff =
    (meetingScheduledAt.getTime() - noticeSentAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff < GBDA_AGM_NOTICE_DAYS) {
    return {
      ok: false,
      reason: `GBDA constitution requires ${GBDA_AGM_NOTICE_DAYS} days notice for AGM. Notice was sent only ${Math.floor(daysDiff)} days before meeting.`,
    };
  }
  return { ok: true };
}

export function calculateTermEnd(startDate: Date): Date {
  const end = new Date(startDate);
  end.setFullYear(end.getFullYear() + GBDA_TERM_YEARS);
  return end;
}

export function checkNominationSignatories(
  nominator1Id: string,
  nominator2Id: string,
  candidateId: string,
): { ok: boolean; reason?: string } {
  if (nominator1Id === nominator2Id) {
    return { ok: false, reason: 'GBDA constitution requires 2 different member signatures for a nomination' };
  }
  if (nominator1Id === candidateId || nominator2Id === candidateId) {
    return { ok: false, reason: 'A candidate cannot nominate themselves' };
  }
  return { ok: true };
}
```

### 4. API routes

`abbis/apps/api/src/routes/association.ts`:
```typescript
import { Router } from 'express';
import { db } from '@abbis/db';
import { members, meetings, resolutions, elections, nominations, disciplinaryRecords } from '@abbis/db/schema/association.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/require-auth.js';
import { requireTenant } from '../middleware/require-tenant.js';
import {
  checkMeetingQuorum,
  checkAgmNotice,
  calculateTermEnd,
  checkNominationSignatories,
} from '../lib/gbda-rules.js';
import { z } from 'zod';

const router = Router();
router.use(requireAuth, requireTenant);

// GET /api/association/members
router.get('/members', async (req, res) => {
  const { status, region } = req.query as Record<string, string>;
  const rows = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.tenantId, req.tenantId),
        status ? eq(members.status, status as typeof members.status._.data) : undefined,
        region ? eq(members.region, region) : undefined,
      ),
    )
    .orderBy(desc(members.createdAt));
  res.json(rows);
});

// POST /api/association/members
router.post('/members', async (req, res) => {
  const schema = z.object({
    fullName:    z.string().min(1),
    phone:       z.string().optional(),
    email:       z.string().email().optional(),
    region:      z.string().optional(),
    companyName: z.string().optional(),
    memberNumber: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const memberNumber = parsed.data.memberNumber ?? `GBDA-${Date.now()}`;
  const [created] = await db
    .insert(members)
    .values({ ...parsed.data, memberNumber, tenantId: req.tenantId })
    .returning();

  res.status(201).json(created);
});

// POST /api/association/meetings - schedule a meeting
router.post('/meetings', async (req, res) => {
  const schema = z.object({
    type:        z.enum(['agm', 'general', 'committee', 'emergency']),
    title:       z.string().min(1),
    scheduledAt: z.string().datetime(),
    location:    z.string().optional(),
    agenda:      z.string().optional(),
    noticeSentAt: z.string().datetime().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  // Constitutional check for AGM
  if (parsed.data.type === 'agm') {
    const noticeCheck = checkAgmNotice(
      new Date(parsed.data.scheduledAt),
      parsed.data.noticeSentAt ? new Date(parsed.data.noticeSentAt) : null,
    );
    if (!noticeCheck.ok) {
      res.status(422).json({
        error: 'constitutional_violation',
        rule: 'agm_notice_period',
        message: noticeCheck.reason,
      });
      return;
    }
  }

  const [created] = await db
    .insert(meetings)
    .values({ ...parsed.data, tenantId: req.tenantId, scheduledAt: new Date(parsed.data.scheduledAt) })
    .returning();

  res.status(201).json(created);
});

// POST /api/association/meetings/:id/record-attendance - record attendees, check quorum
router.post('/meetings/:id/record-attendance', async (req, res) => {
  const { id } = req.params;
  const { attendeeCount } = req.body as { attendeeCount: number };

  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.tenantId, req.tenantId)));

  if (!meeting) { res.status(404).json({ error: 'not_found' }); return; }

  const quorumCheck = checkMeetingQuorum(meeting.type, attendeeCount);
  const newStatus = quorumCheck.ok ? 'in_progress' : 'quorum_failed';

  const [updated] = await db
    .update(meetings)
    .set({ attendeeCount, quorumMet: quorumCheck.ok, status: newStatus, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning();

  res.json({
    meeting: updated,
    quorum: quorumCheck,
    message: quorumCheck.ok
      ? 'Quorum met. Meeting can proceed.'
      : `Quorum not met. ${quorumCheck.reason}`,
  });
});

// POST /api/association/meetings/:id/resolutions - record a vote
router.post('/meetings/:id/resolutions', async (req, res) => {
  const { id } = req.params;

  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.tenantId, req.tenantId)));

  if (!meeting) { res.status(404).json({ error: 'not_found' }); return; }

  // Cannot record resolutions without quorum
  if (!meeting.quorumMet) {
    res.status(422).json({
      error: 'constitutional_violation',
      rule: 'quorum_required',
      message: 'Cannot record resolutions for a meeting that did not meet quorum',
    });
    return;
  }

  const schema = z.object({
    title:        z.string().min(1),
    description:  z.string().optional(),
    votesFor:     z.number().int().min(0),
    votesAgainst: z.number().int().min(0),
    votesAbstain: z.number().int().min(0).default(0),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  const passed = parsed.data.votesFor > parsed.data.votesAgainst;
  const [created] = await db
    .insert(resolutions)
    .values({
      ...parsed.data,
      meetingId: id,
      tenantId: req.tenantId,
      status: passed ? 'passed' : 'failed',
      passedAt: passed ? new Date() : undefined,
    })
    .returning();

  res.status(201).json(created);
});

// POST /api/association/elections/:id/nominations - submit a nomination
router.post('/elections/:id/nominations', async (req, res) => {
  const { id } = req.params;

  const [election] = await db
    .select()
    .from(elections)
    .where(and(eq(elections.id, id), eq(elections.tenantId, req.tenantId)));

  if (!election) { res.status(404).json({ error: 'not_found' }); return; }
  if (election.status !== 'open') {
    res.status(422).json({ error: 'nominations_closed', message: 'Nominations are closed for this election' });
    return;
  }

  const schema = z.object({
    candidateId:  z.string().uuid(),
    nominator1Id: z.string().uuid(),
    nominator2Id: z.string().uuid(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'validation', details: parsed.error.flatten() }); return; }

  // Check 2-signatory rule
  const signatoryCheck = checkNominationSignatories(
    parsed.data.nominator1Id,
    parsed.data.nominator2Id,
    parsed.data.candidateId,
  );
  if (!signatoryCheck.ok) {
    res.status(422).json({ error: 'constitutional_violation', rule: 'nomination_signatories', message: signatoryCheck.reason });
    return;
  }

  // Check no double candidacy: candidate must not be nominated for another open election
  const [existingInOtherElection] = await db
    .select({ id: nominations.id })
    .from(nominations)
    .innerJoin(elections, eq(elections.id, nominations.electionId))
    .where(
      and(
        eq(nominations.candidateId, parsed.data.candidateId),
        eq(nominations.tenantId, req.tenantId),
        eq(elections.status, 'open'),
      ),
    )
    .limit(1);

  if (existingInOtherElection) {
    res.status(422).json({
      error: 'constitutional_violation',
      rule: 'no_double_candidacy',
      message: 'GBDA constitution: a candidate cannot contest 2 positions in the same election cycle',
    });
    return;
  }

  const [created] = await db
    .insert(nominations)
    .values({ ...parsed.data, electionId: id, tenantId: req.tenantId })
    .returning();

  res.status(201).json(created);
});

// POST /api/association/members/:id/expel - propose expulsion
router.post('/members/:id/expel', async (req, res) => {
  const { id } = req.params;
  const { description, meetingId, votesFor, votesAgainst } = req.body as {
    description: string;
    meetingId: string;
    votesFor: number;
    votesAgainst: number;
  };

  if (!meetingId) {
    res.status(422).json({
      error: 'constitutional_violation',
      rule: 'expulsion_requires_general_meeting',
      message: 'GBDA constitution: expulsion requires a majority vote at a general meeting. A meeting ID is required.',
    });
    return;
  }

  // Confirm the meeting exists and had quorum
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.tenantId, req.tenantId)));

  if (!meeting) { res.status(404).json({ error: 'meeting_not_found' }); return; }
  if (meeting.type === 'committee') {
    res.status(422).json({
      error: 'constitutional_violation',
      rule: 'expulsion_requires_general_meeting',
      message: 'GBDA constitution: a committee meeting cannot expel a member. Only a general meeting can.',
    });
    return;
  }
  if (!meeting.quorumMet) {
    res.status(422).json({
      error: 'constitutional_violation',
      rule: 'quorum_required',
      message: 'Expulsion cannot proceed: the meeting did not meet quorum',
    });
    return;
  }

  const passed = votesFor > votesAgainst;

  const [disciplinary] = await db
    .insert(disciplinaryRecords)
    .values({
      memberId: id,
      tenantId: req.tenantId,
      type: passed ? 'expulsion_confirmed' : 'expulsion_proposed',
      description,
      meetingId,
      votesFor,
      votesAgainst,
      confirmedAt: passed ? new Date() : undefined,
    })
    .returning();

  if (passed) {
    await db
      .update(members)
      .set({ status: 'expelled', updatedAt: new Date() })
      .where(and(eq(members.id, id), eq(members.tenantId, req.tenantId)));
  }

  res.status(201).json({
    disciplinary,
    outcome: passed ? 'expelled' : 'vote_failed',
    message: passed
      ? 'Member expelled by majority vote at general meeting'
      : 'Expulsion vote did not pass (majority not achieved)',
  });
});

export default router;
```

### 5. Register routes

In `abbis/apps/api/src/index.ts`:
```typescript
import associationRouter from './routes/association.js';
app.use('/api/association', associationRouter);
```

### 6. Vitest tests

`abbis/apps/api/src/routes/association.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { checkMeetingQuorum, checkAgmNotice, checkNominationSignatories } from '../lib/gbda-rules.js';

describe('GBDA constitutional rule helpers', () => {
  it('general meeting fails quorum below 10', () => {
    const result = checkMeetingQuorum('general', 9);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.required).toBe(10);
  });

  it('general meeting passes quorum at 10', () => {
    expect(checkMeetingQuorum('general', 10).ok).toBe(true);
  });

  it('committee meeting passes quorum at 3', () => {
    expect(checkMeetingQuorum('committee', 3).ok).toBe(true);
  });

  it('AGM fails if notice sent 13 days before', () => {
    const now = new Date();
    const meeting = new Date(now.getTime() + 13 * 86400000);
    const result = checkAgmNotice(meeting, now);
    expect(result.ok).toBe(false);
  });

  it('AGM passes if notice sent 14+ days before', () => {
    const now = new Date();
    const meeting = new Date(now.getTime() + 14 * 86400000);
    expect(checkAgmNotice(meeting, now).ok).toBe(true);
  });

  it('nomination fails with same nominator', () => {
    const result = checkNominationSignatories('member-a', 'member-a', 'candidate-x');
    expect(result.ok).toBe(false);
  });

  it('nomination fails if candidate is also a nominator', () => {
    const result = checkNominationSignatories('candidate-x', 'member-b', 'candidate-x');
    expect(result.ok).toBe(false);
  });

  it('nomination passes with 2 distinct non-candidate nominators', () => {
    expect(checkNominationSignatories('member-a', 'member-b', 'candidate-x').ok).toBe(true);
  });
});

describe('Association API - meeting quorum enforcement', () => {
  const auth = { Authorization: 'Bearer test-token' };

  it('rejects AGM created with less than 14 days notice', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const res = await request(app)
      .post('/api/association/meetings')
      .set(auth)
      .send({
        type: 'agm',
        title: 'GBDA AGM 2024',
        scheduledAt: tomorrow,
        noticeSentAt: new Date().toISOString(),
      });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('constitutional_violation');
    expect(res.body.rule).toBe('agm_notice_period');
  });

  it('rejects resolution on meeting that failed quorum', async () => {
    const meeting = await request(app)
      .post('/api/association/meetings')
      .set(auth)
      .send({ type: 'general', title: 'General Meeting', scheduledAt: new Date().toISOString() });

    await request(app)
      .post(`/api/association/meetings/${meeting.body.id}/record-attendance`)
      .set(auth)
      .send({ attendeeCount: 5 }); // Below quorum of 10

    const res = await request(app)
      .post(`/api/association/meetings/${meeting.body.id}/resolutions`)
      .set(auth)
      .send({ title: 'Test', votesFor: 4, votesAgainst: 1 });

    expect(res.status).toBe(422);
    expect(res.body.rule).toBe('quorum_required');
  });

  it('rejects expulsion without a general meeting', async () => {
    const res = await request(app)
      .post('/api/association/members/some-member-id/expel')
      .set(auth)
      .send({ description: 'Misconduct', votesFor: 8, votesAgainst: 2 });
    expect(res.status).toBe(422);
    expect(res.body.rule).toBe('expulsion_requires_general_meeting');
  });
});
```

## Expected behavior

```bash
# Schedule a general meeting (no notice constraint for non-AGM)
curl -X POST http://localhost:3000/api/association/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"general","title":"Q1 Meeting","scheduledAt":"2024-03-15T10:00:00Z","location":"Accra"}'

# Try to schedule AGM with 5 days notice - should fail
curl -X POST http://localhost:3000/api/association/meetings \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"agm","title":"2024 AGM","scheduledAt":"2024-02-20T10:00:00Z","noticeSentAt":"2024-02-15T10:00:00Z"}'
# 422: constitutional_violation / agm_notice_period

# Record attendance and check quorum
curl -X POST http://localhost:3000/api/association/meetings/{id}/record-attendance \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"attendeeCount": 12}'
# Returns: quorum.ok: true, meeting.status: in_progress
```

## Pitfalls

- Constitutional rules are enforced server-side; the web UI should surface these errors
  clearly with the exact rule name so users understand what they need to change
- Committee meetings have quorum of 3, but committee meetings cannot expel members;
  only suspend pending a general meeting. Add a `suspend` endpoint that is allowed from
  committee; the `expel` endpoint checks `meeting.type !== 'committee'`
- `calculateTermEnd` adds exactly 2 years; store `term_end_date` in the election row when
  recording a winner so the next election cycle knows when the current term expires
- The double-candidacy check queries across all open elections in the same tenant. If
  different positions are in different elections, a member truly cannot stand for any two
