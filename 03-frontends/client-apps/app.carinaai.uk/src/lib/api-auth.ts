import { NextResponse } from 'next/server';
import { LegalGateRequiredError } from '@/lib/legal/errors';
import { legalGateResponse } from '@/lib/legal/legal-gate';

export function respondAuthError(err: unknown): NextResponse {
  if (err instanceof LegalGateRequiredError) {
    return legalGateResponse(err.gate);
  }
  const message = err instanceof Error ? err.message : 'Unauthorized';
  const status = message.toLowerCase().includes('workspace') ? 403 : 401;
  return NextResponse.json({ error: message }, { status });
}
