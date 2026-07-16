import { describe, expect, it } from 'vitest';
import { AivaApiError } from './aiva-client';
import {
  buildCreateAutomationBody,
  buildSchedulePayload,
  planGateFromError,
  validateCreateAutomationInput,
} from './aiva-automations';

describe('aiva automation helpers', () => {
  it('builds schedule and event payloads', () => {
    expect(buildSchedulePayload('interval_30')).toEqual({
      type: 'interval',
      everyMinutes: 30,
    });
    expect(buildCreateAutomationBody({
      name: ' Inbox brief ',
      description: ' Summarise messages ',
      triggerKind: 'event',
      triggerEvent: 'email_received',
    })).toMatchObject({
      name: 'Inbox brief',
      description: 'Summarise messages',
      triggerEvent: 'email_received',
      action: { type: 'aiva_prompt', prompt: 'Summarise messages' },
    });
  });

  it('validates required custom schedule fields', () => {
    expect(validateCreateAutomationInput({
      name: 'Report',
      description: 'Send report',
      triggerKind: 'schedule',
      schedulePreset: 'custom',
    })).toBe('Custom schedule text is required.');
  });

  it('maps plan upgrade errors', () => {
    const error = new AivaApiError(403, 'Upgrade required', {
      code: 'PLAN_UPGRADE_REQUIRED',
      body: JSON.stringify({ planTier: 'starter', planRequired: 'team' }),
    });
    expect(planGateFromError(error)).toMatchObject({
      required: true,
      planTier: 'starter',
      planRequired: 'team',
    });
  });
});
