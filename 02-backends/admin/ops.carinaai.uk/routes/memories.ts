import { Router } from 'express';
import { query, tableExists } from '../lib/db.js';
import {
  buildMemoriesQuery,
  memoriesOrderBy,
  memorySortArrow,
  nextSortDir,
  parseMemorySort,
  parseSortDir,
  type MemorySortColumn,
} from '../lib/list-sort.js';
import {
  buildMemoryAttribution,
  parseAivaSessionId,
  type MemoryAttribution,
} from '../lib/memory-attribution.js';

export const memoriesRouter = Router();

const PAGE_SIZE = 50;

type MemoryListRow = {
  id: string;
  session_id: string;
  role: string;
  content_chars: number;
  created_at: Date;
  updated_at: Date | null;
  worker_id: string | null;
  aiva_name: string | null;
  workspace_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
};

type EnrichedMemory = MemoryListRow & {
  attribution: MemoryAttribution;
};

async function loadPeerDisplayNames(
  rows: Array<{ session_id: string; worker_id: string | null }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!(await tableExists('aiva_contact_identities'))) return out;

  const lookups = new Map<string, { workerId: string; peerId: string; channel: string | null }>();
  for (const row of rows) {
    const parsed = parseAivaSessionId(row.session_id);
    const workerId = row.worker_id || parsed.workerId;
    if (!workerId || !parsed.peerId) continue;
    if (parsed.peerId === 'app' || parsed.peerId.startsWith('web-auto-')) continue;
    lookups.set(`${workerId}::${parsed.peerId}`, {
      workerId,
      peerId: parsed.peerId,
      channel: parsed.channel,
    });
  }
  if (lookups.size === 0) return out;

  const workerIds = [...new Set([...lookups.values()].map((l) => l.workerId))];
  const peerIds = [...new Set([...lookups.values()].map((l) => l.peerId))];

  const result = await query<{
    worker_id: string;
    canonical_contact_id: string;
    channel_contact_id: string;
    channel: string;
    display_name: string | null;
  }>(
    `SELECT worker_id, canonical_contact_id, channel_contact_id, channel, display_name
     FROM aiva_contact_identities
     WHERE worker_id = ANY($1::text[])
       AND (
         canonical_contact_id = ANY($2::text[])
         OR channel_contact_id = ANY($2::text[])
       )
       AND COALESCE(display_name, '') <> ''`,
    [workerIds, peerIds],
  );

  for (const row of result.rows) {
    const name = (row.display_name || '').trim();
    if (!name) continue;
    out.set(`${row.worker_id}::${row.canonical_contact_id}`, name);
    out.set(`${row.worker_id}::${row.channel_contact_id}`, name);
    out.set(`${row.worker_id}::${row.channel}::${row.channel_contact_id}`, name);
  }
  return out;
}

function enrichRow(
  row: MemoryListRow,
  peerNames: Map<string, string>,
): EnrichedMemory {
  const parsed = parseAivaSessionId(row.session_id);
  const workerId = row.worker_id || parsed.workerId;
  let peerDisplayName: string | null = null;
  if (workerId && parsed.peerId) {
    peerDisplayName =
      peerNames.get(`${workerId}::${parsed.peerId}`)
      || (parsed.channel
        ? peerNames.get(`${workerId}::${parsed.channel}::${parsed.peerId}`)
        : null)
      || null;
  }

  return {
    ...row,
    attribution: buildMemoryAttribution({
      role: row.role,
      sessionId: row.session_id,
      workerId,
      aivaName: row.aiva_name,
      workspaceId: row.workspace_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      peerDisplayName,
    }),
  };
}

async function hasWorkersTable(): Promise<boolean> {
  return tableExists('ai_workers');
}

/**
 * Privacy: Ops must never render episodic memory plaintext.
 * List/session/detail expose metadata + attribution only.
 */
memoriesRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const search = '';
  const role = String(req.query.role ?? 'all');
  const sessionFilter = String(req.query.session ?? '').trim();
  const aivaFilter = String(req.query.aiva ?? '').trim();
  const customerFilter = String(req.query.customer ?? '').trim();
  const sortBy = parseMemorySort(req.query.sort);
  const sortDir = parseSortDir(req.query.dir);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (role === 'user' || role === 'assistant' || role === 'system') {
    conditions.push(`m.role = $${paramIndex++}`);
    params.push(role);
  }
  if (sessionFilter) {
    conditions.push(`m.session_id ILIKE $${paramIndex++}`);
    params.push(`%${sessionFilter}%`);
  }
  if (aivaFilter) {
    conditions.push(`(w.name ILIKE $${paramIndex} OR w.id::text ILIKE $${paramIndex})`);
    params.push(`%${aivaFilter}%`);
    paramIndex += 1;
  }
  if (customerFilter) {
    conditions.push(
      `(c.owner_name ILIKE $${paramIndex} OR c.owner_email ILIKE $${paramIndex} OR w.workspace_id ILIKE $${paramIndex})`,
    );
    params.push(`%${customerFilter}%`);
    paramIndex += 1;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joinWorkers = await hasWorkersTable();
  const joinContacts = joinWorkers && (await tableExists('aiva_workspace_contacts'));

  const fromSql = joinWorkers
    ? `FROM episodic_memories m
       LEFT JOIN ai_workers w
         ON m.session_id ~ ('^aiva-' || w.id::text || '-')
       ${joinContacts ? 'LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id' : ''}`
    : 'FROM episodic_memories m';

  const renderOpts = {
    page,
    search,
    role,
    sessionFilter,
    aivaFilter,
    customerFilter,
    sortBy,
    sortDir,
    sortArrow: memorySortArrow,
    contentRedacted: true as const,
    sortLink: (column: MemorySortColumn) =>
      buildMemoriesQuery({
        page: 1,
        q: search,
        role,
        session: sessionFilter,
        sort: column,
        dir: nextSortDir(sortBy, sortDir, column),
      }) + (aivaFilter ? `&aiva=${encodeURIComponent(aivaFilter)}` : '')
        + (customerFilter ? `&customer=${encodeURIComponent(customerFilter)}` : ''),
    pageLink: (targetPage: number) =>
      buildMemoriesQuery({
        page: targetPage,
        q: search,
        role,
        session: sessionFilter,
        sort: sortBy,
        dir: sortDir,
      }) + (aivaFilter ? `&aiva=${encodeURIComponent(aivaFilter)}` : '')
        + (customerFilter ? `&customer=${encodeURIComponent(customerFilter)}` : ''),
  };

  try {
    const hasMemories = await tableExists('episodic_memories');
    if (!hasMemories) {
      res.render('memories/index', {
        ...renderOpts,
        memories: [],
        totalPages: 1,
        total: 0,
      });
      return;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count ${fromSql} ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const offset = (page - 1) * PAGE_SIZE;

    const listParams = [...params, PAGE_SIZE, offset];
    const selectSql = joinWorkers
      ? `SELECT m.id, m.session_id, m.role,
                char_length(COALESCE(m.content, ''))::int AS content_chars,
                m.created_at, m.updated_at,
                w.id::text AS worker_id,
                w.name AS aiva_name,
                w.workspace_id,
                ${joinContacts ? 'c.owner_name AS customer_name, c.owner_email AS customer_email' : 'NULL::text AS customer_name, NULL::text AS customer_email'}
         ${fromSql}
         ${where}
         ORDER BY ${memoriesOrderBy(sortBy, sortDir).replace(/\b(created_at|updated_at|session_id|role|id)\b/g, 'm.$1')}
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`
      : `SELECT m.id, m.session_id, m.role,
                char_length(COALESCE(m.content, ''))::int AS content_chars,
                m.created_at, m.updated_at,
                NULL::text AS worker_id,
                NULL::text AS aiva_name,
                NULL::text AS workspace_id,
                NULL::text AS customer_name,
                NULL::text AS customer_email
         ${fromSql}
         ${where}
         ORDER BY ${memoriesOrderBy(sortBy, sortDir).replace(/\b(created_at|updated_at|session_id|role|id)\b/g, 'm.$1')}
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`;

    const rows = await query<MemoryListRow>(selectSql, listParams);
    const peerNames = await loadPeerDisplayNames(rows.rows);
    const memories = rows.rows.map((row) => enrichRow(row, peerNames));

    res.render('memories/index', {
      ...renderOpts,
      memories,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.get('/session/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  try {
    if (!(await tableExists('episodic_memories'))) {
      res.render('memories/session', {
        sessionId,
        messages: [],
        contentRedacted: true,
        sessionAttribution: null,
      });
      return;
    }

    const joinWorkers = await hasWorkersTable();
    const joinContacts = joinWorkers && (await tableExists('aiva_workspace_contacts'));
    const metaSql = joinWorkers
      ? `SELECT
           w.id::text AS worker_id,
           w.name AS aiva_name,
           w.workspace_id,
           ${joinContacts ? 'c.owner_name AS customer_name, c.owner_email AS customer_email' : 'NULL::text AS customer_name, NULL::text AS customer_email'}
         FROM ai_workers w
         ${joinContacts ? 'LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id' : ''}
         WHERE $1 ~ ('^aiva-' || w.id::text || '-')
         LIMIT 1`
      : null;

    const meta = metaSql
      ? await query<{
          worker_id: string | null;
          aiva_name: string | null;
          workspace_id: string | null;
          customer_name: string | null;
          customer_email: string | null;
        }>(metaSql, [sessionId])
      : { rows: [] as Array<{
          worker_id: string | null;
          aiva_name: string | null;
          workspace_id: string | null;
          customer_name: string | null;
          customer_email: string | null;
        }> };

    const metaRow = meta.rows[0] ?? {
      worker_id: null,
      aiva_name: null,
      workspace_id: null,
      customer_name: null,
      customer_email: null,
    };

    const rows = await query<{
      id: string;
      role: string;
      content_chars: number;
      created_at: Date;
      session_id: string;
    }>(
      `SELECT id, role, session_id,
              char_length(COALESCE(content, ''))::int AS content_chars,
              created_at
       FROM episodic_memories
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );

    const peerNames = await loadPeerDisplayNames(
      rows.rows.map((r) => ({ session_id: r.session_id, worker_id: metaRow.worker_id })),
    );

    const messages = rows.rows.map((row) =>
      enrichRow(
        {
          id: row.id,
          session_id: row.session_id,
          role: row.role,
          content_chars: row.content_chars,
          created_at: row.created_at,
          updated_at: null,
          worker_id: metaRow.worker_id,
          aiva_name: metaRow.aiva_name,
          workspace_id: metaRow.workspace_id,
          customer_name: metaRow.customer_name,
          customer_email: metaRow.customer_email,
        },
        peerNames,
      ),
    );

    const sessionAttribution = buildMemoryAttribution({
      role: 'user',
      sessionId,
      workerId: metaRow.worker_id,
      aivaName: metaRow.aiva_name,
      workspaceId: metaRow.workspace_id,
      customerName: metaRow.customer_name,
      customerEmail: metaRow.customer_email,
      peerDisplayName: peerNames.get(
        `${metaRow.worker_id || ''}::${parseAivaSessionId(sessionId).peerId || ''}`,
      ) || null,
    });

    res.render('memories/session', {
      sessionId,
      messages,
      contentRedacted: true,
      sessionAttribution,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.get('/:id', async (req, res) => {
  try {
    if (!(await tableExists('episodic_memories'))) {
      res.status(404).render('error', { message: 'Memory store is not available yet' });
      return;
    }

    const joinWorkers = await hasWorkersTable();
    const joinContacts = joinWorkers && (await tableExists('aiva_workspace_contacts'));

    const rows = await query<{
      id: string;
      session_id: string;
      role: string;
      content_chars: number;
      has_embedding: boolean;
      created_at: Date;
      worker_id: string | null;
      aiva_name: string | null;
      workspace_id: string | null;
      customer_name: string | null;
      customer_email: string | null;
    }>(
      joinWorkers
        ? `SELECT m.id, m.session_id, m.role,
                  char_length(COALESCE(m.content, ''))::int AS content_chars,
                  (m.embedding IS NOT NULL) AS has_embedding,
                  m.created_at,
                  w.id::text AS worker_id,
                  w.name AS aiva_name,
                  w.workspace_id,
                  ${joinContacts ? 'c.owner_name AS customer_name, c.owner_email AS customer_email' : 'NULL::text AS customer_name, NULL::text AS customer_email'}
           FROM episodic_memories m
           LEFT JOIN ai_workers w ON m.session_id ~ ('^aiva-' || w.id::text || '-')
           ${joinContacts ? 'LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id' : ''}
           WHERE m.id = $1`
        : `SELECT m.id, m.session_id, m.role,
                  char_length(COALESCE(m.content, ''))::int AS content_chars,
                  (m.embedding IS NOT NULL) AS has_embedding,
                  m.created_at,
                  NULL::text AS worker_id,
                  NULL::text AS aiva_name,
                  NULL::text AS workspace_id,
                  NULL::text AS customer_name,
                  NULL::text AS customer_email
           FROM episodic_memories m
           WHERE m.id = $1`,
      [req.params.id],
    );
    const memory = rows.rows[0];
    if (!memory) {
      res.status(404).render('error', { message: 'Memory not found' });
      return;
    }

    const peerNames = await loadPeerDisplayNames([
      { session_id: memory.session_id, worker_id: memory.worker_id },
    ]);
    const enriched = enrichRow(
      {
        id: memory.id,
        session_id: memory.session_id,
        role: memory.role,
        content_chars: memory.content_chars,
        created_at: memory.created_at,
        updated_at: null,
        worker_id: memory.worker_id,
        aiva_name: memory.aiva_name,
        workspace_id: memory.workspace_id,
        customer_name: memory.customer_name,
        customer_email: memory.customer_email,
      },
      peerNames,
    );

    res.render('memories/view', {
      memory: {
        ...memory,
        attribution: enriched.attribution,
      },
      hasEmbedding: Boolean(memory.has_embedding),
      contentRedacted: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

memoriesRouter.post('/:id/delete', async (req, res) => {
  if (await tableExists('episodic_memories')) {
    await query('DELETE FROM episodic_memories WHERE id = $1', [req.params.id]);
  }
  res.redirect('/memories');
});

memoriesRouter.post('/session/:sessionId/delete', async (req, res) => {
  if (await tableExists('episodic_memories')) {
    await query('DELETE FROM episodic_memories WHERE session_id = $1', [
      req.params.sessionId,
    ]);
  }
  res.redirect('/memories');
});
