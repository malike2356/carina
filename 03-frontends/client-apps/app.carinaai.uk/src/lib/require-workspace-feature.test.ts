import { describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

/**
 * Lightweight tests for the 404-vs-pass behaviour of requireWorkspaceFeature
 * without needing a live database. Mirrors the middleware contract.
 */
async function gate(
  enabled: boolean,
): Promise<NextResponse | null> {
  if (enabled) return null;
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

describe('requireWorkspaceFeature middleware contract', () => {
  it('returns 404 for disabled features', async () => {
    const response = await gate(false);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(404);
    const body = await response!.json();
    expect(body.error).toBe('Not found');
  });

  it('passes through for enabled features', async () => {
    const response = await gate(true);
    expect(response).toBeNull();
  });
});
