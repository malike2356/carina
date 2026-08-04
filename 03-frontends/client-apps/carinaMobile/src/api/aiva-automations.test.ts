import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AivaApiError } from './aiva-client';
import {
  buildCreateAutomationBody,
  buildSchedulePayload,
  isPlanUpgradeError,
  parseAutomationsList,
  planGateFromError,
  validateCreateAutomationInput,
} from './aiva-automations';
import { parseKnowledgeList, validateFaqInput } from './aiva-training';

describe('automation schedule and create payloads', () => {
  it('maps schedule presets to API schedule objects', () => {
    expect(buildSchedulePayload('daily')).toEqual({ type: 'daily', atHour: 9, atMinute: 0 });
    expect(buildSchedulePayload('weekly')).toEqual({
      type: 'weekly',
      weekday: 1,
      atHour: 9,
      atMinute: 0,
    });
    expect(buildSchedulePayload('custom')).toBeNull();
  });

  it('validates and builds create automation body', () => {
    expect(
      validateCreateAutomationInput({
        name: '',
        description: 'x',
        triggerKind: 'schedule',
      }),
    ).toMatch(/required/i);

    const body = buildCreateAutomationBody({
      name: 'Daily brief',
      description: 'Summarise inbox',
      triggerKind: 'schedule',
      schedulePreset: 'daily',
      actionType: 'aiva_prompt',
      approvalMode: 'require_write',
    });
    expect(body).toMatchObject({
      name: 'Daily brief',
      triggerKind: 'schedule',
      schedule: { type: 'daily', atHour: 9, atMinute: 0 },
      action: { type: 'aiva_prompt', prompt: 'Summarise inbox' },
    });
  });

  it('parses automation list fixtures', () => {
    const list = parseAutomationsList({
      automations: [
        {
          id: 'a1',
          workerId: 'w1',
          name: 'Daily',
          description: 'Brief',
          scheduleLabel: 'Every day at 09:00',
          enabled: true,
          lastRunAt: '2026-07-11T09:00:00.000Z',
        },
      ],
    });
    expect(list[0]).toMatchObject({ id: 'a1', enabled: true, scheduleLabel: 'Every day at 09:00' });
  });
});

describe('plan gate helper', () => {
  it('detects PLAN_UPGRADE_REQUIRED envelopes', () => {
    const err = new AivaApiError(403, 'Team plan required', {
      code: 'PLAN_UPGRADE_REQUIRED',
      body: JSON.stringify({ code: 'PLAN_UPGRADE_REQUIRED', planTier: 'starter', planRequired: 'team' }),
    });
    expect(isPlanUpgradeError(err)).toBe(true);
    expect(planGateFromError(err)).toMatchObject({
      required: true,
      planTier: 'starter',
      planRequired: 'team',
    });
  });
});

describe('training item mapper', () => {
  it('parses knowledge entries and validates FAQ input', () => {
    const list = parseKnowledgeList({
      entries: [
        { id: 'k1', type: 'faq', title: 'Hours?', charCount: 40, enabled: true, preview: '9-5' },
      ],
      usedChars: 40,
      maxChars: 50000,
      planTier: 'business',
    });
    expect(list.entries[0]).toMatchObject({ id: 'k1', type: 'faq', title: 'Hours?' });
    expect(validateFaqInput('', 'a')).toMatch(/required/i);
    expect(validateFaqInput('Q', 'A')).toBeNull();
  });
});

describe('listWorkerAutomations plan gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws plan upgrade error for non-team accounts', async () => {
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
    const { listWorkerAutomations } = await import('./aiva-automations');
    await expect(
      listWorkerAutomations('https://app.carinaai.uk', 'w1', { apiKey: 't' }),
    ).rejects.toMatchObject({ code: 'PLAN_UPGRADE_REQUIRED', status: 403 });
  });
});
