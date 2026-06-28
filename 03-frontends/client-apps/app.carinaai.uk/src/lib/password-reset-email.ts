function resolveCoreUrl(): string {
  return (
    process.env.CARINA_CORE_URL?.trim()
    || (process.env.NODE_ENV === 'production' ? 'http://carina-web:3000' : 'http://localhost:3000')
  ).replace(/\/$/, '');
}

function resolveInternalKey(): string {
  return (
    process.env.CARINA_INTERNAL_KEY?.trim()
    || process.env.CARINA_OPS_TOKEN?.trim()
    || ''
  );
}

export async function sendPasswordResetViaCore(input: {
  email: string;
  resetUrl: string;
  expiresInMinutes?: number;
}): Promise<void> {
  const key = resolveInternalKey();
  if (!key) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[password-reset] DEV: ${input.email} -> ${input.resetUrl}`);
      return;
    }
    throw new Error('Password reset email is not configured (set CARINA_INTERNAL_KEY)');
  }

  const response = await fetch(`${resolveCoreUrl()}/api/internal/transactional/password-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': key,
    },
    body: JSON.stringify({
      email: input.email,
      resetUrl: input.resetUrl,
      expiresInMinutes: input.expiresInMinutes ?? 60,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Password reset email failed (${response.status}): ${text || 'no body'}`);
  }
}
