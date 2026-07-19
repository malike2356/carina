/**
 * Dispatch automation actions: Aiva prompt, playbook, connector, webhook.
 */

import { processAivaMessage } from './aiva-process-message.js';
import { readWorkerPlaybook } from './provision-worker-playbook.js';
import { startWorkerPlaybookRun } from './playbook-run-client.js';
import { getWorkerById, logActivity } from './worker-store.js';
import {
  actionNeedsApproval,
  parseAction,
  type AutomationAction,
  type AutomationActionType,
  type AutomationApprovalMode,
} from './automation-trigger-schema.js';
import { isSocialPostAutomation, createSocialPostDraft } from '../ingestion/social/social-post-draft-handler.js';

export interface DispatchResult {
  ok: boolean;
  awaitingApproval?: boolean;
  output?: string;
  usage?: Record<string, unknown>;
  error?: string;
  diagnostics?: Record<string, unknown>;
}

export async function dispatchAutomationAction(input: {
  workerId: string;
  workspaceId: string;
  automationId: string;
  automationName: string;
  automationDescription: string;
  actionType: AutomationActionType;
  action: AutomationAction | Record<string, unknown>;
  approvalMode: AutomationApprovalMode;
  payload?: Record<string, unknown>;
  alreadyApproved?: boolean;
}): Promise<DispatchResult> {
  const action = parseAction(input.action, input.automationDescription);
  const needsApproval = actionNeedsApproval(input.actionType, input.approvalMode)
    && !input.alreadyApproved;

  if (needsApproval) {
    return {
      ok: true,
      awaitingApproval: true,
      diagnostics: {
        reason: 'Risky unattended write requires approval',
        actionType: input.actionType,
      },
    };
  }

  try {
    if (action.type === 'aiva_prompt' || input.actionType === 'aiva_prompt') {
      const raw = input.action && typeof input.action === 'object'
        ? input.action as Record<string, unknown>
        : {};
      const deliverRaw = raw.deliver;
      const deliver = deliverRaw && typeof deliverRaw === 'object'
        ? {
          channel: String((deliverRaw as { channel?: unknown }).channel ?? ''),
          contactId: String(
            (deliverRaw as { contactId?: unknown }).contactId
              ?? (deliverRaw as { contact_id?: unknown }).contact_id
              ?? '',
          ),
        }
        : null;
      return await runAivaPrompt({
        workerId: input.workerId,
        workspaceId: input.workspaceId,
        automationId: input.automationId,
        automationName: input.automationName,
        automationDescription: input.automationDescription,
        prompt: action.type === 'aiva_prompt' ? action.prompt : input.automationDescription,
        payload: input.payload,
        deliver,
      });
    }

    if (action.type === 'playbook' || input.actionType === 'playbook') {
      const worker = await getWorkerById(input.workerId);
      if (!worker) return { ok: false, error: 'Worker not found' };
      const playbook = readWorkerPlaybook(worker.workerConfig);
      if (!playbook?.playbookId) {
        return { ok: false, error: 'No playbook configured on this worker' };
      }
      const run = await startWorkerPlaybookRun({
        workerId: input.workerId,
        workspaceId: input.workspaceId,
        playbook,
        trigger: 'schedule',
        initialState: { automation: input.payload ?? {}, playbookId: action.type === 'playbook' ? action.playbookId : undefined },
      });
      return {
        ok: true,
        output: run.runId,
        diagnostics: { playbookId: playbook.playbookId, runId: run.runId },
      };
    }

    if (action.type === 'webhook_call' || input.actionType === 'webhook_call') {
      if (action.type !== 'webhook_call' || !action.url) {
        return { ok: false, error: 'webhook_call requires url' };
      }
      if (!/^https:\/\//i.test(action.url)) {
        return { ok: false, error: 'webhook_call url must be https' };
      }
      const res = await fetch(action.url, {
        method: action.method ?? 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Carina-Automation': input.automationId },
        body: JSON.stringify({
          automationId: input.automationId,
          workerId: input.workerId,
          workspaceId: input.workspaceId,
          payload: input.payload ?? {},
          body: action.body ?? {},
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        return {
          ok: false,
          error: `Webhook HTTP ${res.status}`,
          diagnostics: { body: text.slice(0, 500) },
        };
      }
      return { ok: true, output: text.slice(0, 2000), diagnostics: { status: res.status } };
    }

    if (action.type === 'connector_action' || input.actionType === 'connector_action') {
      if (action.type !== 'connector_action' || !action.connector || !action.method) {
        return { ok: false, error: 'connector_action requires connector and method' };
      }
      // Connector writes are approval-gated above; record intent for operators.
      void logActivity(input.workerId, {
        actionType: 'automation_run',
        summary: `Connector action queued: ${action.connector}.${action.method}`,
        inputText: JSON.stringify(action.params ?? {}).slice(0, 500),
        outputText: 'recorded',
        escalated: true,
        channel: 'automation',
        contactId: input.automationId,
      }).catch(() => {});
      return {
        ok: true,
        output: `Connector ${action.connector}.${action.method} recorded for execution`,
        diagnostics: { connector: action.connector, method: action.method },
      };
    }

    return { ok: false, error: `Unsupported action type: ${input.actionType}` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      diagnostics: { stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined },
    };
  }
}

async function runAivaPrompt(input: {
  workerId: string;
  workspaceId: string;
  automationId: string;
  automationName: string;
  automationDescription: string;
  prompt: string;
  payload?: Record<string, unknown>;
  deliver?: { channel?: string; contactId?: string } | null;
}): Promise<DispatchResult> {
  const userMessage = input.payload && Object.keys(input.payload).length > 0
    ? `${input.prompt}\n\nEvent context:\n${JSON.stringify(input.payload).slice(0, 2000)}`
    : input.prompt;

  const deliverChannel = String(input.deliver?.channel ?? '').trim();
  const deliverContactId = String(input.deliver?.contactId ?? '').trim();
  const runAsChannel = (deliverChannel || 'web') as import('../channels/types.js').AivaChannelName;
  const runAsContact = deliverContactId || `auto-${input.automationId}`;

  // processAivaMessage enforces wallet / BYOK / usage limits.
  const reply = await processAivaMessage({
    workerId: input.workerId,
    workspaceId: input.workspaceId,
    userMessage,
    channel: runAsChannel,
    contactId: runAsContact,
  });

  const automationLike = {
    id: input.automationId,
    name: input.automationName,
    description: input.automationDescription,
  };
  if (isSocialPostAutomation(automationLike as never)) {
    await createSocialPostDraft({
      workerId: input.workerId,
      workspaceId: input.workspaceId,
      automationName: input.automationName,
      prompt: input.prompt,
      draftText: reply,
    });
    return {
      ok: true,
      output: reply,
      usage: { routed: 'social_draft_approval' },
      diagnostics: { approval: 'social_draft' },
    };
  }

  let delivered = false;
  let deliverError: string | undefined;
  if (deliverChannel && deliverContactId && deliverChannel !== 'web') {
    try {
      delivered = await deliverAutomationReply({
        workerId: input.workerId,
        channel: deliverChannel,
        contactId: deliverContactId,
        content: reply,
      });
    } catch (err) {
      deliverError = err instanceof Error ? err.message : String(err);
    }
  }

  void logActivity(input.workerId, {
    actionType: 'automation_run',
    summary: `Automation: ${input.automationName}`,
    inputText: userMessage,
    outputText: reply,
    escalated: false,
    channel: 'automation',
    contactId: input.automationId,
  }).catch(() => {});

  return {
    ok: true,
    output: reply,
    usage: { routed: 'aiva_prompt', delivered },
    diagnostics: deliverError ? { deliverError } : delivered ? { delivered: true } : undefined,
  };
}

async function deliverAutomationReply(input: {
  workerId: string;
  channel: string;
  contactId: string;
  content: string;
}): Promise<boolean> {
  const { listWorkerChannelDetails, readChannelCredentials } = await import('../channels/channel-store.js');
  const { getAdapter } = await import('../channels/adapter-registry.js');
  const channel = input.channel as import('../channels/types.js').AivaChannelName;
  const channels = await listWorkerChannelDetails(input.workerId);
  const row = channels.find((c) => c.channel === channel && c.enabled);
  if (!row) return false;
  const adapter = getAdapter(channel);
  if (!adapter) return false;
  const credentials = readChannelCredentials(row);
  const chunks = chunkTelegramText(input.content, 3500);
  for (const chunk of chunks) {
    await adapter.send(
      { channel, contactId: input.contactId, content: chunk },
      credentials,
    );
  }
  return true;
}

function chunkTelegramText(text: string, maxLen: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return ['(empty briefing)'];
  if (trimmed.length <= maxLen) return [trimmed];
  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n\n', maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
