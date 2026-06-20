import { Router } from 'express';
import { BILLING_PLANS } from '../lib/billing-plans.js';
import {
  fetchAllSubscriptions,
  fetchTenantSummary,
  hostedTablesReady,
  provisioningLabel,
  tenantDisplayName,
} from '../lib/tenants.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', async (req, res) => {
  try {
    const ready = await hostedTablesReady();
    const summary = ready ? await fetchTenantSummary() : null;
    const subscriptions = ready ? await fetchAllSubscriptions() : [];
    const statusFilter = String(req.query.status ?? '').trim();
    const sourceFilter = String(req.query.source ?? '').trim();

    const filtered = subscriptions.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (sourceFilter === 'manual' && row.provisioningSource !== 'manual' && row.provisioningType !== 'manual') {
        return false;
      }
      if (sourceFilter === 'saas' && row.provisioningSource === 'manual') return false;
      return true;
    });

    res.render('subscriptions', {
      title: 'Subscriptions',
      ready,
      summary,
      subscriptions: filtered,
      statusFilter,
      sourceFilter,
      plans: BILLING_PLANS,
      provisioningLabel,
      tenantDisplayName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});
