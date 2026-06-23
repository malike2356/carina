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
  type FsRoot,
} from '../lib/server-fs.js';
import {
  ALLOWED_SYSTEMD_SERVICES,
  getDockerContainers,
  getDockerScopeInfo,
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
  roots: FsRoot[],
): { name: string; path: string }[] {
  const crumbs: { name: string; path: string }[] = [];
  for (const root of roots) {
    if (absPath === root.path || absPath.startsWith(`${root.path}/`)) {
      crumbs.push({ name: root.label, path: root.path });
      const rel = absPath.slice(root.path.length);
      const parts = rel.split('/').filter(Boolean);
      let built = root.path;
      for (const part of parts) {
        built = `${built}/${part}`;
        crumbs.push({ name: part, path: built });
      }
      return crumbs;
    }
  }
  return crumbs;
}

function parentBrowsePath(
  currentPath: string | null,
  breadcrumbs: { name: string; path: string }[],
): string | null {
  if (!currentPath) return null;
  if (breadcrumbs.length > 1) return breadcrumbs[breadcrumbs.length - 2]?.path ?? null;
  return '';
}

async function getBrowseState(pathParam: string | null) {
  const roots = getAllowedRootsPublic();
  if (!pathParam) {
    return {
      roots,
      currentPath: null as string | null,
      entries: null as Awaited<ReturnType<typeof listDir>> | null,
      breadcrumbs: [] as { name: string; path: string }[],
      parentPath: null as string | null,
      error: null as string | null,
    };
  }

  try {
    const safe = resolveSafe(pathParam);
    const entries = await listDir(safe);
    const breadcrumbs = buildBreadcrumbs(safe, roots);
    return {
      roots,
      currentPath: safe,
      entries,
      breadcrumbs,
      parentPath: parentBrowsePath(safe, breadcrumbs),
      error: null,
    };
  } catch (e) {
    return {
      roots,
      currentPath: null,
      entries: null,
      breadcrumbs: [],
      parentPath: null,
      error: e instanceof Error ? e.message : 'Access denied',
    };
  }
}

serverPanelRouter.get('/files', async (req, res) => {
  const pathParam = typeof req.query.path === 'string' ? req.query.path : null;
  const state = await getBrowseState(pathParam);

  res.render('server/files', {
    title: 'Server Files',
    ...state,
    flash: req.query.saved === '1' ? 'Saved.' : null,
  });
});

serverPanelRouter.get('/api/files/list', async (req, res) => {
  const pathParam = typeof req.query.path === 'string' ? req.query.path : null;
  const state = await getBrowseState(pathParam);
  res.json({ ok: !state.error, ...state });
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
    dockerScope: getDockerScopeInfo(),
  });
});

serverPanelRouter.get('/api/services', async (_req, res) => {
  const [dockerContainers, ...systemdResults] = await Promise.all([
    getDockerContainers(),
    ...ALLOWED_SYSTEMD_SERVICES.map((s) => getSystemdStatus(s)),
  ]);
  res.json({
    docker: dockerContainers,
    systemd: systemdResults,
    scope: getDockerScopeInfo(),
  });
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
