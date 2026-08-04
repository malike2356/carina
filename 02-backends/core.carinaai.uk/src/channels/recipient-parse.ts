/**
 * Parse Telegram recipients from @username, numeric chat ids, or web.telegram.org links.
 */

export function parseTelegramRecipient(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const fromUrl = value.match(
    /(?:https?:\/\/)?(?:web\.)?telegram\.org\/(?:k\/)?#?@?([A-Za-z][A-Za-z0-9_]{3,})/i,
  );
  if (fromUrl?.[1]) return `@${fromUrl[1]}`;

  const fromPath = value.match(/t\.me\/([A-Za-z][A-Za-z0-9_]{3,})/i);
  if (fromPath?.[1]) return `@${fromPath[1]}`;

  if (/^@[A-Za-z][A-Za-z0-9_]{3,}$/.test(value)) return value;
  if (/^[A-Za-z][A-Za-z0-9_]{3,}$/.test(value) && !/^\d+$/.test(value)) return `@${value}`;
  if (/^-?\d{5,}$/.test(value)) return value;
  return null;
}

export function looksLikeLoginHandle(name: string, email?: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return true;
  if (email) {
    const local = email.split('@')[0]?.toLowerCase() ?? '';
    if (local && n === local) return true;
  }
  // Single token with no space, all lowercase/alphanumeric: likely a login, not a person name.
  if (!/\s/.test(n) && /^[a-z0-9._-]{3,}$/.test(n)) return true;
  return false;
}

export function resolveOperatorDisplayName(opts: {
  preferredName?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  userProfileFacts?: string[];
}): string {
  const preferred = opts.preferredName?.trim() ?? '';
  if (preferred) return preferred;

  for (const fact of opts.userProfileFacts ?? []) {
    const m = fact.match(/\b(?:name|call me|i am|i'm)\b[:\s]+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})/i)
      || fact.match(/^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/);
    if (m?.[1] && !looksLikeLoginHandle(m[1], opts.ownerEmail ?? undefined)) {
      return m[1].trim();
    }
  }

  const owner = opts.ownerName?.trim() ?? '';
  if (owner && !looksLikeLoginHandle(owner, opts.ownerEmail ?? undefined)) return owner;

  const emailLocal = opts.ownerEmail?.split('@')[0]?.trim() ?? '';
  if (emailLocal && !looksLikeLoginHandle(emailLocal)) return emailLocal;
  return 'the workspace owner';
}
