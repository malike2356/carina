/**
 * Session-scoped Propreneur tenant selection for Aiva.
 * Business queries require a linked user and a single selected tenant.
 */

export interface PropreneurLinkedTenant {
  tenantId: string;
  tenantSlug: string;
  label?: string;
}

export interface PropreneurSessionTenantState {
  sessionId: string;
  linkedUserId: string | null;
  tenants: PropreneurLinkedTenant[];
  selectedTenantId: string | null;
  selectedAt: string | null;
}

export class PropreneurTenantRequiredError extends Error {
  readonly code = 'PROPRENEUR_TENANT_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'PropreneurTenantRequiredError';
  }
}

const sessions = new Map<string, PropreneurSessionTenantState>();

export function resetPropreneurSessionTenantStore(): void {
  sessions.clear();
}

function emptyState(sessionId: string): PropreneurSessionTenantState {
  return {
    sessionId,
    linkedUserId: null,
    tenants: [],
    selectedTenantId: null,
    selectedAt: null,
  };
}

export function getPropreneurSessionTenantState(sessionId: string): PropreneurSessionTenantState {
  return sessions.get(sessionId) ?? emptyState(sessionId);
}

export function bindPropreneurSessionUser(
  sessionId: string,
  linkedUserId: string,
  tenants: PropreneurLinkedTenant[],
): PropreneurSessionTenantState {
  const prev = getPropreneurSessionTenantState(sessionId);
  let selectedTenantId = prev.selectedTenantId;
  let selectedAt = prev.selectedAt;
  if (tenants.length === 1) {
    selectedTenantId = tenants[0]!.tenantId;
    selectedAt = new Date().toISOString();
  } else if (
    selectedTenantId &&
    !tenants.some((t) => t.tenantId === selectedTenantId)
  ) {
    selectedTenantId = null;
    selectedAt = null;
  }

  const next: PropreneurSessionTenantState = {
    sessionId,
    linkedUserId: linkedUserId.trim() || null,
    tenants,
    selectedTenantId,
    selectedAt,
  };
  sessions.set(sessionId, next);
  return next;
}

export function selectPropreneurSessionTenant(
  sessionId: string,
  tenantId: string,
): PropreneurSessionTenantState {
  const state = getPropreneurSessionTenantState(sessionId);
  if (!state.linkedUserId) {
    throw new PropreneurTenantRequiredError(
      'Link a Propreneur user before selecting a tenant',
    );
  }
  const match = state.tenants.find((t) => t.tenantId === tenantId || t.tenantSlug === tenantId);
  if (!match) {
    throw new PropreneurTenantRequiredError(
      `Tenant ${tenantId} is not linked for this session`,
    );
  }
  const next: PropreneurSessionTenantState = {
    ...state,
    selectedTenantId: match.tenantId,
    selectedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, next);
  return next;
}

export type PropreneurTenantGateResult =
  | { ok: true; tenant: PropreneurLinkedTenant; linkedUserId: string }
  | {
      ok: false;
      reason: 'user_required' | 'tenant_required' | 'select_tenant';
      message: string;
      tenants?: PropreneurLinkedTenant[];
    };

/** Require linked user + single selected tenant before business queries. */
export function requirePropreneurSessionTenant(sessionId: string): PropreneurTenantGateResult {
  const state = getPropreneurSessionTenantState(sessionId);
  if (!state.linkedUserId) {
    return {
      ok: false,
      reason: 'user_required',
      message: 'Link your Propreneur account before querying business data.',
    };
  }
  if (state.tenants.length === 0) {
    return {
      ok: false,
      reason: 'tenant_required',
      message: 'No Propreneur tenants are linked to this user.',
    };
  }
  if (!state.selectedTenantId) {
    if (state.tenants.length === 1) {
      const only = state.tenants[0]!;
      selectPropreneurSessionTenant(sessionId, only.tenantId);
      return { ok: true, tenant: only, linkedUserId: state.linkedUserId };
    }
    return {
      ok: false,
      reason: 'select_tenant',
      message:
        'Several Propreneur workspaces are linked. Please select one for this session.',
      tenants: state.tenants,
    };
  }
  const tenant = state.tenants.find((t) => t.tenantId === state.selectedTenantId);
  if (!tenant) {
    return {
      ok: false,
      reason: 'select_tenant',
      message: 'Selected tenant is no longer linked. Please select again.',
      tenants: state.tenants,
    };
  }
  return { ok: true, tenant, linkedUserId: state.linkedUserId };
}

export function assertPropreneurSessionTenant(sessionId: string): PropreneurLinkedTenant {
  const gate = requirePropreneurSessionTenant(sessionId);
  if (!gate.ok) {
    throw new PropreneurTenantRequiredError(gate.message);
  }
  return gate.tenant;
}
