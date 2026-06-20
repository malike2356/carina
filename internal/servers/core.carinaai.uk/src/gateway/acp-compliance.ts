export type AcpComplianceIssue = {
  code: string;
  severity: 'error' | 'warn';
  path: string;
  message: string;
};

export type AcpComplianceReport = {
  ok: boolean;
  protocol: 'acp-v1';
  issues: AcpComplianceIssue[];
  requiredRoutes: string[];
  presentRoutes: string[];
};

const ACP_REQUIRED_ROUTES = [
  'GET /acp/health',
  'GET /acp/sessions',
  'POST /acp/sessions',
  'GET /acp/tools',
  'POST /acp/prompt',
];

const ACP_IDE_REQUIRED_ROUTES = [
  'GET /acp/ide/health',
  'GET /acp/ide/capabilities',
  'POST /acp/ide/chat',
  'POST /acp/ide/tools/invoke',
];

export function validateAcpRouteManifest(manifest: {
  acpRoutes?: string[];
  ideRoutes?: string[];
  enabled?: boolean;
}): AcpComplianceReport {
  const issues: AcpComplianceIssue[] = [];
  const presentRoutes = [...(manifest.acpRoutes ?? []), ...(manifest.ideRoutes ?? [])];

  if (manifest.enabled === false) {
    issues.push({
      code: 'acp.disabled',
      severity: 'warn',
      path: 'CARINA_ACP_ENABLED',
      message: 'ACP bridge is disabled; routes are not mounted',
    });
  }

  for (const route of ACP_REQUIRED_ROUTES) {
    if (!manifest.acpRoutes?.includes(route)) {
      issues.push({
        code: 'acp.route.missing',
        severity: 'error',
        path: route,
        message: `Required ACP route missing: ${route}`,
      });
    }
  }

  for (const route of ACP_IDE_REQUIRED_ROUTES) {
    if (!manifest.ideRoutes?.includes(route)) {
      issues.push({
        code: 'acp.ide.route.missing',
        severity: 'error',
        path: route,
        message: `Required ACP IDE route missing: ${route}`,
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    ok: !hasErrors,
    protocol: 'acp-v1',
    issues,
    requiredRoutes: [...ACP_REQUIRED_ROUTES, ...ACP_IDE_REQUIRED_ROUTES],
    presentRoutes,
  };
}

export function validateAcpHealthPayload(payload: Record<string, unknown>): AcpComplianceIssue[] {
  const issues: AcpComplianceIssue[] = [];
  if (payload.ok !== true) {
    issues.push({
      code: 'acp.health.ok',
      severity: 'error',
      path: '/acp/health',
      message: 'health payload must include ok: true',
    });
  }
  if (payload.protocol !== 'acp-v1') {
    issues.push({
      code: 'acp.health.protocol',
      severity: 'error',
      path: '/acp/health',
      message: 'health payload protocol must be acp-v1',
    });
  }
  if (typeof payload.agent !== 'string' || !payload.agent) {
    issues.push({
      code: 'acp.health.agent',
      severity: 'warn',
      path: '/acp/health',
      message: 'health payload should include agent name',
    });
  }
  return issues;
}

export function validateAcpIdeHealthPayload(payload: Record<string, unknown>): AcpComplianceIssue[] {
  const issues: AcpComplianceIssue[] = [];
  if (payload.ok !== true) {
    issues.push({
      code: 'acp.ide.health.ok',
      severity: 'error',
      path: '/acp/ide/health',
      message: 'IDE health payload must include ok: true',
    });
  }
  if (payload.protocol !== 'acp-ide-v1') {
    issues.push({
      code: 'acp.ide.health.protocol',
      severity: 'error',
      path: '/acp/ide/health',
      message: 'IDE health payload protocol must be acp-ide-v1',
    });
  }
  return issues;
}

export function extractAcpRouteManifestFromSource(acpSource: string, ideSource: string): {
  acpRoutes: string[];
  ideRoutes: string[];
} {
  const acpRoutes: string[] = [];
  const ideRoutes: string[] = [];

  const acpMatchers: Array<[RegExp, string]> = [
    [/acpRouter\.get\('\/health'/, 'GET /acp/health'],
    [/acpRouter\.get\('\/sessions'/, 'GET /acp/sessions'],
    [/acpRouter\.post\('\/sessions'/, 'POST /acp/sessions'],
    [/acpRouter\.get\('\/tools'/, 'GET /acp/tools'],
    [/acpRouter\.post\('\/prompt'/, 'POST /acp/prompt'],
  ];
  for (const [re, label] of acpMatchers) {
    if (re.test(acpSource)) acpRoutes.push(label);
  }

  const ideMatchers: Array<[RegExp, string]> = [
    [/app\.get\('\/acp\/ide\/health'/, 'GET /acp/ide/health'],
    [/app\.get\('\/acp\/ide\/capabilities'/, 'GET /acp/ide/capabilities'],
    [/app\.post\('\/acp\/ide\/chat'/, 'POST /acp/ide/chat'],
    [/app\.post\('\/acp\/ide\/tools\/invoke'/, 'POST /acp/ide/tools/invoke'],
  ];
  for (const [re, label] of ideMatchers) {
    if (re.test(ideSource)) ideRoutes.push(label);
  }

  return { acpRoutes, ideRoutes };
}
