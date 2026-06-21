import { spawn } from 'child_process';
import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/auth.js';
import {
  discoverLogFiles,
  getAllowedRootsPublic,
  listDir,
  readFile,
  resolveLogSafe,
  resolveSafe,
  writeFile,
} from '../lib/server-fs.js';
import {
  ALLOWED_SYSTEMD_SERVICES,
  getDockerContainers,
  getSystemdStatus,
  restartDockerContainer,
  restartSystemd,
} from '../lib/server-services.js';

export const serverPanelRouter = Router();

serverPanelRouter.get('/', (_req, res) => {
  res.render('server/index', { title: 'Server' });
});

function buildBreadcrumbs(
  absPath: string,
  roots: string[],
): { name: string; path: string }[] {
  const crumbs: { name: string; path: string }[] = [];
  for (const root of roots) {
    if (absPath === root || absPath.startsWith(`${root}/`)) {
      const rel = absPath.slice(root.length);
      crumbs.push({ name: root.split('/').at(-1) ?? root, path: root });
      const parts = rel.split('/').filter(Boolean);
      let built = root;
      for (const part of parts) {
        built = `${built}/${part}`;
        crumbs.push({ name: part, path: built });
      }
      return crumbs;
    }
  }
  return crumbs;
}

serverPanelRouter.get('/files', async (req, res) => {
  const roots = getAllowedRootsPublic();
  const pathParam = typeof req.query.path === 'string' ? req.query.path : null;
  let entries = null;
  let currentPath: string | null = null;
  let breadcrumbs: { name: string; path: string }[] = [];
  let error: string | null = null;

  if (pathParam) {
    try {
      const safe = resolveSafe(pathParam);
      currentPath = safe;
      entries = await listDir(safe);
      breadcrumbs = buildBreadcrumbs(safe, roots);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Access denied';
    }
  }

  res.render('server/files', {
    title: 'Server Files',
    roots,
    currentPath,
    entries,
    breadcrumbs,
    error,
    flash: req.query.saved === '1' ? 'Saved.' : null,
  });
});

serverPanelRouter.get('/files/read', async (req, res) => {
  const filePath = typeof req.query.path === 'string' ? req.query.path : '';
  try {
    const { content, language } = await readFile(filePath);
    res.json({ ok: true, content, language, path: filePath });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : 'Error' });
  }
});

serverPanelRouter.post('/files/write', requireSuperAdmin, async (req, res) => {
  const { path: filePath, content } = req.body as { path?: string; content?: string };
  if (!filePath || content === undefined) {
    res.status(400).json({ ok: false, error: 'path and content required' });
    return;
  }
  try {
    await writeFile(filePath, content);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : 'Error' });
  }
});

serverPanelRouter.get('/services', async (_req, res) => {
  const [dockerContainers, ...systemdResults] = await Promise.all([
    getDockerContainers(),
    ...ALLOWED_SYSTEMD_SERVICES.map((s) => getSystemdStatus(s)),
  ]);
  res.render('server/services', {
    title: 'Server Services',
    dockerContainers,
    systemdServices: systemdResults,
  });
});

serverPanelRouter.get('/api/services', async (_req, res) => {
  const [dockerContainers, ...systemdResults] = await Promise.all([
    getDockerContainers(),
    ...ALLOWED_SYSTEMD_SERVICES.map((s) => getSystemdStatus(s)),
  ]);
  res.json({ docker: dockerContainers, systemd: systemdResults });
});

serverPanelRouter.post('/api/services/restart', requireSuperAdmin, async (req, res) => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name || !type) {
    res.status(400).json({ ok: false, error: 'name and type required' });
    return;
  }
  try {
    if (type === 'systemd') {
      await restartSystemd(name);
    } else if (type === 'docker') {
      await restartDockerContainer(name);
    } else {
      throw new Error('Unknown type');
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : 'Restart failed' });
  }
});

serverPanelRouter.get('/logs', async (_req, res) => {
  const files = await discoverLogFiles();
  const grouped: Record<string, typeof files> = {};
  for (const f of files) {
    (grouped[f.group] ??= []).push(f);
  }
  res.render('server/logs', { title: 'Log Stream', grouped });
});

serverPanelRouter.get('/api/logs/stream', (req, res) => {
  const filePath = typeof req.query.file === 'string' ? req.query.file : '';
  let safePath: string;
  try {
    safePath = resolveLogSafe(filePath);
  } catch {
    res.status(400).end('Invalid log path');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const tail = spawn('tail', ['-n', '100', '-f', safePath]);

  function sendLine(line: string): void {
    res.write(`data: ${line.replace(/\n/g, ' ')}\n\n`);
  }

  let buf = '';
  tail.stdout.on('data', (chunk: Buffer) => {
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      sendLine(line);
    }
  });

  tail.stderr.on('data', (chunk: Buffer) => {
    sendLine(`[stderr] ${chunk.toString('utf8').trim()}`);
  });

  tail.on('close', (code) => {
    sendLine(`[stream closed, exit code ${code}]`);
    res.end();
  });

  req.on('close', () => {
    tail.kill('SIGTERM');
  });
});
