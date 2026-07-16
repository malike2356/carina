import type {
  PropreneurBridgeBinding,
  PropreneurComplianceItem,
  PropreneurPortfolioResponse,
  PropreneurProposalResponse,
  PropreneurCarinaChatResponse,
} from './propreneur-bridge.types.js';

function tenantBaseDomain(): string {
  return (process.env.PROPREENEUR_TENANT_BASE_DOMAIN ?? 'propreneur.uk').trim();
}

function bridgeBaseUrl(binding: PropreneurBridgeBinding): string {
  const override = process.env.PROPREENEUR_BRIDGE_BASE_URL?.trim();
  if (override) {
    return override.replace(/\/$/, '');
  }
  return `https://${binding.tenantSlug}.${tenantBaseDomain()}`;
}

async function bridgeFetch<T>(
  binding: PropreneurBridgeBinding,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${bridgeBaseUrl(binding)}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${binding.apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Propreneur bridge ${path} failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

async function bridgePost<T>(
  binding: PropreneurBridgeBinding,
  path: string,
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${binding.apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch(`${bridgeBaseUrl(binding)}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Propreneur bridge ${path} failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

export async function getPortfolio(binding: PropreneurBridgeBinding): Promise<PropreneurPortfolioResponse> {
  return bridgeFetch<PropreneurPortfolioResponse>(binding, '/api/aiva-bridge/portfolio');
}

export async function getProperty(
  binding: PropreneurBridgeBinding,
  propertyId: number,
): Promise<Record<string, unknown>> {
  return bridgeFetch<Record<string, unknown>>(binding, `/api/aiva-bridge/properties/${propertyId}`);
}

export async function getCompliance(
  binding: PropreneurBridgeBinding,
  propertyId: number,
): Promise<{ property_id: number; items: PropreneurComplianceItem[] }> {
  return bridgeFetch(binding, `/api/aiva-bridge/properties/${propertyId}/compliance`);
}

export async function getDeals(
  binding: PropreneurBridgeBinding,
  status?: string,
): Promise<{ total: number; deals: Record<string, unknown>[] }> {
  const query = status ? { status } : undefined;
  return bridgeFetch(binding, '/api/aiva-bridge/deals', query);
}

export async function getEmailActivity(
  binding: PropreneurBridgeBinding,
  hours = 24,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/email-activity', { hours: String(hours) });
}

export async function proposeDeal(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string; idempotencyKey?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(
    binding,
    '/api/aiva-bridge/proposals/deal',
    {
      ...payload,
      source_worker_ref: options?.sourceWorkerRef,
    },
    options?.idempotencyKey,
  );
}

export async function proposeComplianceUpdate(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string; idempotencyKey?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(
    binding,
    '/api/aiva-bridge/proposals/compliance',
    {
      ...payload,
      source_worker_ref: options?.sourceWorkerRef,
    },
    options?.idempotencyKey,
  );
}

export async function proposeFinancialLog(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string; idempotencyKey?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(
    binding,
    '/api/aiva-bridge/proposals/financial-log',
    {
      ...payload,
      source_worker_ref: options?.sourceWorkerRef,
    },
    options?.idempotencyKey,
  );
}

// ── Expanded bridge reads (CRM, maintenance, accounting, documents, workspace) ──

export async function getContacts(
  binding: PropreneurBridgeBinding,
  type?: string,
): Promise<Record<string, unknown>> {
  const query = type ? { type } : undefined;
  return bridgeFetch(binding, '/api/aiva-bridge/contacts', query);
}

export async function getContact(
  binding: PropreneurBridgeBinding,
  contactId: number,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, `/api/aiva-bridge/contacts/${contactId}`);
}

export async function getContactInteractions(
  binding: PropreneurBridgeBinding,
  contactId: number,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, `/api/aiva-bridge/contacts/${contactId}/interactions`);
}

export async function getSourcingLeads(
  binding: PropreneurBridgeBinding,
  stage?: string,
): Promise<Record<string, unknown>> {
  const query = stage ? { stage } : undefined;
  return bridgeFetch(binding, '/api/aiva-bridge/sourcing-leads', query);
}

export async function getMaintenanceRequests(
  binding: PropreneurBridgeBinding,
  filters?: { status?: string; property_id?: string },
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/maintenance/requests', filters);
}

export async function getMaintenanceRequest(
  binding: PropreneurBridgeBinding,
  requestId: number,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, `/api/aiva-bridge/maintenance/requests/${requestId}`);
}

export async function getWorksOrders(
  binding: PropreneurBridgeBinding,
  filters?: { status?: string; property_id?: string },
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/maintenance/works-orders', filters);
}

export async function getExpenses(
  binding: PropreneurBridgeBinding,
  filters?: { property_id?: string; since?: string },
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/accounting/expenses', filters);
}

export async function getIncome(
  binding: PropreneurBridgeBinding,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/accounting/income');
}

export async function getRentPayments(
  binding: PropreneurBridgeBinding,
  filters?: { since?: string },
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/accounting/rent-payments', filters);
}

export async function getDocuments(
  binding: PropreneurBridgeBinding,
  filters?: { property_id?: string; category?: string },
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/documents', filters);
}

export async function getWorkspaceSettings(
  binding: PropreneurBridgeBinding,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/workspace/settings');
}

export async function getOnboardingStatus(
  binding: PropreneurBridgeBinding,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/workspace/onboarding');
}

export async function getTeamMembers(
  binding: PropreneurBridgeBinding,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/workspace/team');
}

export async function getRoles(
  binding: PropreneurBridgeBinding,
): Promise<Record<string, unknown>> {
  return bridgeFetch(binding, '/api/aiva-bridge/workspace/roles');
}

// ── Expanded bridge writes (proposals) ──

export async function proposeContact(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(binding, '/api/aiva-bridge/proposals/contact', {
    ...payload,
    source_worker_ref: options?.sourceWorkerRef,
  });
}

export async function proposeMaintenance(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(binding, '/api/aiva-bridge/proposals/maintenance', {
    ...payload,
    source_worker_ref: options?.sourceWorkerRef,
  });
}

export async function proposeWorksOrder(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(binding, '/api/aiva-bridge/proposals/works-order', {
    ...payload,
    source_worker_ref: options?.sourceWorkerRef,
  });
}

export async function proposeExpense(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(binding, '/api/aiva-bridge/proposals/expense', {
    ...payload,
    source_worker_ref: options?.sourceWorkerRef,
  });
}

export async function proposeTeamInvite(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(binding, '/api/aiva-bridge/proposals/team-invite', {
    ...payload,
    source_worker_ref: options?.sourceWorkerRef,
  });
}

export async function proposeSetting(
  binding: PropreneurBridgeBinding,
  payload: Record<string, unknown>,
  options?: { sourceWorkerRef?: string },
): Promise<PropreneurProposalResponse> {
  return bridgePost<PropreneurProposalResponse>(binding, '/api/aiva-bridge/proposals/setting', {
    ...payload,
    source_worker_ref: options?.sourceWorkerRef,
  });
}

export async function chatWithCarina(
  binding: PropreneurBridgeBinding,
  message: string,
  clientSessionId?: string,
): Promise<PropreneurCarinaChatResponse> {
  const body: Record<string, unknown> = { message };
  if (clientSessionId) {
    body.session_id = clientSessionId;
  }
  return bridgePost<PropreneurCarinaChatResponse>(binding, '/api/remote/carina/chat', body);
}

export function formatPortfolioContext(portfolio: PropreneurPortfolioResponse): string {
  if (portfolio.total === 0) {
    return 'Propreneur portfolio: no properties on file.';
  }
  const lines = portfolio.properties.slice(0, 25).map((p) => {
    const rent = p.monthly_rent != null ? `, rent GBP ${p.monthly_rent}` : '';
    const epc = p.epc_expiry ? `, EPC expires ${p.epc_expiry}` : '';
    return `- ${p.label} (${p.status ?? 'unknown'}${rent}${epc})`;
  });
  return `Propreneur portfolio (${portfolio.total} properties):\n${lines.join('\n')}`;
}

// ── Scoped proxy ──────────────────────────────────────────────────────────────

export interface ProxyDispatchOptions {
  targetPath: string;
  targetMethod?: string;
  targetBody?: Record<string, unknown>;
  targetQuery?: Record<string, string>;
}

export interface ProxyDispatchResponse {
  proxy_status: number;
  proxy_path: string;
  proxy_method: string;
  data: Record<string, unknown>;
}

export async function proxyDispatch(
  binding: PropreneurBridgeBinding,
  options: ProxyDispatchOptions,
): Promise<ProxyDispatchResponse> {
  return bridgePost<ProxyDispatchResponse>(binding, '/api/aiva-proxy/dispatch', {
    target_path: options.targetPath,
    target_method: options.targetMethod ?? 'GET',
    target_body: options.targetBody ?? {},
    target_query: options.targetQuery ?? {},
  });
}

export async function getProxyScopes(
  binding: PropreneurBridgeBinding,
): Promise<{ scopes: string[]; domains: string[]; permissions: string[] }> {
  return bridgeFetch(binding, '/api/aiva-proxy/scopes');
}
