import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { registerSessionTool } from './session-tool-store.js';
import { createWorkerAutomationTools } from './worker-automation.js';
import { createAivaChannelSelfConfigTool } from './aiva-channel-self-config.js';
import {
  createDocumentVaultTools,
  DOCUMENT_VAULT_TOOL_NAMES,
} from './document-vault-tools.js';
import {
  createWorkspaceDocument,
  createWorkspaceResearchJob,
  getWorkspaceInventory,
  getWorkspaceDocument,
  listWorkspaceDocuments,
  listWorkspaceResearchJobs,
} from '../workers/aiva-workspace-surfaces.js';
import * as vaultSurfaces from '../workers/aiva-vault-surfaces.js';
import {
  getApproval,
  listPendingApprovals,
  createEmailApproval,
} from '../ingestion/email/worker-approval-store.js';
import {
  rejectEmailApproval,
  sendApprovedEmail,
} from '../ingestion/email/email-draft-handler.js';
import {
  getWorker,
  listWorkerChannels,
  pauseWorker,
  resumeWorker,
  updateWorker,
} from '../workers/worker-store.js';
import type { EmailCategory } from '../ingestion/email/email-categorizer.js';

function requireWorkerCtx(sessionId: string) {
  const ctx = getWorkerSessionContext(sessionId);
  if (!ctx) {
    return {
      ok: false as const,
      error: 'No active Aiva worker session. Open this Aiva chat and try again.',
    };
  }
  return { ok: true as const, ctx };
}

async function runAutomationAction(
  sessionId: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const tools = createWorkerAutomationTools(sessionId);
  const tool = tools.find((t) => t.name === 'worker-automation');
  if (!tool) return { ok: false, error: 'worker-automation unavailable' };
  return tool.execute(params);
}

