import { Router } from 'express';
import { carinaGet, carinaJson, carinaOpsTokenSet, carinaPost } from '../lib/carina.js';

export const controlCenterRouter = Router();

type EnvSummary = {
  generatedAt: string;
  envExists: boolean;
  audit: { ok: number; warn: number; fail: number };
};

type SkillPacksPayload = {
  available: Array<{ name: string }>;
  active: string[];
  source?: string;
};

type WebPasswordStatus = {
  set: boolean;
  updatedAt?: string | null;
};

type ExtensionsPayload = {
  runtimeEnabled: boolean;
  extensions: Array<{ id: string; status?: string; health?: string; version?: string }>;
};

type EvalReportsPayload = {
  reports: Array<{ runId: string; pack: string; passRate: number; summary?: string }>;
};

type LogsPayload = {
  count: number;
};

type SessionsPayload = {
  summary: { active: number; idle: number; stale: number; total: number };
};

type TelemetryOverview = {
  health: {
    healthy: boolean;
    checks: Array<{ id: string; status: 'ok' | 'warn' | 'fail'; detail: string }>;
  };
  metrics?: {
    providers?: { fallbacks?: number };
    traces?: { activeSpans?: number };
  };
  channels?: { connected: number; configured: number; degraded: number };
  sessions?: { uniqueSessions?: number; turns?: number };
};

type HostServiceStatus = {
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  uptimeSeconds: number;
  hostname: string;
  version: string;
  carinaHome: string;
  webPort: number;
  memoryBackend: string;
  scoutEnabled: boolean;
  agents: number;
  pairedDevices: number;
  cronJobs: number | null;
  pendingCommitments: number;
};

type ControlStatusResponse = {
  ok: boolean;
  host: HostServiceStatus;
};

type ControlAgentsPayload = {
  agents: Array<{ id: string; name: string; default: boolean; workspace: string; provider: string; model: string }>;
};

type ControlDevicesPayload = {
  devices: Array<{ id: string; name?: string; status?: string; pairedAt?: string | null }>;
};

function workspaceSurfaces(): Array<{ label: string; href: string; external?: boolean }> {
  const base = (process.env.CARINA_HOSTED_APP_URL ?? 'https://app.carinaai.uk').replace(/\/+$/, '');
  return [
    { label: 'Analytics', href: `${base}/analytics`, external: true },
    { label: 'Billing', href: `${base}/billing`, external: true },
    { label: 'Calendar', href: `${base}/calendar`, external: true },
    { label: 'Cron', href: `${base}/cron`, external: true },
    { label: 'Documents', href: `${base}/documents`, external: true },
    { label: 'Email', href: `${base}/email`, external: true },
    { label: 'Environment', href: `${base}/env`, external: true },
    { label: 'Files', href: `${base}/files`, external: true },
    { label: 'Logs', href: `${base}/logs`, external: true },
    { label: 'MCP', href: '/mcp' },
    { label: 'Profiles', href: `${base}/profiles`, external: true },
    { label: 'Research', href: `${base}/research`, external: true },
    { label: 'Scheduled', href: `${base}/scheduled`, external: true },
    { label: 'Security', href: `${base}/security`, external: true },
    { label: 'Tasks', href: `${base}/tasks`, external: true },
    { label: 'Terminal', href: `${base}/terminal`, external: true },
    { label: 'Webhooks', href: `${base}/webhooks`, external: true },
    { label: 'Settings', href: `${base}/settings`, external: true },
  ];
}

const OPS_SURFACES = [
  { label: 'Incident Blog', href: '/admin/incident-blog' },
  { label: 'Agent Tools', href: '/admin/agent-tools' },
  { label: 'AI Platform', href: '/ai-platform' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Subscriptions', href: '/subscriptions' },
  { label: 'Security', href: '/security' },
  { label: 'Channels', href: '/channels' },
  { label: 'Chat', href: '/chat' },
  { label: 'TUI', href: '/tui' },
  { label: 'Memories', href: '/memories' },
  { label: 'Skills', href: '/skills' },
  { label: 'Skill Packs', href: '/packs' },
  { label: 'RAG', href: '/rag' },
  { label: 'Projects', href: '/projects' },
  { label: 'Settings', href: '/settings' },
];

function linkClass(active: boolean): string {
  return active
    ? 'border-[#16c97e] bg-[#16221b] text-white'
    : 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 hover:border-[#16c97e]/70 hover:text-white';
}

async function fetchCoreJson<T>(path: string): Promise<{ ok: boolean; data: T | null }> {
  try {
    const response = await carinaGet(path);
    const parsed = await carinaJson<T>(response);
    return { ok: parsed.ok, data: parsed.ok ? parsed.data : null };
  } catch {
    return { ok: false, data: null };
  }
}

controlCenterRouter.get('/', async (req, res) => {
  const coreConnected = carinaOpsTokenSet();

  const [
    env,
    packs,
    webPassword,
    extensions,
    evalReports,
    logs,
    sessions,
    telemetry,
    controlStatus,
    agents,
    devices,
  ] = coreConnected
    ? await Promise.all([
        fetchCoreJson<EnvSummary>('/api/ops/environment'),
        fetchCoreJson<SkillPacksPayload>('/api/ops/skill-packs'),
        fetchCoreJson<WebPasswordStatus>('/api/ops/web-password'),
        fetchCoreJson<ExtensionsPayload>('/api/ops/extensions'),
        fetchCoreJson<EvalReportsPayload>('/api/ops/eval-reports?limit=5'),
        fetchCoreJson<LogsPayload>('/api/ops/logs?limit=20'),
        fetchCoreJson<SessionsPayload>('/api/ops/sessions?limit=20'),
        fetchCoreJson<TelemetryOverview>('/api/ops/telemetry/overview?hours=24'),
        fetchCoreJson<ControlStatusResponse>('/api/control/status'),
        fetchCoreJson<ControlAgentsPayload>('/api/control/agents'),
        fetchCoreJson<ControlDevicesPayload>('/api/control/devices'),
      ])
    : [];

  const telemetryHealth = telemetry?.data?.health ?? null;
  const hostStatus = controlStatus?.data?.host ?? null;

  res.render('control-center', {
    title: 'Control Center',
    coreConnected,
    env: env?.data,
    packs: packs?.data,
    webPassword: webPassword?.data,
    extensions: extensions?.data,
    evalReports: evalReports?.data,
    logs: logs?.data,
    sessions: sessions?.data,
    telemetry: telemetry?.data,
    telemetryHealth,
    hostStatus,
    agents: agents?.data,
    devices: devices?.data,
    opsSurfaces: OPS_SURFACES,
    workspaceSurfaces: workspaceSurfaces(),
    linkClass,
    reloadOk: req.query['ok'] === 'reload',
    reloadErr: typeof req.query['err'] === 'string' ? req.query['err'] : '',
  });
});

controlCenterRouter.post('/reload-secrets', async (_req, res) => {
  const response = await carinaPost('/api/control/reload-secrets', {});
  const payload = await carinaJson<{ ok?: boolean; error?: string }>(response);
  if (!payload.ok) {
    res.redirect('/control-center?err=' + encodeURIComponent(payload.error ?? 'Reload failed'));
    return;
  }
  res.redirect('/control-center?ok=reload');
});
