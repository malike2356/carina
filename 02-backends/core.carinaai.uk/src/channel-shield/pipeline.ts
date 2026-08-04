import { appendEvent, getMessage, getProtection, updateMessage } from './store.js';
import {
  buildSafeSummary,
  combineVerdict,
  scoreAgentHeuristics,
  scoreIdentity,
  scoreStatic,
  scoreUrls,
  shouldFailClosed,
  type StageScores,
} from './verdict.js';
import { reportShieldEvent, isShieldDeliveryKilled, evaluateShieldDeliverPolicy } from './scout-bridge.js';
import { holdMessage, notifySafeSummaryForMessage } from './quarantine.js';
import { deliverCleanMessage } from './delivery.js';
import type { ShieldVerdict } from './types.js';

async function submitSandboxStub(
  messageId: string,
  attachments: Array<{ filename: string; contentType: string }>,
  policyTypes: string[],
): Promise<{ score: number; flags: string[]; jobs: string[]; degraded: boolean }> {
  const flags: string[] = [];
  const jobs: string[] = [];
  let score = 0;
  let degraded = false;
  const needsSandbox = attachments.filter((a) => policyTypes.includes(a.contentType));
  if (needsSandbox.length === 0) return { score: 0, flags, jobs, degraded: false };

  const wardenUrl = process.env.WARDEN_SANDBOX_URL?.trim() || process.env.SCOUT_WARDEN_URL?.trim();
  for (const a of needsSandbox) {
    if (!wardenUrl) {
      degraded = true;
      flags.push(`sandbox_degraded:${a.filename}`);
      score = Math.max(score, 85);
      continue;
    }
    try {
      const res = await fetch(`${wardenUrl.replace(/\/$/, '')}/api/warden/sandbox/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.LABYRINTH_API_KEY ? { 'X-Scout-Key': process.env.LABYRINTH_API_KEY } : {}),
        },
        body: JSON.stringify({
          source: 'channel_shield',
          messageId,
          filename: a.filename,
          contentType: a.contentType,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        degraded = true;
        flags.push(`sandbox_http_${res.status}:${a.filename}`);
        score = Math.max(score, 85);
        continue;
      }
      const data = (await res.json()) as { jobId?: string; verdict?: string; risk?: number };
      if (data.jobId) jobs.push(data.jobId);
      await reportShieldEvent({
        eventType: 'channel_shield.sandbox_submitted',
        severity: 'info',
        workspaceId: (await getMessage(messageId))!.workspaceId,
        channel: (await getMessage(messageId))!.channel,
        messageId,
        metadata: { jobId: data.jobId, filename: a.filename },
      });
      if (data.verdict === 'malicious' || (data.risk ?? 0) >= 80) {
        score = 100;
        flags.push(`sandbox_bad:${a.filename}`);
      }
    } catch {
      degraded = true;
      flags.push(`sandbox_error:${a.filename}`);
      score = Math.max(score, 85);
    }
  }
  return { score, flags, jobs, degraded };
}

export async function runShieldPipeline(messageId: string): Promise<ShieldVerdict> {
  const message = await getMessage(messageId);
  if (!message) throw new Error(`message not found: ${messageId}`);
  const protection = await getProtection(message.protectionId);
  if (!protection) throw new Error(`protection not found: ${message.protectionId}`);

  const envelope = message.envelope;
  const stageJson: Record<string, unknown> = { ...(message.stageJson ?? {}) };
  const flags: string[] = [];

  try {
    // A Parse
    stageJson.A = {
      ok: true,
      attachmentCount: envelope.attachments.length,
      linkCount: envelope.links.length,
      textLen: envelope.text.length,
    };
    await appendEvent(messageId, 'pipeline', 'stage_A_parse', stageJson.A as Record<string, unknown>);

    // B Identity
    const identity = scoreIdentity(envelope.authSignals ?? {});
    flags.push(...identity.flags);
    stageJson.B = identity;
    await appendEvent(messageId, 'pipeline', 'stage_B_identity', identity);

    // C URL intel
    const url = scoreUrls(envelope.links ?? [], envelope.text);
    flags.push(...url.flags);
    stageJson.C = url;
    await appendEvent(messageId, 'pipeline', 'stage_C_url', url);

    // D Static
    const staticScan = scoreStatic(envelope.attachments, envelope.text + (envelope.html ?? ''), protection.policy);
    flags.push(...staticScan.flags);
    stageJson.D = staticScan;
    await appendEvent(messageId, 'pipeline', 'stage_D_static', staticScan);

    // E Agent heuristics (redacted; no live malware forwarded to models in this path)
    const agent = scoreAgentHeuristics(envelope.text.slice(0, 4000), envelope.subject);
    flags.push(...agent.flags);
    stageJson.E = agent;
    await appendEvent(messageId, 'pipeline', 'stage_E_agent', agent);

    // F Sandbox
    const sandbox = await submitSandboxStub(
      messageId,
      envelope.attachments,
      protection.policy.sandboxFileTypes,
    );
    flags.push(...sandbox.flags);
    stageJson.F = sandbox;
    await appendEvent(messageId, 'pipeline', 'stage_F_sandbox', sandbox);

    if (sandbox.degraded && protection.policy.failClosedOnError && sandbox.flags.some((f) => f.startsWith('sandbox_'))) {
      // configured file types with no sandbox => treat as error path below via high score + fail closed
    }

    const stages: StageScores = {
      identity: identity.score,
      url: url.score,
      staticScan: staticScan.score,
      agent: agent.score,
      sandbox: sandbox.score,
      flags,
      error:
        sandbox.degraded &&
        protection.policy.failClosedOnError &&
        envelope.attachments.some((a) => protection.policy.sandboxFileTypes.includes(a.contentType))
          ? 'sandbox_degraded'
          : undefined,
    };

    const { verdict, riskScore } = combineVerdict(stages, protection.policy);
    stageJson.G = { verdict, riskScore, flags };
    await appendEvent(messageId, 'pipeline', 'stage_G_verdict', stageJson.G as Record<string, unknown>);

    const safeSummary = buildSafeSummary(message, verdict);
    await updateMessage(messageId, {
      verdict,
      riskScore,
      stageJson,
      safeSummaryText: safeSummary,
    });

    await reportShieldEvent({
      eventType: `channel_shield.verdict_${verdict}`,
      severity: verdict === 'clean' ? 'info' : verdict === 'suspect' ? 'warning' : 'critical',
      workspaceId: message.workspaceId,
      channel: message.channel,
      messageId,
      metadata: { riskScore, flags, protectionId: protection.id },
    });

    if (protection.mode === 'monitor') {
      // Monitor: always deliver live, still record verdict.
      await deliverCleanMessage(messageId);
      return verdict;
    }

    const killed = await isShieldDeliveryKilled(message.workspaceId, protection.id);
    if (killed) {
      await holdMessage(messageId, 'scout_kill');
      await notifySafeSummaryForMessage(messageId);
      return verdict;
    }

    const policyOk = await evaluateShieldDeliverPolicy(message.workspaceId, message.channel, verdict);
    if (!policyOk.allow) {
      await holdMessage(messageId, policyOk.reason ?? 'scout_policy');
      await notifySafeSummaryForMessage(messageId);
      return verdict;
    }

    if (shouldFailClosed(verdict, protection.policy) || verdict === 'malicious' || verdict === 'error') {
      await holdMessage(messageId, verdict);
      await notifySafeSummaryForMessage(messageId);
      return verdict;
    }

    if (verdict === 'suspect' && !protection.policy.autoReleaseSuspects) {
      await holdMessage(messageId, 'suspect');
      await notifySafeSummaryForMessage(messageId);
      return verdict;
    }

    await deliverCleanMessage(messageId);
    return verdict;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    stageJson.error = detail;
    await updateMessage(messageId, {
      verdict: 'error',
      riskScore: 100,
      stageJson,
      quarantineStatus: protection.policy.failClosedOnError ? 'held' : 'none',
    });
    await appendEvent(messageId, 'pipeline', 'error', { detail });
    await reportShieldEvent({
      eventType: 'channel_shield.verdict_error',
      severity: 'critical',
      workspaceId: message.workspaceId,
      channel: message.channel,
      messageId,
      metadata: { detail },
    });
    if (protection.policy.failClosedOnError) {
      await holdMessage(messageId, 'error');
      await notifySafeSummaryForMessage(messageId);
    }
    return 'error';
  }
}
