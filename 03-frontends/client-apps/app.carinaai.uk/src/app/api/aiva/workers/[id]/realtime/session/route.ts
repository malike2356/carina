import { NextRequest, NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { checkLegalGate } from '@/lib/legal/legal-gate';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import {
  buildRealtimeSessionConfig,
  createRealtimeCallAnswer,
  markRealtimeAccessFailed,
  probeRealtimeAccess,
  resolveOpenAiApiKey,
  safetyIdentifierFor,
} from '@/lib/aiva-realtime';
import { requireSession, requireWorkspace } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteContext = { params: Promise<{ id: string }> };

type WorkerPayload = {
  worker?: {
    id: string;
    name: string;
    roleDescription?: string | null;
    personaPrompt?: string | null;
  };
  error?: string;
};

function humanizeRealtimeError(raw: string, status: number): string {
  const text = raw.toLowerCase();
  if (status === 429 || text.includes('insufficient_quota') || text.includes('exceeded your current quota')) {
    return 'OpenAI realtime quota is exhausted on the platform key. Add billing credit, or add an OpenAI key under Settings → Keys, then retry. Meanwhile use Classic voice loop.';
  }
  if (text.includes('rate limit')) {
    return 'OpenAI realtime is rate-limited right now. Wait a moment or use Classic voice loop.';
  }
  if (text.includes('invalid_api_key') || text.includes('incorrect api key')) {
    return 'OpenAI API key is invalid. Check platform secrets or workspace BYOK.';
  }
  return raw;
}

async function loadWorkerForRealtime(
  workspaceId: string,
  workerId: string,
  fallbackName: string,
): Promise<NonNullable<WorkerPayload['worker']>> {
  try {
    const upstream = await proxyAivaRequest(
      workspaceId,
      `/api/aiva/workers/${encodeURIComponent(workerId)}`,
      { method: 'GET', signal: AbortSignal.timeout(5_000) },
    );
    const payload = (await upstream.json().catch(() => ({}))) as WorkerPayload;
    if (upstream.ok && payload.worker?.name) {
      return payload.worker;
    }
  } catch {
    /* fall through */
  }
  return {
    id: workerId,
    name: fallbackName || 'Aiva',
    roleDescription: null,
    personaPrompt: null,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const gate = await checkLegalGate(session.user.id, workspace.id);
    if (gate) return NextResponse.json(gate, { status: 403 });

    const { id: workerId } = await context.params;
    const workspaceKeys = await getDecryptedWorkspaceKeys(workspace.id);
    const apiKey = resolveOpenAiApiKey(workspaceKeys);
    const model = process.env.OPENAI_REALTIME_MODEL?.trim() || 'gpt-realtime-2.1';

    if (!apiKey) {
      return NextResponse.json({
        available: false,
        provider: 'openai-webrtc',
        model,
        workerId,
        fallback: 'classic',
        code: 'missing_key',
        reason: 'Realtime voice needs an OpenAI API key (platform or workspace BYOK).',
      });
    }

    const probe = await probeRealtimeAccess({ apiKey, model });
    return NextResponse.json({
      available: probe.ok,
      provider: 'openai-webrtc',
      model,
      workerId,
      fallback: probe.ok ? null : 'classic',
      code: probe.code,
      reason: probe.reason,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ available: false, error: message }, { status: 401 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const started = Date.now();
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const gate = await checkLegalGate(session.user.id, workspace.id);
    if (gate) return NextResponse.json(gate, { status: 403 });

    const { id: workerId } = await context.params;
    const offerSdp = (await request.text()).trim();
    if (!offerSdp || !offerSdp.includes('v=0')) {
      return NextResponse.json({ error: 'SDP offer is required' }, { status: 400 });
    }

    const workspaceKeys = await getDecryptedWorkspaceKeys(workspace.id);
    const apiKey = resolveOpenAiApiKey(workspaceKeys);
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'realtime_unavailable',
          message: 'Realtime voice needs an OpenAI API key (platform or workspace BYOK).',
        },
        { status: 503 },
      );
    }

    const fallbackName = (request.headers.get('x-aiva-worker-name') || 'Aiva').slice(0, 80);
    const worker = await loadWorkerForRealtime(workspace.id, workerId, fallbackName);
    console.info('[realtime/session]', {
      workerId,
      workerName: worker.name,
      sdpBytes: offerSdp.length,
      loadMs: Date.now() - started,
    });

    const sessionConfig = buildRealtimeSessionConfig(worker);
    const result = await createRealtimeCallAnswer({
      apiKey,
      offerSdp,
      session: sessionConfig,
      safetyIdentifier: safetyIdentifierFor(workspace.id, session.user.id),
      timeoutMs: 18_000,
    });

    if (!result.ok) {
      const message = humanizeRealtimeError(result.error, result.status);
      const code =
        result.status === 429
          ? 'quota'
          : result.status === 401
            ? 'auth'
            : result.status === 504
              ? 'unreachable'
              : 'unknown';
      markRealtimeAccessFailed(apiKey, message, code);
      console.warn('[realtime/session] openai failed', {
        workerId,
        status: result.status,
        error: result.error,
        totalMs: Date.now() - started,
      });
      return NextResponse.json(
        {
          error: message,
          message,
          code: result.status === 429 ? 'openai_quota' : 'openai_realtime_failed',
          fallback: 'classic',
        },
        { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
      );
    }

    console.info('[realtime/session] ok', { workerId, totalMs: Date.now() - started });
    return new NextResponse(result.sdp, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Cache-Control': 'no-store',
        'X-Aiva-Realtime-Provider': 'openai-webrtc',
        'X-Aiva-Realtime-Tools': 'deferred',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Realtime session failed';
    console.error('[realtime/session] exception', message, { totalMs: Date.now() - started });
    return NextResponse.json({ error: message, message }, { status: 500 });
  }
}
