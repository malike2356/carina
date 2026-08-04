export function normalizeSocialReplyText(text: string): string {
  return text.trim().toLowerCase().replace(/[!?.,"']+$/g, '').replace(/\s+/g, ' ');
}

export function matchesSocialAutoReplyAllowlist(
  draftText: string,
  allowlist: string[],
): boolean {
  const normalized = normalizeSocialReplyText(draftText);
  if (!normalized) return false;
  return allowlist.some((phrase) => {
    const candidate = normalizeSocialReplyText(phrase);
    if (!candidate) return false;
    return normalized === candidate || normalized.startsWith(`${candidate} `);
  });
}

export function shouldAutoSendSocialReply(input: {
  socialRequireApproval: boolean;
  socialAutoReplyEnabled: boolean;
  socialAutoReplyAllowlist: string[];
  draftText: string;
}): boolean {
  if (input.socialRequireApproval && !input.socialAutoReplyEnabled) {
    return false;
  }
  if (!input.socialAutoReplyEnabled) {
    return !input.socialRequireApproval;
  }
  return matchesSocialAutoReplyAllowlist(input.draftText, input.socialAutoReplyAllowlist);
}
