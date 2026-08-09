import express, { type Request, type Response, type Router as ExpressRouter } from 'express';
import {
  bindPropreneurSessionUser,
  getPropreneurSessionTenantState,
  selectPropreneurSessionTenant,
  type PropreneurLinkedTenant,
} from '../tools/propreneur-session-tenant.js';

export const aivaPropreneurSessionRouter: ExpressRouter = express.Router();

function sessionIdFrom(req: Request): string {
  const header = String(req.header('x-aiva-session-id') ?? '').trim();
  if (header) return header;
  const q = String(req.query.session_id ?? '').trim();
  if (q) return q;
  return 'default';
}

aivaPropreneurSessionRouter.get('/propreneur/session-tenant', (req: Request, res: Response) => {
  const state = getPropreneurSessionTenantState(sessionIdFrom(req));
  const selected = state.tenants.find((t) => t.tenantId === state.selectedTenantId) ?? null;
  res.json({
    ok: true,
    session_id: state.sessionId,
    linked_user_id: state.linkedUserId,
    selected_tenant_id: state.selectedTenantId,
    selected_tenant_slug: selected?.tenantSlug ?? null,
    selected_label: selected?.label ?? selected?.tenantSlug ?? null,
    tenants: state.tenants,
    selected_at: state.selectedAt,
  });
});

aivaPropreneurSessionRouter.post('/propreneur/session-tenant', (req: Request, res: Response) => {
  const sessionId = sessionIdFrom(req);
  const body = (req.body ?? {}) as {
    linked_user_id?: string;
    tenants?: PropreneurLinkedTenant[];
    selected_tenant_id?: string;
  };

  if (Array.isArray(body.tenants) && typeof body.linked_user_id === 'string') {
    bindPropreneurSessionUser(sessionId, body.linked_user_id, body.tenants);
  }

  if (typeof body.selected_tenant_id === 'string' && body.selected_tenant_id.trim() !== '') {
    try {
      selectPropreneurSessionTenant(sessionId, body.selected_tenant_id.trim());
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Invalid tenant selection',
      });
      return;
    }
  }

  const state = getPropreneurSessionTenantState(sessionId);
  const selected = state.tenants.find((t) => t.tenantId === state.selectedTenantId) ?? null;
  res.json({
    ok: true,
    session_id: state.sessionId,
    linked_user_id: state.linkedUserId,
    selected_tenant_id: state.selectedTenantId,
    selected_tenant_slug: selected?.tenantSlug ?? null,
    selected_label: selected?.label ?? selected?.tenantSlug ?? null,
    tenants: state.tenants,
    selected_at: state.selectedAt,
  });
});
