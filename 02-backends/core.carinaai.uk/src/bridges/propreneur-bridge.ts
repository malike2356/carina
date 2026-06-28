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
