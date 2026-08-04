import { pool } from '../../memory/db.js';
import { listWorkers } from '../worker-store.js';
import { createWorkerSkill, addProjectItem, listProjects, updateProjectStatus } from '../spinnable-parity-store.js';
import { loadDepthFeatures } from './features.js';

export async function ensureDepthExtrasSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiva_workspace_org_links (
      workspace_id UUID PRIMARY KEY,
      org_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS aiva_worker_skill_proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL,
      worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      tool_slugs TEXT[] NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'auto_propose',
      status TEXT NOT NULL DEFAULT 'pending',
      source_ref TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS aiva_composer_drafts (
      workspace_id UUID NOT NULL,
      worker_id UUID NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
      thread_key TEXT NOT NULL DEFAULT 'default',
      draft_text TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, worker_id, thread_key)
    );
  `);
}

export async function linkWorkspaceOrg(workspaceId: string, orgId: string) {
  await ensureDepthExtrasSchema();
  await pool.query(
    `INSERT INTO aiva_workspace_org_links (workspace_id, org_id, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET org_id = EXCLUDED.org_id, updated_at = NOW()`,
    [workspaceId, orgId],
  );
}

export async function getWorkspaceOrgLink(workspaceId: string): Promise<string | null> {
  await ensureDepthExtrasSchema();
  const result = await pool.query(
    `SELECT org_id FROM aiva_workspace_org_links WHERE workspace_id = $1`,
    [workspaceId],
  );
  return result.rows[0] ? String(result.rows[0].org_id) : null;
}

export async function proposeWorkerSkill(input: {
  workspaceId: string;
  workerId: string;
  title: string;
  description?: string;
  steps?: unknown[];
  toolSlugs?: string[];
  sourceRef?: string;
}) {
  await ensureDepthExtrasSchema();
  const features = loadDepthFeatures();
  if (!features.skills.autoPropose) {
    throw new Error('Skill auto-propose disabled in depth-features config');
  }
  const title = input.title.trim();
  if (!title) throw new Error('title required');
  if (!features.skills.requireConfirm) {
    return {
      mode: 'saved' as const,
      skill: await createWorkerSkill({
        workspaceId: input.workspaceId,
        workerId: input.workerId,
        title,
        description: input.description,
        steps: input.steps,
        toolSlugs: input.toolSlugs,
      }),
    };
  }
  const result = await pool.query(
    `INSERT INTO aiva_worker_skill_proposals
      (workspace_id, worker_id, title, description, steps_json, tool_slugs, source_ref)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING *`,
    [
      input.workspaceId,
      input.workerId,
      title,
      input.description?.trim() ?? '',
      JSON.stringify(input.steps ?? []),
      input.toolSlugs ?? [],
      input.sourceRef ?? '',
    ],
  );
  return { mode: 'proposed' as const, proposal: mapProposal(result.rows[0]) };
}

function mapProposal(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ''),
    steps: Array.isArray(row.steps_json) ? row.steps_json : [],
    toolSlugs: Array.isArray(row.tool_slugs) ? row.tool_slugs.filter((x): x is string => typeof x === 'string') : [],
    status: String(row.status),
    sourceRef: String(row.source_ref ?? ''),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listSkillProposals(workspaceId: string, workerId: string) {
  await ensureDepthExtrasSchema();
  const result = await pool.query(
    `SELECT * FROM aiva_worker_skill_proposals
     WHERE workspace_id = $1 AND worker_id = $2 AND status = 'pending'
     ORDER BY created_at DESC`,
    [workspaceId, workerId],
  );
  return result.rows.map(mapProposal);
}

export async function confirmSkillProposal(workspaceId: string, workerId: string, proposalId: string) {
  await ensureDepthExtrasSchema();
  const result = await pool.query(
    `SELECT * FROM aiva_worker_skill_proposals
     WHERE workspace_id = $1 AND worker_id = $2 AND id = $3 AND status = 'pending'`,
    [workspaceId, workerId, proposalId],
  );
  if (result.rows.length === 0) throw new Error('Proposal not found');
  const proposal = mapProposal(result.rows[0]);
  const skill = await createWorkerSkill({
    workspaceId,
    workerId,
    title: proposal.title,
    description: proposal.description,
    steps: proposal.steps,
    toolSlugs: proposal.toolSlugs,
  });
  await pool.query(
    `UPDATE aiva_worker_skill_proposals SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
    [proposalId],
  );
  return skill;
}

