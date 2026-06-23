import { pool } from '../memory/db.js';
import {
  normalizeWhiteLabelTier,
  WHITE_LABEL_COMMERCIAL_PLANS,
  type WhiteLabelCommercialTier,
} from '../billing/white-label-plans.js';
import { getPartnerAccount, listClientOrganizations } from './partner-service.js';

export interface WorkspaceUsageSummary {
  orgId: string;
  orgName: string;
  plan: string;
  tokensUsed: number;
  costEstimate: number;
}

export interface PartnerBillingSummary {
  partnerId: string;
  partnerName: string;
  commercialTier: WhiteLabelCommercialTier;
  maxClientWorkspaces: number;
  clientCount: number;
  totals: {
    tokensUsed: number;
    costEstimate: number;
  };
  clients: WorkspaceUsageSummary[];
}

export async function getWorkspaceUsageForOrg(orgId: string, days = 30): Promise<WorkspaceUsageSummary> {
  const orgResult = await pool.query<{ name: string; plan: string }>(
    `SELECT name, plan FROM organizations WHERE id = $1 LIMIT 1`,
    [orgId],
  );
  const org = orgResult.rows[0];
  const usageResult = await pool.query<{ tokens: string; cost: string }>(
    `SELECT COALESCE(SUM(tokens_used), 0)::TEXT AS tokens,
            COALESCE(SUM(cost_estimate), 0)::TEXT AS cost
     FROM usage_records
     WHERE org_id = $1
       AND date >= CURRENT_DATE - ($2::INT || ' days')::INTERVAL`,
    [orgId, String(days)],
  );
  return {
    orgId,
    orgName: String(org?.name ?? 'Workspace'),
    plan: String(org?.plan ?? 'free'),
    tokensUsed: Number(usageResult.rows[0]?.tokens ?? 0),
    costEstimate: Number(usageResult.rows[0]?.cost ?? 0),
  };
}

export async function getPartnerBillingSummary(partnerId: string, days = 30): Promise<PartnerBillingSummary> {
  const partner = await getPartnerAccount(partnerId);
  if (!partner) throw new Error('Partner account not found');

  const tier = normalizeWhiteLabelTier(partner.commercialTier);
  const tierMeta = WHITE_LABEL_COMMERCIAL_PLANS[tier];
  const clients = await listClientOrganizations(partnerId);
  const usageRows = await Promise.all(clients.map((client) => getWorkspaceUsageForOrg(client.orgId, days)));
  const totals = usageRows.reduce(
    (acc, row) => ({
      tokensUsed: acc.tokensUsed + row.tokensUsed,
      costEstimate: acc.costEstimate + row.costEstimate,
    }),
    { tokensUsed: 0, costEstimate: 0 },
  );

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    commercialTier: tier,
    maxClientWorkspaces: tierMeta.maxClientWorkspaces,
    clientCount: clients.length,
    totals,
    clients: usageRows,
  };
}
