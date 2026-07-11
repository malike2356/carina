export interface BillingUsageResponse {
  usage: {
    tokensUsed: number;
    limit: number | null;
    warning?: string;
    blocked?: string;
  };
  subscription: {
    plan: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
  };
  tier: string;
  planName: string;
  tokenLimit: number | null;
  monthlyPriceGbp: number | null;
  messagesToday: number;
  freeDailyLimit: number | null;
}

export async function fetchBillingUsage(baseUrl: string): Promise<BillingUsageResponse> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/billing/usage`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Billing usage ${response.status}: ${text || response.statusText}`);
  }
  return response.json() as Promise<BillingUsageResponse>;
}

export async function openBillingPortal(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/billing/portal`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Billing portal ${response.status}: ${text || response.statusText}`);
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error('No billing portal URL returned');
  return data.url;
}

export async function startBillingCheckout(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/auth/billing/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Billing checkout ${response.status}: ${text || response.statusText}`);
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error('No checkout URL returned');
  return data.url;
}