export function createAivaWorkspaceTools(sessionId: string): Tool[] {
  const channelConnect = createAivaChannelSelfConfigTool(sessionId);

  const inventory: Tool = {
    name: 'workspace-inventory',
    description:
      'Summarise what is in this workspace (Aivas, channels, automations, approvals, notes/docs counts). '
      + 'Use first when the user asks what you can see or whether you have full workspace access.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max items per section (default 10)' },
      },
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const result = await getWorkspaceInventory({
        workspaceId: gate.ctx.worker.workspaceId,
        workerId: gate.ctx.worker.id,
        limit: params.limit != null ? Number(params.limit) : 10,
      });
      if (!result.ok) return { ok: false, error: result.error ?? 'inventory failed' };
      return { ok: true, data: result.data };
    },
  };

  const researchCreate: Tool = {
    name: 'workspace-research-create',
    description:
      'Start a deep research job saved to the Aiva Research page. '
      + 'Use when the user wants research saved in the workspace (not just a chat answer).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research question or topic' },
        mode: { type: 'string', description: 'Optional research mode' },
        rounds: { type: 'number', description: 'Optional research rounds' },
      },
      required: ['query'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const query = String(params.query ?? '').trim();
      if (!query) return { ok: false, error: 'query required' };
      const result = await createWorkspaceResearchJob({
        workspaceId: gate.ctx.worker.workspaceId,
        query,
        mode: typeof params.mode === 'string' ? params.mode : undefined,
        rounds: params.rounds != null ? Number(params.rounds) : undefined,
      });
      if (!result.ok) return { ok: false, error: result.error ?? 'research create failed' };
      return { ok: true, data: result.data, openUrl: result.openUrl };
    },
  };

  const researchList: Tool = {
    name: 'workspace-research-list',
    description: 'List recent research jobs on the Aiva Research page for this workspace.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const result = await listWorkspaceResearchJobs({
        workspaceId: gate.ctx.worker.workspaceId,
        limit: params.limit != null ? Number(params.limit) : 10,
      });
      if (!result.ok) return { ok: false, error: result.error ?? 'research list failed' };
      return { ok: true, data: result.data };
    },
  };

  const documentCreate: Tool = {
    name: 'workspace-document-create',
    description:
      'Legacy alias: create a file in the Document Vault. Prefer vault-create-file. '
      + 'Creates under the trusted workspace Documents vault.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        format: { type: 'string', enum: ['markdown', 'plain'] },
      },
      required: ['title', 'content'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const title = String(params.title ?? '').trim() || 'Untitled';
      const content = String(params.content ?? '');
      if (!content.trim()) return { ok: false, error: 'content required' };
      const kind = String(params.format ?? 'markdown') === 'plain' ? 'plain_text' : 'markdown';
      const vault = await vaultSurfaces.vaultCreate({
        workspaceId: gate.ctx.worker.workspaceId,
        kind,
        name: title,
        content,
        actorId: gate.ctx.worker.id,
      });
      if (vault.ok) {
        return { ok: true, data: vault.data, openUrl: '/documents', status: 'created', migratedTo: 'vault-create-file' };
      }
      // Compatibility fallback to legacy documents table when vault API is unavailable.
      const format = kind === 'plain_text' ? 'plain' : 'markdown';
      const result = await createWorkspaceDocument({
        workspaceId: gate.ctx.worker.workspaceId,
        title,
        content,
        format,
      });
      if (!result.ok) {
        return {
          ok: false,
          error: result.error ?? vault.error ?? 'document create failed',
          hint: 'Use vault-create-file when Document Vault tools are available.',
        };
      }
      return { ok: true, data: result.data, openUrl: result.openUrl, status: 'created', migratedTo: 'vault-create-file' };
    },
  };

  const documentList: Tool = {
    name: 'workspace-document-list',
    description:
      'Legacy alias: list Document Vault items. Prefer vault-list / vault-search. '
      + 'Returns titles and short previews only (not full bodies).',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const limit = params.limit != null ? Number(params.limit) : 50;
      const vault = await vaultSurfaces.vaultList({
        workspaceId: gate.ctx.worker.workspaceId,
        q: '',
        limit,
      });
      if (vault.ok) {
        const payload = vault.data as { items?: Array<Record<string, unknown>> } | unknown[];
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { items?: unknown[] })?.items)
            ? ((payload as { items: Array<Record<string, unknown>> }).items)
            : [];
        const documents = rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
          id: r.id,
          title: r.name ?? r.title,
          preview: '',
          chars: typeof r.byteSize === 'number' ? r.byteSize : 0,
          kind: r.kind,
          currentRevision: r.currentRevision,
          updatedAt: r.updatedAt,
        };
        });
        return { ok: true, count: documents.length, documents, migratedTo: 'vault-list' };
      }
      const result = await listWorkspaceDocuments({
        workspaceId: gate.ctx.worker.workspaceId,
        limit,
      });
      if (!result.ok) {
        return {
          ok: false,
          error: result.error ?? vault.error ?? 'document list failed',
          hint: 'Use vault-list when Document Vault tools are available.',
        };
      }
      const rows = Array.isArray(result.data) ? result.data : [];
      const documents = rows.map((row) => {
        const r = row as Record<string, unknown>;
        const content = typeof r.content === 'string' ? r.content : '';
        const previewRaw = typeof r.preview === 'string' ? r.preview : content;
        const plain = String(previewRaw)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const chars =
          typeof r.chars === 'number'
            ? r.chars
            : typeof r.contentLength === 'number'
              ? r.contentLength
              : content.length;
        return {
          id: r.id,
          title: r.title,
          preview: plain.slice(0, 160),
          chars,
          updatedAt: r.updatedAt,
        };
      });
      return { ok: true, count: documents.length, documents, migratedTo: 'vault-list' };
    },
  };

  const documentGet: Tool = {
    name: 'workspace-document-get',
    description:
      'Legacy alias: read a Document Vault item. Prefer vault-read / vault-inspect. '
      + 'Pass an id from workspace-document-list or vault-list.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Document id from workspace-document-list or vault-list' },
      },
      required: ['id'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const id = String(params.id ?? '').trim();
      if (!id) return { ok: false, error: 'id required' };
      const vault = await vaultSurfaces.vaultRead({
        workspaceId: gate.ctx.worker.workspaceId,
        id,
      });
      if (vault.ok) {
        return { ok: true, data: vault.data, migratedTo: 'vault-read' };
      }
      const result = await getWorkspaceDocument({
        workspaceId: gate.ctx.worker.workspaceId,
        id,
      });
      if (!result.ok) {
        return {
          ok: false,
          error: result.error ?? vault.error ?? 'document get failed',
          hint: 'Use vault-read when Document Vault tools are available.',
        };
      }
      return { ok: true, data: result.data, migratedTo: 'vault-read' };
    },
  };

  const scheduleList: Tool = {
    name: 'workspace-schedule-list',
    description: 'List this Aiva\'s scheduled automations (same as worker-automation action=list).',
    parameters: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['worker', 'workspace'] },
      },
    },
    execute: async (params) => runAutomationAction(sessionId, {
      action: 'list',
      scope: params.scope,
    }),
  };

  const scheduleCreate: Tool = {
    name: 'workspace-schedule-create',
    dangerous: true,
    description:
      'Create a recurring automation for this Aiva (alias of worker-automation create). '
      + 'Prefer worker-automation when both are available.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        prompt: { type: 'string' },
        schedule_text: { type: 'string' },
        hour: { type: 'number' },
        minute: { type: 'number' },
        timezone: { type: 'string' },
        city: { type: 'string' },
        country: { type: 'string' },
        email_limit: { type: 'number' },
        deliver_channel: { type: 'string' },
        deliver_contact_id: { type: 'string' },
      },
    },
    execute: async (params) => runAutomationAction(sessionId, { ...params, action: 'create' }),
  };

  const scheduleUpdate: Tool = {
    name: 'workspace-schedule-update',
    dangerous: true,
    description: 'Update/recreate schedule settings via worker-automation (use remove+create or pause/resume as needed).',
    parameters: {
      type: 'object',
      properties: {
        automation_id: { type: 'string' },
        action: { type: 'string', enum: ['pause', 'resume', 'remove', 'test'] },
      },
      required: ['automation_id', 'action'],
    },
    execute: async (params) => runAutomationAction(sessionId, {
      action: String(params.action ?? 'test'),
      automation_id: params.automation_id,
    }),
  };

  const schedulePause: Tool = {
    name: 'workspace-schedule-pause',
    dangerous: true,
    description: 'Pause a worker automation by id.',
    parameters: {
      type: 'object',
      properties: { automation_id: { type: 'string' } },
      required: ['automation_id'],
    },
    execute: async (params) => runAutomationAction(sessionId, {
      action: 'pause',
      automation_id: params.automation_id,
    }),
  };

  const scheduleResume: Tool = {
    name: 'workspace-schedule-resume',
    dangerous: true,
    description: 'Resume a paused worker automation by id.',
    parameters: {
      type: 'object',
      properties: { automation_id: { type: 'string' } },
      required: ['automation_id'],
    },
    execute: async (params) => runAutomationAction(sessionId, {
      action: 'resume',
      automation_id: params.automation_id,
    }),
  };

  const scheduleDelete: Tool = {
    name: 'workspace-schedule-delete',
    dangerous: true,
    description: 'Delete a worker automation by id.',
    parameters: {
      type: 'object',
      properties: { automation_id: { type: 'string' } },
      required: ['automation_id'],
    },
    execute: async (params) => runAutomationAction(sessionId, {
      action: 'remove',
      automation_id: params.automation_id,
    }),
  };

  const scheduleRunNow: Tool = {
    name: 'workspace-schedule-run-now',
    dangerous: true,
    description: 'Run a worker automation once now (test).',
    parameters: {
      type: 'object',
      properties: { automation_id: { type: 'string' } },
    },
    execute: async (params) => runAutomationAction(sessionId, {
      action: 'test',
      automation_id: params.automation_id ?? 'all',
    }),
  };

  const approvalList: Tool = {
    name: 'workspace-approval-list',
    description: 'List pending email/draft approvals for this workspace (/aiva/approvals).',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const limit = Math.min(50, Math.max(1, Number(params.limit ?? 20)));
      const approvals = await listPendingApprovals(gate.ctx.worker.workspaceId, limit);
      return {
        ok: true,
        count: approvals.length,
        approvals: approvals.map((a) => ({
          id: a.id,
          workerId: a.workerId,
          recipient: a.recipient,
          subject: a.subject,
          draftPreview: a.draftBody.slice(0, 400),
          category: a.category,
          requestedAt: a.requestedAt.toISOString(),
        })),
      };
    },
  };

  const approvalGet: Tool = {
    name: 'workspace-approval-get',
    description: 'Get one pending or recent approval by id.',
    parameters: {
      type: 'object',
      properties: { approval_id: { type: 'string' } },
      required: ['approval_id'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const id = String(params.approval_id ?? params.id ?? '').trim();
      if (!id) return { ok: false, error: 'approval_id required' };
      const approval = await getApproval(gate.ctx.worker.workspaceId, id);
      if (!approval) return { ok: false, error: 'approval not found' };
      return { ok: true, approval };
    },
  };

  const approvalCreate: Tool = {
    name: 'workspace-approval-create',
    description:
      'Queue an email draft for owner approval (does not send). Prefer workspace-email-draft-for-approval when available.',
    parameters: {
      type: 'object',
      properties: {
        recipient: { type: 'string' },
        subject: { type: 'string' },
        draft_body: { type: 'string' },
        category: { type: 'string' },
        original_from: { type: 'string' },
        message_id: { type: 'string' },
      },
      required: ['recipient', 'subject', 'draft_body'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const recipient = String(params.recipient ?? '').trim();
      const subject = String(params.subject ?? '').trim();
      const draftBody = String(params.draft_body ?? params.draftBody ?? '').trim();
      if (!recipient || !subject || !draftBody) {
        return { ok: false, error: 'recipient, subject, and draft_body required' };
      }
      const categoryRaw = String(params.category ?? 'other').trim();
      const allowed: EmailCategory[] = ['client_query', 'invoice', 'spam', 'urgent', 'other'];
      const category = (allowed.includes(categoryRaw as EmailCategory)
        ? categoryRaw
        : 'other') as EmailCategory;
      const approval = await createEmailApproval({
        workerId: gate.ctx.worker.id,
        workspaceId: gate.ctx.worker.workspaceId,
        category,
        recipient,
        subject,
        draftBody,
        originalFrom: String(params.original_from ?? params.originalFrom ?? recipient).trim(),
        messageId: String(params.message_id ?? params.messageId ?? '').trim() || undefined,
      });
      return {
        ok: true,
        approvalId: approval.id,
        status: approval.status,
        note: 'Queued at /aiva/approvals. Not sent yet.',
      };
    },
  };

  const approvalApprove: Tool = {
    name: 'workspace-approval-approve',
    dangerous: true,
    requiresConfirmation: true,
    description:
      'Approve a pending email draft and send it. Only use when the owner clearly asks to approve/send.',
    parameters: {
      type: 'object',
      properties: {
        approval_id: { type: 'string' },
        modified_body: { type: 'string' },
      },
      required: ['approval_id'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const approvalId = String(params.approval_id ?? params.id ?? '').trim();
      if (!approvalId) return { ok: false, error: 'approval_id required' };
      const result = await sendApprovedEmail({
        workspaceId: gate.ctx.worker.workspaceId,
        approvalId,
        reviewedBy: `worker:${gate.ctx.worker.id}`,
        modifiedBody: typeof params.modified_body === 'string'
          ? params.modified_body
          : typeof params.modifiedBody === 'string'
            ? params.modifiedBody
            : undefined,
      });
      if (!result) return { ok: false, error: 'approval not found or already resolved' };
      return { ok: true, approval: result };
    },
  };

  const approvalReject: Tool = {
    name: 'workspace-approval-reject',
    dangerous: true,
    requiresConfirmation: true,
    description: 'Reject a pending email draft. Only when the owner clearly asks to reject.',
    parameters: {
      type: 'object',
      properties: { approval_id: { type: 'string' } },
      required: ['approval_id'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const approvalId = String(params.approval_id ?? params.id ?? '').trim();
      if (!approvalId) return { ok: false, error: 'approval_id required' };
      const result = await rejectEmailApproval({
        workspaceId: gate.ctx.worker.workspaceId,
        approvalId,
        reviewedBy: `worker:${gate.ctx.worker.id}`,
      });
      if (!result) return { ok: false, error: 'approval not found or already resolved' };
      return { ok: true, approval: result };
    },
  };

  const approvalModify: Tool = {
    name: 'workspace-approval-modify',
    dangerous: true,
    requiresConfirmation: true,
    description: 'Approve with a modified draft body (sends the modified text).',
    parameters: {
      type: 'object',
      properties: {
        approval_id: { type: 'string' },
        modified_body: { type: 'string' },
      },
      required: ['approval_id', 'modified_body'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const approvalId = String(params.approval_id ?? '').trim();
      const modifiedBody = String(params.modified_body ?? params.modifiedBody ?? '');
      if (!approvalId || !modifiedBody.trim()) {
        return { ok: false, error: 'approval_id and modified_body required' };
      }
      const result = await sendApprovedEmail({
        workspaceId: gate.ctx.worker.workspaceId,
        approvalId,
        reviewedBy: `worker:${gate.ctx.worker.id}`,
        modifiedBody,
      });
      if (!result) return { ok: false, error: 'approval not found or already resolved' };
      return { ok: true, approval: result };
    },
  };

  const channelList: Tool = {
    name: 'workspace-channel-list',
    description: 'List messaging channels connected to this Aiva (no secrets).',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const channels = await listWorkerChannels(gate.ctx.worker.id);
      return {
        ok: true,
        channels: channels.map((c) => ({
          id: c.id,
          channel: c.channel,
          identifier: c.identifier,
        })),
      };
    },
  };

  const channelStatus: Tool = {
    name: 'workspace-channel-status',
    description: 'Show this Aiva\'s status and connected channels (no secrets).',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const worker = await getWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id);
      const channels = await listWorkerChannels(gate.ctx.worker.id);
      return {
        ok: true,
        worker: worker
          ? {
              id: worker.id,
              name: worker.name,
              status: worker.status,
              skillPacks: worker.skillPacks,
            }
          : null,
        channels: channels.map((c) => ({
          id: c.id,
          channel: c.channel,
          identifier: c.identifier,
        })),
      };
    },
  };

  const channelConnectAlias: Tool = {
    name: 'workspace-channel-connect',
    description:
      'Connect Telegram for this Aiva using a BotFather token (alias of aiva-channel-connect). '
      + 'Never echo the token.',
    parameters: channelConnect.parameters,
    execute: (params) => channelConnect.execute(params),
  };

  const channelDisconnect: Tool = {
    name: 'workspace-channel-disconnect',
    dangerous: true,
    requiresConfirmation: true,
    description:
      'Disconnect is not available from chat for safety. Use the Aiva Channels tab in the web UI.',
    parameters: {
      type: 'object',
      properties: { channel: { type: 'string' } },
    },
    execute: async () => ({
      ok: false,
      error: 'Channel disconnect is web-UI only to avoid breaking live Telegram/voice. Use Channels in admin.hireaiva.co.uk.',
    }),
  };

  const channelTest: Tool = {
    name: 'workspace-channel-test',
    description: 'Report connected channel status for this Aiva (read-only health check).',
    parameters: { type: 'object', properties: {} },
    execute: async () => channelStatus.execute({}),
  };

  const workerGet: Tool = {
    name: 'workspace-worker-get',
    description: 'Get this Aiva\'s profile (name, status, skill packs). Self only.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const worker = await getWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id);
      if (!worker) return { ok: false, error: 'worker not found' };
      return {
        ok: true,
        worker: {
          id: worker.id,
          name: worker.name,
          status: worker.status,
          roleDescription: worker.roleDescription,
          language: worker.language,
          skillPacks: worker.skillPacks,
        },
      };
    },
  };

  const workerUpdate: Tool = {
    name: 'workspace-worker-update',
    dangerous: true,
    description:
      'Update this Aiva\'s soft settings (name, role description, language, persona). Self only. '
      + 'Does not change billing, hire/dismiss, or OAuth.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        role_description: { type: 'string' },
        language: { type: 'string' },
        persona_prompt: { type: 'string' },
      },
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const patch: Parameters<typeof updateWorker>[2] = {};
      if (typeof params.name === 'string' && params.name.trim()) patch.name = params.name.trim();
      if (typeof params.role_description === 'string') patch.roleDescription = params.role_description;
      if (typeof params.language === 'string' && params.language.trim()) patch.language = params.language.trim();
      if (typeof params.persona_prompt === 'string') patch.personaPrompt = params.persona_prompt;
      if (Object.keys(patch).length === 0) return { ok: false, error: 'No updatable fields provided' };
      const worker = await updateWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id, patch);
      return { ok: true, worker: { id: worker.id, name: worker.name, status: worker.status } };
    },
  };

  const workerPause: Tool = {
    name: 'workspace-worker-pause',
    dangerous: true,
    requiresConfirmation: true,
    description: 'Pause this Aiva (self). Owner must clearly ask to pause.',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      await pauseWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id);
      return { ok: true, status: 'paused' };
    },
  };

  const workerResume: Tool = {
    name: 'workspace-worker-resume',
    dangerous: true,
    description: 'Resume this Aiva if paused (self).',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      await resumeWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id);
      return { ok: true, status: 'active' };
    },
  };

  const workerSkillEnable: Tool = {
    name: 'workspace-worker-skill-enable',
    dangerous: true,
    description: 'Enable a skill pack on this Aiva (self).',
    parameters: {
      type: 'object',
      properties: { skill_pack: { type: 'string' } },
      required: ['skill_pack'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const pack = String(params.skill_pack ?? params.skillPack ?? '').trim();
      if (!pack) return { ok: false, error: 'skill_pack required' };
      const worker = await getWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id);
      if (!worker) return { ok: false, error: 'worker not found' };
      const packs = Array.from(new Set([...worker.skillPacks, pack]));
      const updated = await updateWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id, {
        skillPacks: packs,
      });
      return { ok: true, skillPacks: updated.skillPacks };
    },
  };

  const workerSkillDisable: Tool = {
    name: 'workspace-worker-skill-disable',
    dangerous: true,
    description: 'Disable a skill pack on this Aiva (self).',
    parameters: {
      type: 'object',
      properties: { skill_pack: { type: 'string' } },
      required: ['skill_pack'],
    },
    execute: async (params) => {
      const gate = requireWorkerCtx(sessionId);
      if (!gate.ok) return gate;
      const pack = String(params.skill_pack ?? params.skillPack ?? '').trim();
      if (!pack) return { ok: false, error: 'skill_pack required' };
      const worker = await getWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id);
      if (!worker) return { ok: false, error: 'worker not found' };
      const packs = worker.skillPacks.filter((p) => p !== pack);
      const updated = await updateWorker(gate.ctx.worker.workspaceId, gate.ctx.worker.id, {
        skillPacks: packs,
      });
      return { ok: true, skillPacks: updated.skillPacks };
    },
  };

  const workerVoice: Tool = {
    name: 'workspace-worker-voice-settings-update',
    description:
      'Voice/Twilio settings stay in the Channels UI for safety. This tool only explains how to change them.',
    parameters: {
      type: 'object',
      properties: { note: { type: 'string' } },
    },
    execute: async () => ({
      ok: false,
      error:
        'Voice credential changes are web-UI only (Channels → Voice) so Telegram/Twilio keep working. '
        + 'Ask the owner to update them in admin.hireaiva.co.uk.',
    }),
  };

  const workerScout: Tool = {
    name: 'workspace-worker-scout-mode-update',
    description: 'Scout mode changes are admin-only. Do not change Scout from chat.',
    parameters: {
      type: 'object',
      properties: { mode: { type: 'string' } },
    },
    execute: async () => ({
      ok: false,
      error: 'Scout mode is controlled in the Scout/oversight UI, not from Telegram chat.',
    }),
  };

  return [
    inventory,
    researchCreate,
    researchList,
    documentCreate,
    documentList,
    documentGet,
    scheduleList,
    scheduleCreate,
    scheduleUpdate,
    schedulePause,
    scheduleResume,
    scheduleDelete,
    scheduleRunNow,
    approvalList,
    approvalGet,
    approvalCreate,
    approvalApprove,
    approvalReject,
    approvalModify,
    channelList,
    channelStatus,
    channelConnectAlias,
    channelDisconnect,
    channelTest,
    workerGet,
    workerUpdate,
    workerPause,
    workerResume,
    workerSkillEnable,
    workerSkillDisable,
    workerVoice,
    workerScout,
  ];
}

export function registerAivaWorkspaceSessionTools(sessionId: string): string[] {
  const names: string[] = [];
  for (const tool of createAivaWorkspaceTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    names.push(tool.name);
  }
  for (const tool of createDocumentVaultTools(sessionId)) {
    registerSessionTool(sessionId, tool);
    names.push(tool.name);
  }
  return names;
}

export { DOCUMENT_VAULT_TOOL_NAMES };
