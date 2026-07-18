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
import {
  folderLabelsForPack,
  OPS_CATEGORIES,
  resolveOpsPackProfile,
  type OpsCategory,
  type OpsPackProfile,
} from './types.js';

type TemplateSeed = { title: string; body: string };

const DEFAULT_TEMPLATE_BODIES: Record<OpsCategory, TemplateSeed> = {
  policies: {
    title: 'Policies template',
    body: `Policy\nOwner:\nEffective date:\nReview date:\nPurpose:\nScope:\nPolicy:\n`,
  },
  minutes: {
    title: 'Minutes template',
    body: `Minutes\nDate:\nAttendees:\nApologies:\nAgenda:\n1.\nDecisions:\nActions:\n- [ ] Owner / due\n`,
  },
  attendance: {
    title: 'Attendance sheet template',
    body: `Attendance sheet\nSession date:\nSession name:\nVenue / session type:\nPresent (verified only):\n-\nApologies:\n-\nRule: Aiva must not invent attendees.\n`,
  },
  'next-meeting': {
    title: 'NEXT meeting',
    body: `Next meeting\nWhen:\nInvitees:\n-\nAgenda:\n1.\nPrep notes:\n`,
  },
  'funder-month': {
    title: 'Monthly funder report template',
    body: `Monthly funder evidence pack\nMonth:\nSessions held (count only if verified):\nPeople supported (count only if verified):\nActivity bullets:\n-\nPosters / communications done:\n-\nOutcomes / quotes:\n-\nDraft status: draft\nHuman approval required before send.\n`,
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

const COMMUNITY_SESSIONS_TEMPLATE_BODIES: Record<OpsCategory, TemplateSeed> = {
  policies: {
    title: 'Safeguarding and policies checklist',
    body: `Policies and safeguarding\nOwner:\nEffective date:\nReview date:\nPurpose:\nScope:\nSafeguarding notes:\nPolicy summary:\nDo not invent names, incidents, or numbers.\n`,
  },
  minutes: {
    title: 'Session notes template',
    body: `Session notes\nDate:\nFacilitator:\nTheme / topic:\nWho attended (names only if verified):\n-\nApologies:\n-\nWhat happened:\n1.\nDecisions / next steps:\n- [ ] Owner / due\nDo not invent attendees or outcomes.\n`,
  },
  attendance: {
    title: 'Session attendance sheet',
    body: `Attendance sheet\nSession date:\nSession name:\nVenue / session type:\nMonth folder (e.g. 2026-06):\nPresent (verified only):\n-\nApologies:\n-\nDo not invent attendees.\nMonth 1: save after each session for funder evidence.\n`,
  },
  'next-meeting': {
    title: 'Session planner',
    body: `Session planner\nWhen:\nVenue / channel:\nInvitees:\n-\nTheme / topic:\nAgenda:\n1.\nMaterials / posters needed:\n-\nPrep notes:\nDo not invent invitees or dates.\n`,
  },
  'funder-month': {
    title: 'Funder monthly evidence',
    body: `Monthly funder evidence pack\nMonth (e.g. 2026-06):\nSessions held (count only if verified):\nPeople supported (count only if verified):\nActivity bullets:\n-\nPosters / communications done:\n-\nOutcomes / quotes:\n-\nEvidence links (Drive / photos / sheets):\n-\nDraft status: draft\nHuman approval required before send.\nDo not invent attendees or numbers.\nMonth 1: one structured Drive document; charts come later if needed.\n`,
  },
  templates: {
    title: 'Poster and template stub',
    body: `Poster / template\nTitle:\nOwner:\nDate:\nMonth folder (e.g. 2026-06):\nStatus: draft\n\nCopy / content:\n`,
  },
  inbox: {
    title: 'Inbox note',
    body: `Inbox capture\nDate:\nNote:\n`,
  },
};

export function templateBodiesForPack(profile: OpsPackProfile = 'default'): Record<OpsCategory, TemplateSeed> {
  return profile === 'community-sessions'
    ? COMMUNITY_SESSIONS_TEMPLATE_BODIES
    : DEFAULT_TEMPLATE_BODIES;
}

export async function bootstrapWorkspaceOps(opts: {
  workspaceId: string;
  workerId: string;
  orgName: string;
  pollMinutes?: number;
  seedTemplates?: boolean;
  packProfile?: string;
}): Promise<{
  bindingId: string;
  rootFolderId: string;
  rootFolderName: string;
  packProfile: OpsPackProfile;
  folders: Array<{ category: OpsCategory; folderId: string; folderName: string }>;
}> {
  const orgName = opts.orgName.trim();
  if (!orgName) throw new Error('orgName is required');

  const packProfile = resolveOpsPackProfile(opts.packProfile);
  const folderLabels = folderLabelsForPack(packProfile);
  const templateBodies = templateBodiesForPack(packProfile);

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
    meta: {
      ...(binding?.meta ?? {}),
      packProfile,
    },
  });

  const existingFolders = await listFolders(binding.id);
  const folders: Array<{ category: OpsCategory; folderId: string; folderName: string }> = [];
  for (const category of OPS_CATEGORIES) {
    const label = folderLabels[category];
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
      const tmpl = templateBodies[category];
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
    packProfile,
    folders,
  };
}

export async function retargetWorkspaceOps(opts: {
  workspaceId: string;
  workerId: string;
  orgName: string;
  pollMinutes?: number;
  packProfile?: string;
}): Promise<Awaited<ReturnType<typeof bootstrapWorkspaceOps>>> {
  return bootstrapWorkspaceOps({ ...opts, seedTemplates: false });
}
