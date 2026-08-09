import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import {
  createPropreneurPkcePair,
  propreneurAuthorizeUrl,
  propreneurPkceCookieName,
  resolvePropreneurOAuthSigningSecret,
  signPropreneurOAuthState,
} from '@/lib/propreneur-oauth-state';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Start one-click Propreneur connect: redirect the signed-in Aiva user to
 * {slug}.propreneur.uk/aiva/authorize with signed state, PKCE, and callback.
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

    const pkce = createPropreneurPkcePair();
    const callback = new URL(
      `/api/aiva/workers/${encodeURIComponent(workerId)}/propreneur/oauth/callback`,
      request.nextUrl.origin,
    ).toString();

    const scopeBundle = (request.nextUrl.searchParams.get('scopeBundle') ?? 'operational_crud').trim();

    const authorize = new URL(propreneurAuthorizeUrl(tenantSlug));
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('callback', callback);
    authorize.searchParams.set('code_challenge', pkce.challenge);
    authorize.searchParams.set('code_challenge_method', pkce.method);
    authorize.searchParams.set('scope_bundle', scopeBundle || 'operational_crud');
    authorize.searchParams.set('aiva_workspace_id', workspace.id);
    authorize.searchParams.set('aiva_worker_id', workerId);
    authorize.searchParams.set('aiva_user_id', session.user.id);

    const response = NextResponse.redirect(authorize.toString());
    response.cookies.set(propreneurPkceCookieName(state), pkce.verifier, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    const status = message.includes('Workspace') ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
