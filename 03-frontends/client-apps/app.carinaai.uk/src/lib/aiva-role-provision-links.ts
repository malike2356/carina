const HIREAIVA_ROLE_DESCRIPTIONS: Record<string, string> = {
  customer_service:
    'I need someone to handle customer support emails. They should answer common questions, check delivery and policy FAQs, and escalate anything unusual to my team.',
  booking:
    'I need a booking assistant to handle scheduling requests. They should check availability, confirm details like party size and time, and send follow-up confirmations and reminders.',
  sales:
    'I need a sales qualifier to respond to inbound enquiries. They should explain what our service includes, qualify fit, capture context, and route warm leads to my team.',
  property:
    'I need someone to handle property enquiries. They should answer questions about availability, collect requirements, book viewings, and log maintenance requests.',
  tech_support:
    'I need a tech support agent to triage login and access issues. They should gather details, answer common troubleshooting questions, and escalate when access or security is sensitive.',
};

export const AIVA_PROVISION_INTENT_COOKIE = 'aiva_provision_intent';
export const AIVA_PROVISION_DESCRIPTION_COOKIE = 'aiva_provision_description';

export function resolveHireaivaRoleDescription(role: string | null | undefined): string | null {
  const key = role?.trim().toLowerCase();
  if (!key) return null;
  return HIREAIVA_ROLE_DESCRIPTIONS[key] ?? null;
}

export function resolveProvisionDescription(input: {
  description?: string | null;
  role?: string | null;
}): string | null {
  const direct = input.description?.trim();
  if (direct) return direct;
  return resolveHireaivaRoleDescription(input.role);
}

export function buildAivaProvisionPath(input: {
  description?: string | null;
  role?: string | null;
}): string {
  const description = resolveProvisionDescription(input);
  const params = new URLSearchParams({ intent: 'provision' });
  if (description) params.set('description', description);
  return `/aiva/provision?${params.toString()}`;
}

export function buildAivaProvisionRegisterPath(input: {
  description?: string | null;
  role?: string | null;
}): string {
  const params = new URLSearchParams({ intent: 'provision' });
  const description = input.description?.trim();
  const role = input.role?.trim().toLowerCase();
  if (role) params.set('role', role);
  if (description) params.set('description', description);
  return `/register?${params.toString()}`;
}

export function buildAivaProvisionLoginPath(input: {
  description?: string | null;
  role?: string | null;
}): string {
  const callbackUrl = buildAivaProvisionPath(input);
  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function provisionIntentFromSearchParams(
  searchParams: Pick<URLSearchParams, 'get'>,
): { intent: boolean; description: string | null; role: string | null } {
  const intent = searchParams.get('intent')?.trim().toLowerCase() === 'provision';
  const role = searchParams.get('role')?.trim().toLowerCase() ?? null;
  const description = resolveProvisionDescription({
    description: searchParams.get('description'),
    role,
  });
  return { intent, description, role };
}

export function setClientProvisionIntentCookies(description: string | null): void {
  if (typeof document === 'undefined') return;
  if (description) {
    document.cookie = `${AIVA_PROVISION_DESCRIPTION_COOKIE}=${encodeURIComponent(description)}; path=/; max-age=3600; samesite=lax`;
  } else {
    document.cookie = `${AIVA_PROVISION_DESCRIPTION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
  document.cookie = `${AIVA_PROVISION_INTENT_COOKIE}=1; path=/; max-age=3600; samesite=lax`;
}

export function clearClientProvisionIntentCookies(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AIVA_PROVISION_INTENT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  document.cookie = `${AIVA_PROVISION_DESCRIPTION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function readClientProvisionDescription(): string | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AIVA_PROVISION_DESCRIPTION_COOKIE}=`));
  if (!raw) return null;
  const value = raw.slice(AIVA_PROVISION_DESCRIPTION_COOKIE.length + 1);
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
}
