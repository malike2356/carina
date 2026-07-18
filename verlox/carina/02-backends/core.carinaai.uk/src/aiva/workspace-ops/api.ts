import {
  Router,
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from 'express';
import { requireCloudProxy } from '../../gateway/cloud-proxy-auth.js';
import { requireBusinessPlan } from '../../billing/aiva-plan-middleware.js';
import { isAiWorkersEnabled } from '../../workers/aiva-message-handler.js';
import { getWorker } from '../../workers/worker-store.js';
import {
  deleteKnowledgeEntry,
  getKnowledgeEntry,
  insertKnowledgeDocument,
  listKnowledgeSummaries,
  OPS_KNOWLEDGE_WRITE,
  updateKnowledgeDocument,
} from '../../workers/knowledge-base.js';
import { bootstrapWorkspaceOps } from './bootstrap.js';
import { browseOpsFolder } from './browse.js';
import {
  captureAttendance,
  captureFunderMonth,
  captureMinutes,
  captureNextMeeting,
} from './capture.js';
import {
  enqueueOpsReminderHook,
  installOpsReminderAutomations,
  OPS_REMINDER_TEMPLATES,
} from './reminders.js';
import { registerWorkspaceOpsSyncJobs } from './scheduler.js';
import {
  getBinding,
  getMappingByDocument,
  latestSyncRun,
  listFolders,
  listMappings,
  markMappingDeleted,
} from './store.js';
import { markDocumentPendingAndPush, pushDocumentToDrive, runWorkspaceOpsSync, claimDriveFileIntoAiva } from './sync-engine.js';
import { isOpsCategory, packProfileFromBindingMeta, type SyncDirection } from './types.js';

export const workspaceOpsRouter: ExpressRouter = Router();
workspaceOpsRouter.use(requireCloudProxy);

type OpsReq = Request & { workspaceId?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveWorkspaceId(req: OpsReq): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromQuery = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const fromBody = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : '';
  return (fromHeader ?? fromBody ?? fromQuery)?.trim() || null;
}

function requireWorkspace(req: OpsReq, res: Response, next: NextFunction): void {
  if (!isAiWorkersEnabled()) {
    res.status(503).json({ error: 'Aiva is disabled' });
    return;
  }
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId || !UUID_RE.test(workspaceId)) {
    res.status(400).json({ error: 'Valid workspaceId is required' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
}

function workerIdFrom(req: OpsReq): string {
  return String(req.body?.workerId ?? req.query.workerId ?? '').trim();
}

async function requireWorker(req: OpsReq, res: Response): Promise<string | null> {
  const workerId = workerIdFrom(req);
  if (!UUID_RE.test(workerId)) {
    res.status(400).json({ error: 'workerId is required' });
    return null;
  }
  const worker = await getWorker(req.workspaceId!, workerId);
  if (!worker) {
    res.status(404).json({ error: 'Worker not found' });
    return null;
  }
  return workerId;
}

workspaceOpsRouter.post(
  '/bootstrap',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const orgName = String(req.body?.orgName ?? '').trim();
      const result = await bootstrapWorkspaceOps({
        workspaceId: req.workspaceId!,
        workerId,
        orgName,
        pollMinutes: Number(req.body?.pollMinutes ?? 10) || 10,
        seedTemplates: req.body?.seedTemplates === true ? true : req.body?.seedTemplates === false ? false : undefined,
        packProfile: req.body?.packProfile,
      });
      await registerWorkspaceOpsSyncJobs();
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.post(
  '/sync',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const directionRaw = String(req.body?.direction ?? 'both');
      const direction = (['pull', 'push', 'both'].includes(directionRaw)
        ? directionRaw
        : 'both') as SyncDirection;
      const result = await runWorkspaceOpsSync({
        workspaceId: req.workspaceId!,
        workerId,
        direction,
      });
      res.status(result.error ? 502 : 200).json({ ok: !result.error, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.get(
  '/status',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const binding = await getBinding(req.workspaceId!, workerId);
      if (!binding) {
        res.json({ bootstrapped: false });
        return;
      }
      const folders = await listFolders(binding.id);
      const mappings = await listMappings(binding.id);
      const lastRun = await latestSyncRun(binding.id);
      res.json({
        bootstrapped: Boolean(binding.rootFolderId),
        binding,
        packProfile: packProfileFromBindingMeta(binding.meta),
        folders,
        mappingCount: mappings.length,
        lastRun,
        reminders: OPS_REMINDER_TEMPLATES.map((t) => ({
          key: t.key,
          name: t.name,
          scheduleLabel: t.scheduleLabel,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.get(
  '/mappings',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const binding = await getBinding(req.workspaceId!, workerId);
      if (!binding) {
        res.json({ mappings: [] });
        return;
      }
      const mappings = await listMappings(binding.id);
      res.json({ mappings });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.get(
  '/browse',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const folderId =
        typeof req.query.folderId === 'string' ? req.query.folderId.trim() : undefined;
      const pageToken =
        typeof req.query.pageToken === 'string' ? req.query.pageToken.trim() : undefined;
      const result = await browseOpsFolder({
        workspaceId: req.workspaceId!,
        workerId,
        folderId: folderId || undefined,
        pageToken: pageToken || undefined,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status =
        /outside the Ops|not bootstrapped/i.test(message)
          ? 400
          : /token|oauth|Drive/i.test(message)
            ? 502
            : 400;
      res.status(status).json({ error: message });
    }
  },
);

workspaceOpsRouter.get(
  '/documents',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const binding = await getBinding(req.workspaceId!, workerId);
      const summaries = await listKnowledgeSummaries(workerId);
      const mappings = binding ? await listMappings(binding.id) : [];
      const byDoc = new Map(mappings.filter((m) => m.aivaDocumentId).map((m) => [m.aivaDocumentId!, m]));
      const documents = summaries
        .filter((s) => s.type === 'document')
        .map((s) => {
          const m = byDoc.get(s.id);
          return {
            ...s,
            category: m?.category ?? 'inbox',
            syncStatus: m?.syncStatus ?? 'pending',
            driveFileId: m?.driveFileId ?? null,
            driveWebViewLink: m?.driveWebViewLink || null,
            indexable: m?.indexable ?? true,
          };
        });
      res.json({ documents, binding: binding ?? null });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.post(
  '/documents',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const title = String(req.body?.title ?? 'Document').trim();
      const content = String(req.body?.content ?? '');
      const categoryRaw = String(req.body?.category ?? 'inbox');
      const category = isOpsCategory(categoryRaw) ? categoryRaw : 'inbox';
      const doc = await insertKnowledgeDocument({
        workerId,
        workspaceId: req.workspaceId!,
        title,
        content,
        ...OPS_KNOWLEDGE_WRITE,
      });
      await markDocumentPendingAndPush({
        workspaceId: req.workspaceId!,
        workerId,
        documentId: doc.id,
        category,
      });
      res.status(201).json({ document: doc });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.post(
  '/documents/claim',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const driveFileId = String(req.body?.driveFileId ?? '').trim();
      if (!driveFileId) {
        res.status(400).json({ error: 'driveFileId is required' });
        return;
      }
      const claimed = await claimDriveFileIntoAiva({
        workspaceId: req.workspaceId!,
        workerId,
        driveFileId,
      });
      res.status(201).json({ ok: true, ...claimed });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.patch(
  '/documents/:documentId',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const documentId = String(req.params.documentId ?? '');
      const doc = await updateKnowledgeDocument({
        workerId,
        entryId: documentId,
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        content: typeof req.body?.content === 'string' ? req.body.content : undefined,
        ...OPS_KNOWLEDGE_WRITE,
      });
      const categoryRaw = typeof req.body?.category === 'string' ? req.body.category : undefined;
      await markDocumentPendingAndPush({
        workspaceId: req.workspaceId!,
        workerId,
        documentId: doc.id,
        category: categoryRaw && isOpsCategory(categoryRaw) ? categoryRaw : undefined,
      });
      res.json({ document: doc });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.delete(
  '/documents/:documentId',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const documentId = String(req.params.documentId ?? '');
      const binding = await getBinding(req.workspaceId!, workerId);
      if (binding) {
        await pushDocumentToDrive({ binding, documentId, trash: true });
      }
      await deleteKnowledgeEntry(workerId, documentId);
      const mapping = await getMappingByDocument(documentId);
      if (mapping) await markMappingDeleted(mapping.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.get(
  '/documents/:documentId',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const documentId = String(req.params.documentId ?? '');
      const entry = await getKnowledgeEntry(workerId, documentId);
      if (!entry) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      const mapping = await getMappingByDocument(documentId);
      res.json({ document: entry, mapping });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

function captureHandler(
  fn: (args: {
    workspaceId: string;
    workerId: string;
    body: Record<string, unknown>;
  }) => Promise<unknown>,
) {
  return async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const document = await fn({
        workspaceId: req.workspaceId!,
        workerId,
        body: (req.body ?? {}) as Record<string, unknown>,
      });
      res.status(201).json({ document });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  };
}

workspaceOpsRouter.post(
  '/minutes',
  requireWorkspace,
  requireBusinessPlan,
  captureHandler(async ({ workspaceId, workerId, body }) =>
    captureMinutes({
      workspaceId,
      workerId,
      date: String(body.date ?? new Date().toISOString().slice(0, 10)),
      title: String(body.title ?? ''),
      bullets: Array.isArray(body.bullets)
        ? body.bullets.map((b) => String(b))
        : String(body.notes ?? '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
    }),
  ),
);

workspaceOpsRouter.post(
  '/attendance',
  requireWorkspace,
  requireBusinessPlan,
  captureHandler(async ({ workspaceId, workerId, body }) =>
    captureAttendance({
      workspaceId,
      workerId,
      meetingDate: String(body.meetingDate ?? body.date ?? ''),
      sessionTitle: String(body.sessionTitle ?? body.title ?? ''),
      venueOrSessionType: String(body.venueOrSessionType ?? body.venue ?? ''),
      present: Array.isArray(body.present)
        ? body.present.map((n) => String(n))
        : String(body.present ?? '')
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
      apologies: Array.isArray(body.apologies)
        ? body.apologies.map((n) => String(n))
        : String(body.apologies ?? '')
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
    }),
  ),
);

workspaceOpsRouter.post(
  '/next-meeting',
  requireWorkspace,
  requireBusinessPlan,
  captureHandler(async ({ workspaceId, workerId, body }) =>
    captureNextMeeting({
      workspaceId,
      workerId,
      when: String(body.when ?? ''),
      invitees: Array.isArray(body.invitees)
        ? body.invitees.map((n) => String(n))
        : String(body.invitees ?? '')
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
      agenda: Array.isArray(body.agenda)
        ? body.agenda.map((n) => String(n))
        : String(body.agenda ?? '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
    }),
  ),
);

function linesFromBody(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

workspaceOpsRouter.post(
  '/funder-month',
  requireWorkspace,
  requireBusinessPlan,
  captureHandler(async ({ workspaceId, workerId, body }) =>
    captureFunderMonth({
      workspaceId,
      workerId,
      month: String(body.month ?? ''),
      count: body.count == null || body.count === '' ? null : Number(body.count),
      sessionsHeldCount:
        body.sessionsHeldCount == null || body.sessionsHeldCount === ''
          ? null
          : Number(body.sessionsHeldCount),
      bullets: linesFromBody(body.bullets),
      postersComms: linesFromBody(body.postersComms),
      outcomesQuotes: linesFromBody(body.outcomesQuotes),
    }),
  ),
);

workspaceOpsRouter.post(
  '/reminders/install',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const keys = Array.isArray(req.body?.keys)
        ? (req.body.keys as string[])
        : undefined;
      const result = await installOpsReminderAutomations({
        workspaceId: req.workspaceId!,
        workerId,
        keys: keys as never,
      });
      res.status(201).json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);

workspaceOpsRouter.post(
  '/hooks/reminder',
  requireWorkspace,
  requireBusinessPlan,
  async (req: OpsReq, res: Response) => {
    try {
      const workerId = await requireWorker(req, res);
      if (!workerId) return;
      const result = await enqueueOpsReminderHook({
        workspaceId: req.workspaceId!,
        workerId,
        reminderKey: req.body?.reminderKey,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  },
);
