import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import {
  propreneurExchangeUrl,
  resolvePropreneurOAuthSigningSecret,
  verifyPropreneurOAuthState,
} from '@/lib/propreneur-oauth-state';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * OAuth-style callback after the user clicks Allow on Propreneur.
 * Exchanges the one-time code for an API key, then binds the worker.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: workerId } = await context.params;
  const url = request.nextUrl;
  const code = (url.searchParams.get('code') ?? '').trim();
  const state = (url.searchParams.get('state') ?? '').trim();
  const oauthError = (url.searchParams.get('error') ?? '').trim();

  const toolsRedirect = (query: Record<string, string>) => {
    const target = new URL(`/aiva/workers/${encodeURIComponent(workerId)}`, url.origin);
    target.searchParams.set('tab', 'tools');
    for (const [k, v] of Object.entries(query)) {
      target.searchParams.set(k, v);
    }
    return NextResponse.redirect(target.toString());
  };

  if (oauthError) {
    return toolsRedirect({
      propreneur_error: oauthError === 'access_denied' ? 'denied' : oauthError,
    });
  }

  if (!code || !state) {
    return toolsRedirect({ propreneur_error: 'missing_code' });
  }

  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const secret = resolvePropreneurOAuthSigningSecret();
    if (!secret) {
      return toolsRedirect({ propreneur_error: 'not_configured' });
    }

    const payload = verifyPropreneurOAuthState(state, secret);
    if (!payload) {
      return toolsRedirect({ propreneur_error: 'invalid_state' });
    }

    if (payload.workspaceId !== workspace.id || payload.workerId !== workerId) {
      return toolsRedirect({ propreneur_error: 'state_mismatch' });
    }

    const exchangeRes = await fetch(propreneurExchangeUrl(payload.tenantSlug), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code, state }),
    });

    if (!exchangeRes.ok) {
      return toolsRedirect({ propreneur_error: 'exchange_failed' });
    }

    const grant = (await exchangeRes.json()) as {
      tenant_slug?: string;
      api_key?: string;
    };

    const tenantSlug = String(grant.tenant_slug ?? payload.tenantSlug).trim();
    const apiKey = String(grant.api_key ?? '').trim();

    if (!tenantSlug || !apiKey) {
      return toolsRedirect({ propreneur_error: 'incomplete_grant' });
    }

    const bindRes = await proxyAivaRequest(
      workspace.id,
      `/api/aiva/workers/${encodeURIComponent(workerId)}/propreneur/bind`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, apiKey }),
      },
    );

    if (!bindRes.ok) {
      return toolsRedirect({ propreneur_error: 'bind_failed' });
    }

    const bindData = (await bindRes.json().catch(() => ({}))) as {
      tenantSlug?: string;
      propertyCount?: number;
    };

    return toolsRedirect({
      propreneur_ok: '1',
      propreneur_slug: bindData.tenantSlug ?? tenantSlug,
      ...(bindData.propertyCount != null
        ? { propreneur_props: String(bindData.propertyCount) }
        : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error';
    if (message === 'Unauthorized') {
      const login = new URL('/login', url.origin);
      login.searchParams.set(
        'returnTo',
        `/api/aiva/workers/${encodeURIComponent(workerId)}/propreneur/oauth/callback?${url.searchParams.toString()}`,
      );
      return NextResponse.redirect(login.toString());
    }
    return toolsRedirect({ propreneur_error: 'server_error' });
  }
}
