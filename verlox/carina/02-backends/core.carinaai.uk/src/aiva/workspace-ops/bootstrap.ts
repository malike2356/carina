import { getWorker } from '../../workers/worker-store.js';
import {
  createDriveFolder,
  createGoogleDoc,
  resolveWorkerDriveToken,
} from './drive-client.js';
import { hashDocumentContent } from './hash.js';
import { insertKnowledgeDocument } from '../../workers/knowledge-base.js';
import {
  getBinding,
  listFolders,
  upsertBinding,
  upsertFolder,
  upsertMapping,
} from './store.js';
import { FOLDER_LABELS, OPS_CATEGORIES, type OpsCategory } from './types.js';

const TEMPLATE_BODIES: Record<OpsCategory, { title: string; body: string }> = {
  policies: {
    title: 'Policies template',
    body: `Policy\nOwner:\nEffective date:\nReview date:\nPurpose:\nScope:\nPolicy:\n`,
  },
  minutes: {
    title: 'Minutes template',
    body: `Minutes\nDate:\nAttendees:\nApologies:\nAgenda:\n1.\nDecisions:\nActions:\n- [ ] Owner / due\n`,
  },
  attendance: {
    title: 'Attendance template',
    body: `Attendance\nMeeting date:\nPresent:\n-\nApologies:\n-\nNotes:\n`,
  },
  'next-meeting': {
    title: 'NEXT meeting',
    body: `Next meeting\nWhen:\nInvitees:\n-\nAgenda:\n1.\nPrep notes:\n`,
  },
  'funder-month': {
    title: 'Funder month template',
    body: `Funder month update\nMonth:\nPeople supported (count only if verified):\nActivity bullets:\n-\nOutcomes / evidence links:\n-\nDraft status: draft\n`,
  },
  templates: {
    title: 'Document template',
    body: `Document title\nOwner:\nDate:\nStatus: draft\n\nContent:\n`,
  },
  inbox: {
    title: 'Inbox note',
    body: `Inbox capture\nDate:\nNote:\n`,
  },
};

export async function bootstrapWorkspaceOps(opts: {
  workspaceId: string;
  workerId: string;
  orgName: string;
  pollMinutes?: number;
  seedTemplates?: boolean;
}): Promise<{
  bindingId: string;
  rootFolderId: string;
  rootFolderName: string;
  folders: Array<{ category: OpsCategory; folderId: string; folderName: string }>;
}> {
  const orgName = opts.orgName.trim();
  if (!orgName) throw new Error('orgName is required');

  const worker = await getWorker(opts.workspaceId, opts.workerId);
  if (!worker) throw new Error('Worker not found');

  const accessToken = await resolveWorkerDriveToken(opts.workspaceId, opts.workerId);
  const rootName = `${orgName} Ops`;

  let binding = await getBinding(opts.workspaceId, opts.workerId);
  let rootFolderId = binding?.rootFolderId ?? '';
  if (!rootFolderId) {
    const root = await createDriveFolder({ accessToken, name: rootName });
    rootFolderId = root.id;
  }

  binding = await upsertBinding({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    orgName,
    rootFolderId,
    rootFolderName: rootName,
    pollMinutes: opts.pollMinutes ?? 10,
  });

  const existingFolders = await listFolders(binding.id);
  const folders: Array<{ category: OpsCategory; folderId: string; folderName: string }> = [];
  for (const category of OPS_CATEGORIES) {
    const label = FOLDER_LABELS[category];
    const prior = existingFolders.find((f) => f.category === category);
    if (prior?.folderId) {
      folders.push({
        category,
        folderId: prior.folderId,
        folderName: prior.folderName || label,
      });
      continue;
    }
    const created = await createDriveFolder({
      accessToken,
      name: label,
      parentId: rootFolderId,
    });
    await upsertFolder({
      bindingId: binding.id,
      category,
      folderId: created.id,
      folderName: label,
    });
    folders.push({ category, folderId: created.id, folderName: label });
  }

  const forceSeed = opts.seedTemplates === true;
  const autoSeed = opts.seedTemplates !== false && existingFolders.length === 0;
  if (forceSeed || autoSeed) {
    for (const category of OPS_CATEGORIES) {
      if (category === 'inbox') continue;
      const tmpl = TEMPLATE_BODIES[category];
      const folder = folders.find((f) => f.category === category)!;
      const doc = await createGoogleDoc({
        accessToken,
        title: tmpl.title,
        parentId: folder.folderId,
        bodyText: tmpl.body,
      });
      const knowledge = await insertKnowledgeDocument({
        workerId: opts.workerId,
        workspaceId: opts.workspaceId,
        title: tmpl.title,
        content: tmpl.body,
      });
      await upsertMapping({
        bindingId: binding.id,
        workspaceId: opts.workspaceId,
        workerId: opts.workerId,
        category,
        aivaDocumentId: knowledge.id,
        driveFileId: doc.id,
        driveWebViewLink: doc.webViewLink ?? '',
        title: tmpl.title,
        contentHash: hashDocumentContent(tmpl.title, tmpl.body),
        indexable: true,
        syncStatus: 'synced',
        updatedAtAiva: new Date(),
        updatedAtDrive: doc.modifiedTime ? new Date(doc.modifiedTime) : new Date(),
        lastDirection: 'bootstrap',
      });
    }
  }

  return {
    bindingId: binding.id,
    rootFolderId,
    rootFolderName: rootName,
    folders,
  };
}

export async function retargetWorkspaceOps(opts: {
  workspaceId: string;
  workerId: string;
  orgName: string;
  pollMinutes?: number;
}): Promise<Awaited<ReturnType<typeof bootstrapWorkspaceOps>>> {
  return bootstrapWorkspaceOps({ ...opts, seedTemplates: false });
}
