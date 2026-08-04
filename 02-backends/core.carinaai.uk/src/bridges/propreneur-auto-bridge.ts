import { getWorkspaceContact } from '../email/workspace-contact.js';
import { isPropreneurBridgeEnabled } from '../workers/aiva-feature-flags.js';
import { credentialsConfigured } from '../channels/credential-store.js';
import {
  resolvePropreneurBinding,
  validateAndSetPropreneurBinding,
} from '../workers/worker-bridge-store.js';
import type { Worker } from '../types/index.js';

const PROPERTY_TEMPLATE_IDS = new Set([
  'property-manager',
  'mortgage-broker-assistant',
]);

function centralUrl(): string {
  const override = process.env.PROPREENEUR_CENTRAL_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  const base = (process.env.PROPREENEUR_TENANT_BASE_DOMAIN ?? 'propreneur.uk').trim();
  return `https://${base}`;
}

function autoBridgeSecret(): string {
  return (
    process.env.PROPREENEUR_AUTO_BRIDGE_SECRET?.trim()
    || process.env.AIVA_AUTO_BRIDGE_SECRET?.trim()
    || ''
  );
}

export function shouldAutoBindPropreneur(input: {
  templateId?: string | null;
  skillPacks?: string[] | null;
}): boolean {
  const templateId = (input.templateId ?? '').trim();
  if (templateId && PROPERTY_TEMPLATE_IDS.has(templateId)) return true;
  const packs = input.skillPacks ?? [];
  return packs.some((p) => String(p).trim() === 'property-uk');
}

export type AutoBridgeResolveResult = {
  matched: boolean;
  tenantSlug?: string;
  apiKey?: string;
  companyName?: string;
  message?: string;
};

export async function resolvePropreneurGrantByEmail(
  email: string,
): Promise<AutoBridgeResolveResult | null> {
  const secret = autoBridgeSecret();
  if (!secret) {
    console.warn('[propreneur-auto-bridge] PROPREENEUR_AUTO_BRIDGE_SECRET is not set');
    return null;
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const response = await fetch(`${centralUrl()}/api/aiva-auto-bridge/resolve`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Aiva-Auto-Bridge-Key': secret,
    },
    body: JSON.stringify({ email: normalized }),
  });

  if (response.status === 404) {
    return { matched: false, message: 'No Propreneur workspace for this email' };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Propreneur auto-bridge resolve failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  const json = (await response.json()) as {
    matched?: boolean;
    tenant_slug?: string;
    api_key?: string;
    company_name?: string;
    message?: string;
  };

  if (!json.matched || !json.tenant_slug || !json.api_key) {
    return { matched: false, message: json.message ?? 'No match' };
  }

  return {
    matched: true,
    tenantSlug: json.tenant_slug,
    apiKey: json.api_key,
    companyName: json.company_name,
  };
}

/**
 * Best-effort auto-bind after hiring a property-related Aiva.
 * Never throws to the hire caller; logs and returns null on miss/failure.
 */
export async function tryAutoBindPropreneurOnHire(input: {
  workspaceId: string;
  worker: Worker;
  templateId?: string | null;
  skillPacks?: string[] | null;
}): Promise<{ tenantSlug: string; propertyCount: number } | null> {
  if (!isPropreneurBridgeEnabled()) return null;
  if (!credentialsConfigured()) return null;
  if (!shouldAutoBindPropreneur(input)) return null;

  const existing = resolvePropreneurBinding(input.worker);
  if (existing) return null;

  try {
    const contact = await getWorkspaceContact(input.workspaceId);
    const email = contact?.ownerEmail?.trim().toLowerCase() ?? '';
    if (!email) {
      console.info('[propreneur-auto-bridge] skip: no workspace owner email', {
        workspaceId: input.workspaceId,
        workerId: input.worker.id,
      });
      return null;
    }

    const grant = await resolvePropreneurGrantByEmail(email);
    if (!grant?.matched || !grant.tenantSlug || !grant.apiKey) {
      console.info('[propreneur-auto-bridge] no Propreneur match for email', {
        workspaceId: input.workspaceId,
        workerId: input.worker.id,
      });
      return null;
    }

    const result = await validateAndSetPropreneurBinding(
      input.workspaceId,
      input.worker.id,
      grant.tenantSlug,
      grant.apiKey,
    );

    console.info('[propreneur-auto-bridge] bound worker', {
      workspaceId: input.workspaceId,
      workerId: input.worker.id,
      tenantSlug: result.tenantSlug,
      propertyCount: result.propertyCount,
    });

    return result;
  } catch (err) {
    console.warn('[propreneur-auto-bridge] auto-bind failed:', err);
    return null;
  }
}
