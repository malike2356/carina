/** Dedupe helpers for outreach leads (email, phone, website+company+location, company number). */

export function normalizeEmail(email: string | undefined | null): string | undefined {
  const trimmed = String(email ?? '').trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) return undefined;
  return trimmed;
}

export function normalizePhone(phone: string | undefined | null): string | undefined {
  let digits = String(phone ?? '').replace(/\D+/g, '');
  if (digits.length < 7) return undefined;
  // UK international variants: 0044… / 44… → national 0…
  if (digits.startsWith('0044') && digits.length > 10) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('44') && digits.length > 10) digits = `0${digits.slice(2)}`;
  return digits;
}

export function emailDomain(email: string | undefined | null): string | undefined {
  const normalized = normalizeEmail(email);
  if (!normalized) return undefined;
  const domain = normalized.split('@')[1];
  return domain || undefined;
}

export function normalizeWebsite(website: string | undefined | null): string | undefined {
  let raw = String(website ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  raw = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  const host = raw.split('/')[0]?.split('?')[0]?.trim();
  return host || undefined;
}

export function normalizeCompanyLocationKey(
  company: string | undefined | null,
  townCity: string | undefined | null,
): string | undefined {
  const c = String(company ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!c) return undefined;
  const loc = String(townCity ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return loc ? `${c}|${loc}` : c;
}

export interface DedupeCandidate {
  id: string;
  email?: string;
  phone?: string;
  companyNumber?: string;
  website?: string;
  company?: string;
  townCity?: string;
}

export function findDuplicateLeadId(
  existing: DedupeCandidate[],
  candidate: {
    email?: string;
    phone?: string;
    companyNumber?: string;
    website?: string;
    company?: string;
    townCity?: string;
  },
  excludeId?: string,
): string | undefined {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const companyNumber = String(candidate.companyNumber ?? '').trim().toUpperCase() || undefined;
  const website = normalizeWebsite(candidate.website);
  const companyLoc = normalizeCompanyLocationKey(candidate.company, candidate.townCity);

  for (const lead of existing) {
    if (excludeId && lead.id === excludeId) continue;
    const leadEmail = normalizeEmail(lead.email);
    const leadPhone = normalizePhone(lead.phone);
    const leadCompanyNumber = String(lead.companyNumber ?? '').trim().toUpperCase() || undefined;
    const leadWebsite = normalizeWebsite(lead.website);
    const leadCompanyLoc = normalizeCompanyLocationKey(lead.company, lead.townCity);

    if (email && leadEmail && email === leadEmail) return lead.id;
    if (phone && leadPhone && phone === leadPhone) return lead.id;
    if (companyNumber && leadCompanyNumber && companyNumber === leadCompanyNumber) return lead.id;
    if (website && leadWebsite && website === leadWebsite && companyLoc && leadCompanyLoc && companyLoc === leadCompanyLoc) {
      return lead.id;
    }
  }
  return undefined;
}
