import { carinaPost } from './carina.js';

export async function notifyCoreBillingConfigReload(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await carinaPost('/api/ops/billing-config/reload', {}, 8000);
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: text.slice(0, 200) || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