export async function getComposerDraft(workspaceId: string, workerId: string, threadKey = 'default') {
  await ensureDepthExtrasSchema();
  const result = await pool.query(
    `SELECT draft_text, updated_at FROM aiva_composer_drafts
     WHERE workspace_id = $1 AND worker_id = $2 AND thread_key = $3`,
    [workspaceId, workerId, threadKey],
  );
  if (result.rows.length === 0) return { draftText: '', updatedAt: null as string | null };
  return {
    draftText: String(result.rows[0].draft_text ?? ''),
    updatedAt: new Date(String(result.rows[0].updated_at)).toISOString(),
  };
}

export async function saveComposerDraft(input: {
  workspaceId: string;
  workerId: string;
  threadKey?: string;
  draftText: string;
}) {
  await ensureDepthExtrasSchema();
  const features = loadDepthFeatures();
  if (!features.composer.draftPersistence) throw new Error('Composer draft persistence disabled');
  const max = features.composer.maxChars || 16000;
  const text = input.draftText.slice(0, max);
  await pool.query(
    `INSERT INTO aiva_composer_drafts (workspace_id, worker_id, thread_key, draft_text, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (workspace_id, worker_id, thread_key) DO UPDATE SET
       draft_text = EXCLUDED.draft_text, updated_at = NOW()`,
    [input.workspaceId, input.workerId, input.threadKey ?? 'default', text],
  );
  return getComposerDraft(input.workspaceId, input.workerId, input.threadKey ?? 'default');
}

export async function listCanvasWorkers(workspaceId: string, orgId?: string | null) {
  const workers = await listWorkers(workspaceId);
  const features = loadDepthFeatures();
  let filtered = workers;
  if (features.orgs.switcherEnabled && orgId) {
    const result = await pool.query(
      `SELECT id, org_id FROM ai_workers WHERE workspace_id = $1 AND status != 'dismissed'`,
      [workspaceId],
    );
    const orgById = new Map(result.rows.map((row) => [String(row.id), row.org_id ? String(row.org_id) : null]));
    filtered = workers.filter((worker) => {
      const workerOrg = orgById.get(worker.id);
      return !workerOrg || workerOrg === orgId;
    });
  }
  return filtered.map((worker) => ({
    id: worker.id,
    name: worker.name,
    status: worker.status,
    roleDescription: worker.roleDescription,
    channels: worker.channels,
  }));
}

export async function listOrgsForSwitcher(workspaceId: string) {
  const features = loadDepthFeatures();
  if (!features.orgs.enabled || features.orgs.switcherEnabled === false) {
    return { enabled: false, activeOrgId: null as string | null, orgs: [] as Array<Record<string, unknown>> };
  }
  const linked = await getWorkspaceOrgLink(workspaceId);
  if (!linked) {
    return { enabled: true, activeOrgId: null, orgs: [] };
  }
  // Include linked org + sibling orgs that share membership with the linked org owner (lightweight)
  const result = await pool.query(
    `SELECT o.id, o.name, o.slug, o.plan
     FROM organizations o
     WHERE o.id = $1
        OR o.id IN (
          SELECT om2.org_id FROM org_memberships om1
          JOIN org_memberships om2 ON om2.user_id = om1.user_id
          WHERE om1.org_id = $1
        )
     ORDER BY o.name ASC
     LIMIT 50`,
    [linked],
  );
  return {
    enabled: true,
    activeOrgId: linked,
    orgs: result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      plan: String(row.plan ?? ''),
      active: String(row.id) === linked,
    })),
  };
}

export async function setActiveOrgForWorkspace(workspaceId: string, orgId: string) {
  const features = loadDepthFeatures();
  if (!features.orgs.enabled || features.orgs.switcherEnabled === false) {
    throw new Error('Org switcher disabled in depth-features config');
  }
  const current = await getWorkspaceOrgLink(workspaceId);
  if (!current) throw new Error('Link a hosted org before switching');
  const allowed = await pool.query(
    `SELECT 1 FROM org_memberships om1
     JOIN org_memberships om2 ON om2.user_id = om1.user_id
     WHERE om1.org_id = $1 AND om2.org_id = $2
     LIMIT 1`,
    [current, orgId],
  );
  if (allowed.rows.length === 0 && current !== orgId) {
    throw new Error('Not a member of that organization (relative to current workspace link)');
  }
  await linkWorkspaceOrg(workspaceId, orgId);
  return listOrgsForSwitcher(workspaceId);
}

