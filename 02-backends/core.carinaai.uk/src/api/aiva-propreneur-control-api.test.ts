import { beforeEach, describe, expect, it } from 'vitest';
import {
  bindPropreneurSessionUser,
  getPropreneurSessionTenantState,
  resetPropreneurSessionTenantStore,
  selectPropreneurSessionTenant,
} from '../tools/propreneur-session-tenant.js';
import {
  getPropreneurSyncHealth,
  ingestPropreneurWebhookEvent,
  resetPropreneurEventInboxForTests,
} from '../sync/propreneur-event-inbox.js';

describe('aiva propreneur control canary helpers', () => {
  beforeEach(() => {
    resetPropreneurSessionTenantStore();
    resetPropreneurEventInboxForTests();
  });

  it('selects tenant for context indicator fields', () => {
    bindPropreneurSessionUser('sess-ui', 'user-1', [
      { tenantId: 't1', tenantSlug: 'alpha' },
      { tenantId: 't2', tenantSlug: 'beta', label: 'Beta Ltd' },
    ]);
    selectPropreneurSessionTenant('sess-ui', 't2');
    const state = getPropreneurSessionTenantState('sess-ui');
    expect(state.selectedTenantId).toBe('t2');
    const selected = state.tenants.find((t) => t.tenantId === state.selectedTenantId);
    expect(selected?.tenantSlug).toBe('beta');
    expect(selected?.label).toBe('Beta Ltd');
  });

  it('dedupes inbox events and exposes sync health', () => {
    const event = {
      event: 'property.created',
      event_id: 'evt-canary-1',
      schema_version: '1.0.0',
      workerId: 'w1',
      tenantSlug: 'alpha',
      tenantId: 't1',
      resource_type: 'property',
      resource_id: '99',
      resource_version: 1,
      occurredAt: new Date().toISOString(),
      data: {},
    };

    const first = ingestPropreneurWebhookEvent(event);
    const second = ingestPropreneurWebhookEvent(event);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.duplicate).toBe(false);
      expect(second.duplicate).toBe(true);
    }

    const health = getPropreneurSyncHealth();
    expect(health.lastEventId).toBe('evt-canary-1');
    expect(health.pendingCount).toBe(1);
  });
});
