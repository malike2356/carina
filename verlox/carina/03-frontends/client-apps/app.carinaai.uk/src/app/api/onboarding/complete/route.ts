import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import {
  buildOnboardingCompleteRedirect,
  resolveChannelSetupUrl,
} from '@/lib/onboarding-catalog';
import { applyOnboardingCompleteCookies } from '@/lib/onboarding-cookies';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { requireSession, requireWorkspace } from '@/lib/session';
import { respondAuthError } from '@/lib/api-auth';

type CompleteBody = {
  templateId?: string;
  channelId?: string;
  channelConfig?: Record<string, unknown>;
  customDescription?: string;
  workerName?: string;
};

async function provisionFromTemplate(
  workspaceId: string,
  body: CompleteBody,
): Promise<
  | { ok: true; workerId: string; workspaceId: string }
  | { ok: false; status: number; payload: Record<string, unknown> }
> {
  const templateId = String(body.templateId ?? '').trim();
  if (!templateId) {
    return { ok: false, status: 400, payload: { error: 'templateId is required' } };
  }

  if (templateId === 'custom') {
    const roleDescription = String(body.customDescription ?? '').trim();
    if (roleDescription.length < 10) {
      return {
        ok: false,
        status: 400,
        payload: { error: 'customDescription must be at least 10 characters' },
      };
    }
    const roleName = String(body.workerName ?? 'My AI Employee').trim() || 'My AI Employee';
    const channels = body.channelId ? [body.channelId] : ['email'];
    const channelBindings = body.channelConfig?.identifier
      ? [{ channel: body.channelId ?? 'email', identifier: String(body.channelConfig.identifier) }]
      : [];

    const upstream = await proxyAivaRequest(workspaceId, '/api/aiva/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: roleName,
        roleName,
        roleDescription,
        roleTemplate: 'custom',
        channels,
        channelBindings,
        language: 'en-GB',
        onboardingComplete: true,
      }),
    });
    const payload = (await upstream.json()) as { worker?: { id: string }; error?: string };
    if (!upstream.ok || !payload.worker?.id) {
      return {
        ok: false,
        status: upstream.status,
        payload: payload as Record<string, unknown>,
      };
    }
    return { ok: true, workerId: payload.worker.id, workspaceId };
  }

  const upstream = await proxyAivaRequest(workspaceId, '/api/aiva/marketplace/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId }),
  });
  const payload = (await upstream.json()) as {
    status?: string;
    workerId?: string;
    workspaceId?: string;
    error?: string;
  };
  if (!upstream.ok) {
    return { ok: false, status: upstream.status, payload: payload as Record<string, unknown> };
  }
  if (payload.status === 'checkout_required') {
    return { ok: false, status: 402, payload: payload as Record<string, unknown> };
  }
  if (!payload.workerId) {
    return { ok: false, status: 502, payload: { error: 'Provisioner did not return workerId' } };
  }
  return {
    ok: true,
    workerId: payload.workerId,
    workspaceId: payload.workspaceId ?? workspaceId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const body = (await request.json()) as CompleteBody;

    const provisioned = await provisionFromTemplate(workspace.id, body);
    if (!provisioned.ok) {
      return NextResponse.json(provisioned.payload, { status: provisioned.status });
    }

    await db
      .update(workspaces)
      .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(workspaces.id, workspace.id));

    void proxyAivaRequest(workspace.id, '/api/onboarding/welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId: provisioned.workerId,
        templateId: body.templateId ?? null,
        channelId: body.channelId ?? null,
      }),
    }).catch(() => {});

    const redirect = buildOnboardingCompleteRedirect(provisioned.workspaceId);
    const channelSetupUrl = resolveChannelSetupUrl(body.channelId, provisioned.workerId);

    const response = NextResponse.json({
      success: true,
      workspaceId: provisioned.workspaceId,
      workerId: provisioned.workerId,
      redirect,
      channelSetupUrl,
    });
    return applyOnboardingCompleteCookies(response);
  } catch (err) {
    return respondAuthError(err);
  }
}
