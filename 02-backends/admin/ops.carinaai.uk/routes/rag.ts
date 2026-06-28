import { Router } from 'express';
import { spawn } from 'child_process';
import { query } from '../lib/db.js';
import {
  buildPageWindow,
  buildRagQuery,
  nextSortDir,
  parsePageSize,
  parseRagEmbedded,
  parseRagSort,
  parseSortDir,
  ragOrderBy,
  ragSortArrow,
  type RagSortColumn,
} from '../lib/list-sort.js';
import { resolveCarinaCliCommand } from '../lib/pty-bridge-core.js';

export const ragRouter = Router();

ragRouter.get('/', async (req, res) => {
  const pageSize = parsePageSize(req.query.limit);
  const pack = String(req.query.pack ?? 'all');
  const search = String(req.query.q ?? '').trim();
  const embedded = parseRagEmbedded(req.query.embedded);
  const sortBy = parseRagSort(req.query.sort);
  const sortDir = parseSortDir(req.query.dir);
  let page = Math.max(1, Number(req.query.page) || 1);

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (pack && pack !== 'all') {
    conditions.push(`pack = $${paramIndex++}`);
    params.push(pack);
  }
  if (search) {
    conditions.push(`(source ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex += 1;
  }
  if (embedded === 'yes') {
    conditions.push('embedding IS NOT NULL');
  } else if (embedded === 'no') {
    conditions.push('embedding IS NULL');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const queryState = { page, q: search, pack, embedded, sort: sortBy, dir: sortDir, limit: pageSize };
  const sortLink = (column: RagSortColumn) =>
    buildRagQuery({
      ...queryState,
      page: 1,
      sort: column,
      dir: nextSortDir(sortBy, sortDir, column),
    });
  const pageLink = (targetPage: number) => buildRagQuery({ ...queryState, page: targetPage });

  try {
    const packsResult = await query<{ pack: string }>(
      'SELECT DISTINCT pack FROM rag_chunks ORDER BY pack',
    );
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rag_chunks ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, totalPages);
    const offset = (page - 1) * pageSize;
    const listParams = [...params, pageSize, offset];

    const rows = await query<{
      id: string;
      pack: string;
      source: string;
      content: string;
      embedding: unknown;
      created_at: Date;
    }>(
      `SELECT id, pack, source, content, embedding, created_at
       FROM rag_chunks
       ${where}
       ORDER BY ${ragOrderBy(sortBy, sortDir)}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      listParams,
    );

    res.render('rag', {
      chunks: rows.rows,
      packs: packsResult.rows.map((row) => row.pack),
      pack,
      search,
      embedded,
      sortBy,
      sortDir,
      page,
      pageSize,
      totalPages,
      total,
      pageWindow: buildPageWindow(page, totalPages),
      sortArrow: ragSortArrow,
      sortLink,
      pageLink,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

ragRouter.get('/ingest', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (line: string) => {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  };

  const pack = String(req.query.pack ?? 'property-uk').trim() || 'property-uk';
  const dbUrl = process.env.CARINA_DB_URL ?? process.env.DATABASE_URL;
  let child;
  try {
    const { file, args, cwd } = resolveCarinaCliCommand(['ingest', pack]);
    child = spawn(file, args, {
      cwd,
      env: {
        ...process.env,
        DOTENV_CONFIG_QUIET: 'true',
        ...(dbUrl ? { DATABASE_URL: dbUrl } : {}),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(`Failed to start ingest: ${message}`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  child.stdout.on('data', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (line.trim()) send(line);
    }
  });

  child.stderr.on('data', (buf) => {
    for (const line of buf.toString().split('\n')) {
      if (line.trim()) send(`[stderr] ${line}`);
    }
  });

  child.on('close', (code) => {
    send(`Ingest finished with exit code ${code ?? 'unknown'}`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  child.on('error', (err) => {
    send(`Failed to start ingest: ${err.message}`);
    res.write('data: [DONE]\n\n');
    res.end();
  });

  req.on('close', () => {
    if (!child.killed) child.kill();
  });
});