export async function searchConversationBodies(opts: {
  workspaceId: string;
  query: string;
  workerId?: string;
  limit?: number;
}) {
  const features = loadDepthFeatures();
  if (!features.search.messageBody) {
    return { enabled: false, hits: [] as Array<Record<string, unknown>> };
  }
  const q = opts.query.trim();
  if (!q) return { enabled: true, hits: [] };
  const limit = Math.min(50, opts.limit ?? 20);
  const params: unknown[] = [opts.workspaceId];
  let workerClause = '';
  if (opts.workerId) {
    params.push(opts.workerId);
    workerClause = `AND m.worker_id = $${params.length}`;
  }
  let matchClause = '';
  if (features.search.useFullText) {
    params.push(q);
    matchClause = `AND to_tsvector('english', coalesce(m.content, '')) @@ plainto_tsquery('english', $${params.length})`;
  } else {
    params.push(`%${q}%`);
    matchClause = `AND m.content ILIKE $${params.length}`;
  }
  params.push(limit);
  try {
    const result = await pool.query(
      `SELECT m.id, m.worker_id, m.thread_id, m.sender, m.content, m.created_at, w.name AS worker_name
       FROM aiva_employee_messages m
       JOIN ai_workers w ON w.id = m.worker_id
       WHERE w.workspace_id = $1
         ${matchClause}
         ${workerClause}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return {
      enabled: true,
      mode: features.search.useFullText ? 'fulltext' : 'ilike',
      hits: result.rows.map((row) => ({
        id: String(row.id),
        workerId: String(row.worker_id),
        workerName: String(row.worker_name),
        threadId: String(row.thread_id),
        sender: String(row.sender),
        content: String(row.content).slice(0, 500),
        createdAt: new Date(String(row.created_at)).toISOString(),
      })),
    };
  } catch {
    return { enabled: true, mode: 'unavailable', hits: [] };
  }
}

export async function listOrgMembersForWorkspace(workspaceId: string) {
  const features = loadDepthFeatures();
  if (!features.orgs.enabled) return { enabled: false, orgId: null as string | null, members: [] as Array<Record<string, unknown>> };
  const orgId = await getWorkspaceOrgLink(workspaceId);
  if (!orgId) return { enabled: true, orgId: null, members: [] };
  const result = await pool.query(
    `SELECT om.user_id, om.role, om.joined_at, hu.email
     FROM org_memberships om
     LEFT JOIN hosted_users hu ON hu.id = om.user_id
     WHERE om.org_id = $1
     ORDER BY CASE om.role WHEN 'owner' THEN 0 ELSE 1 END, om.joined_at ASC`,
    [orgId],
  );
  return {
    enabled: true,
    orgId,
    members: result.rows.map((row) => ({
      userId: String(row.user_id),
      role: String(row.role),
      email: row.email ? String(row.email) : null,
      joinedAt: row.joined_at ? new Date(String(row.joined_at)).toISOString() : null,
    })),
  };
}

export async function inviteOrgSeat(input: {
  workspaceId: string;
  email: string;
  role?: string;
  invitedBy: string;
}) {
  const features = loadDepthFeatures();
  if (!features.orgs.enabled) throw new Error('Orgs feature disabled in depth-features config');
  const orgId = await getWorkspaceOrgLink(input.workspaceId);
  if (!orgId) throw new Error('Link a hosted org first (PUT /api/aiva/workspace/org-link)');
  const { createInvite } = await import('../../hosted/org-invites.js');
  const allowed = new Set(['admin', 'operator', 'auditor', 'viewer']);
  const role = allowed.has(String(input.role ?? ''))
    ? (input.role as 'admin' | 'operator' | 'auditor' | 'viewer')
    : 'operator';
  const invite = await createInvite(orgId, input.email, role, input.invitedBy);
  return { orgId, ...invite };
}

export async function autoLinkSkillRunToProject(input: {
  workspaceId: string;
  workerId: string;
  skillId: string;
  skillTitle: string;
}) {
  const features = loadDepthFeatures();
  if (!features.projects.autoLinkSkillRuns) return null;
  const projects = await listProjects(input.workspaceId, input.workerId);
  const active = projects.find((p) => p.status === 'active') ?? projects[0];
  if (!active) return null;
  const item = await addProjectItem({
    workspaceId: input.workspaceId,
    projectId: active.id,
    itemType: 'skill_run',
    itemRef: input.skillId,
    title: input.skillTitle,
  });
  if (features.projects.autoAdvanceStatus && active.status === 'planned') {
    await updateProjectStatus(input.workspaceId, active.id, 'active');
  }
  return item;
}
