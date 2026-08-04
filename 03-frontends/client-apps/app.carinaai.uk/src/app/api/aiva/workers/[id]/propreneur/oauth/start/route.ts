import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import {
  propreneurAuthorizeUrl,
  resolvePropreneurOAuthSigningSecret,
  signPropreneurOAuthState,
} from '@/lib/propreneur-oauth-state';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Start one-click Propreneur connect: redirect the signed-in Aiva user to
 * {slug}.propreneur.uk/aiva/authorize with signed state + callback.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const { id: workerId } = await context.params;

    const tenantSlug = (request.nextUrl.searchParams.get('tenantSlug') ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    if (!tenantSlug || tenantSlug.length < 2) {
      return NextResponse.json(
        { error: 'tenantSlug query param is required (e.g. xelox)' },
        { status: 400 },
      );
    }

    const secret = resolvePropreneurOAuthSigningSecret();
    if (!secret) {
      return NextResponse.json(
        { error: 'OAuth signing secret is not configured' },
        { status: 503 },
      );
    }

    const state = signPropreneurOAuthState(
      {
        workspaceId: workspace.id,
        workerId,
        tenantSlug,
      },
      secret,
    );

    const callback = new URL(
      `/api/aiva/workers/${encodeURIComponent(workerId)}/propreneur/oauth/callback`,
      request.nextUrl.origin,
    ).toString();

    const authorize = new URL(propreneurAuthorizeUrl(tenantSlug));
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('callback', callback);

    return NextResponse.redirect(authorize.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message.includes('Workspace') ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
