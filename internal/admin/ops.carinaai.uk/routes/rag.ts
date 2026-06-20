import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../lib/db.js';
import { ORDER_BY_CREATED_RECENT } from '../lib/list-sort.js';

export const ragRouter = Router();

const PAGE_SIZE = 50;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

ragRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pack = String(req.query.pack ?? 'all');
  const search = String(req.query.q ?? '').trim();

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (pack && pack !== 'all') {
    conditions.push(`pack = $${paramIndex++}`);
    params.push(pack);
  }
  if (search) {
    conditions.push(`source ILIKE $${paramIndex++}`);
    params.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const packsResult = await query<{ pack: string }>(
      'SELECT DISTINCT pack FROM rag_chunks ORDER BY pack',
    );
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rag_chunks ${where}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);
    const offset = (page - 1) * PAGE_SIZE;
    const listParams = [...params, PAGE_SIZE, offset];

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
       ORDER BY ${ORDER_BY_CREATED_RECENT}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      listParams,
    );

    res.render('rag', {
      chunks: rows.rows,
      packs: packsResult.rows.map((r) => r.pack),
      pack,
      search,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
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

  const child = spawn('pnpm', ['ingest'], {
    cwd: PROJECT_ROOT,
    shell: true,
    env: { ...process.env },
  });

  const send = (line: string) => {
    res.write(`data: ${JSON.stringify({ line })}\n\n`);
  };

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
