/** Dedupe helpers for outreach leads (email, phone, company number, email domain). */

export function normalizeEmail(email: string | undefined | null): string | undefined {
  const trimmed = String(email ?? '').trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return undefined;
  return trimmed;
}

export function normalizePhone(phone: string | undefined | null): string | undefined {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  if (digits.length < 7) return undefined;
  return digits;
}

export function emailDomain(email: string | undefined | null): string | undefined {
  const normalized = normalizeEmail(email);
  if (!normalized) return undefined;
  const domain = normalized.split('@')[1];
  return domain || undefined;
}

export interface DedupeCandidate {
  id: string;
  email?: string;
  phone?: string;
  companyNumber?: string;
}

export function findDuplicateLeadId(
  existing: DedupeCandidate[],
  candidate: { email?: string; phone?: string; companyNumber?: string },
  excludeId?: string,
): string | undefined {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const companyNumber = String(candidate.companyNumber ?? '').trim().toUpperCase() || undefined;
  for (const lead of existing) {
    if (excludeId && lead.id === excludeId) continue;
    const leadEmail = normalizeEmail(lead.email);
    const leadPhone = normalizePhone(lead.phone);
    const leadCompanyNumber = String(lead.companyNumber ?? '').trim().toUpperCase() || undefined;
    if (email && leadEmail && email === leadEmail) return lead.id;
    if (phone && leadPhone && phone === leadPhone) return lead.id;
    if (companyNumber && leadCompanyNumber && companyNumber === leadCompanyNumber) return lead.id;
  }
  return undefined;
}
