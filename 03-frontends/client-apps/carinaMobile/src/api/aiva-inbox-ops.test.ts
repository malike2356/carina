import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AivaApiError } from './aiva-client';
import {
  parseConversationList,
  parseConversationThread,
} from './aiva-conversations';
import {
  buildResolveEscalationPayload,
  parseEscalationsList,
} from './aiva-escalations';
import {
  governanceStatusLabel,
  parseGovernanceStatus,
} from './aiva-governance';
import {
  inboxSegmentSubtitle,
  parseInboxSegment,
  isInboxSegment,
} from '@/lib/inbox-nav';

describe('conversation list mapper', () => {
  it('parses conversation list fixtures', () => {
    const list = parseConversationList({
      page: 1,
      limit: 30,
      total: 1,
      conversations: [
        {
          id: 'c1',
          contactId: '***123',
          channel: 'email',
          worker: { id: 'w1', name: 'Alex' },
          lastMessageAt: '2026-07-11T10:00:00.000Z',
          lastMessagePreview: 'Thanks',
          messageCount: 4,
          hasEscalation: false,
          status: 'open',
        },
      ],
    });
    expect(list.total).toBe(1);
    expect(list.conversations[0]).toMatchObject({
      id: 'c1',
      workerName: 'Alex',
      channel: 'email',
      status: 'open',
    });
  });

  it('parses thread and marks read-only', () => {
    const thread = parseConversationThread({
      conversation: {
        id: 'c1',
        channel: 'telegram',
        contactId: 'u1',
        worker: { id: 'w1', name: 'Alex' },
        messageCount: 2,
        startedAt: '2026-07-10T09:00:00.000Z',
      },
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Hello',
          timestamp: '2026-07-10T09:00:00.000Z',
        },
        {
          id: 'm2',
          role: 'aiva',
          content: 'Hi there',
          timestamp: '2026-07-10T09:01:00.000Z',
        },
      ],
    });
    expect(thread.readOnly).toBe(true);
    expect(thread.messages).toHaveLength(2);
    expect(thread.workerName).toBe('Alex');
  });
});

describe('escalation list and resolve payloads', () => {
  it('parses open escalations', () => {
    const list = parseEscalationsList({
      escalations: [
        {
          id: 'e1',
          workerId: 'w1',
          workerName: 'Alex',
          channel: 'email',
          status: 'open',
          originalInput: 'Need a refund',
          holdingMessage: 'A teammate will help',
          createdAt: '2026-07-11T11:00:00.000Z',
        },
      ],
    });
    expect(list[0]).toMatchObject({ id: 'e1', workerName: 'Alex', status: 'open' });
  });

  it('validates resolve payload length for ops-shaped notes', () => {
    expect(buildResolveEscalationPayload('short')).toBeNull();
    expect(buildResolveEscalationPayload('Resolved with customer on call')).toEqual({
      resolutionNote: 'Resolved with customer on call',
    });
  });

  it('returns plan gate for Team-required escalations', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Team plan required',
          code: 'PLAN_UPGRADE_REQUIRED',
          planTier: 'starter',
          planRequired: 'team',
        }),
        { status: 403, statusText: 'Forbidden' },
      ),
    );
    const { listOpenEscalations } = await import('./aiva-escalations');
    const result = await listOpenEscalations('https://app.carinaai.uk', { apiKey: 't' });
    expect(result.planGate.required).toBe(true);
    expect(result.planGate.planRequired).toBe('team');
    expect(result.escalations).toEqual([]);
  });
});

describe('governance status mapper', () => {
  it('maps scout governance status fields', () => {
    const status = parseGovernanceStatus({
      scoutStatus: 'connected',
      scoutDashboardUrl: 'https://console.labyrinthscout.com',
      scoutLastHeartbeatAt: '2026-07-11T12:00:00.000Z',
      employeesMonitored: 3,
      employeesActive: 2,
      employeesSuspendedByScout: 1,
      eventsLast24h: 12,
      killSwitchActive: true,
    });
    expect(status).toMatchObject({
      scoutStatus: 'connected',
      employeesMonitored: 3,
      killSwitchActive: true,
    });
    expect(governanceStatusLabel('connected')).toBe('Connected');
  });
});

describe('inbox sub-nav state helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses segments and subtitles', () => {
    expect(parseInboxSegment('conversations')).toBe('conversations');
    expect(parseInboxSegment('nope')).toBe('approvals');
    expect(isInboxSegment('escalations')).toBe(true);
    expect(inboxSegmentSubtitle('approvals')).toMatch(/approval/i);
    expect(inboxSegmentSubtitle('escalations')).toMatch(/handoff/i);
  });
});

describe('AivaApiError plan code remains intact', () => {
  it('keeps PLAN_UPGRADE_REQUIRED on constructed errors', () => {
    const err = new AivaApiError(403, 'Team plan required', {
      code: 'PLAN_UPGRADE_REQUIRED',
    });
    expect(err.code).toBe('PLAN_UPGRADE_REQUIRED');
  });
});
