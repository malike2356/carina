import fs from 'fs';
import { CARINA_HOME } from '../config/paths.js';
import { approvalPolicyEnabled } from './approval-policy.js';
import { allowlistFirstState } from './admin-tool-policy.js';
import { authRateLimitEnabled } from './auth-rate-limit.js';
import { isAllowlistEnforced } from './kill-switch-listener.js';

export type SecurityDoctorCheck = {
  id: string;
  name: string;
  severity: 'ok' | 'warn' | 'fail';
  detail: string;
};

export function collectSecurityDoctorChecks(): SecurityDoctorCheck[] {
  const checks: SecurityDoctorCheck[] = [];
  const isProd = process.env.NODE_ENV === 'production';
  const labyrinth = process.env.LABYRINTH_ENABLED === 'true';

  const push = (
    id: string,
    name: string,
    severity: SecurityDoctorCheck['severity'],
    detail: string,
  ): void => {
    checks.push({ id, name, severity, detail });
  };

  push(
    'approval-policy',
    'Approval policy',
    approvalPolicyEnabled() ? 'ok' : 'warn',
    approvalPolicyEnabled()
      ? 'enabled (CARINA_APPROVAL_POLICY not off)'
      : 'disabled; dangerous tools may run without explicit approval rules',
  );

  const allowlist = allowlistFirstState();
  push(
    'allowlist-first',
    'Allowlist-first tools',
    labyrinth && !allowlist.enforced && isProd ? 'fail' : labyrinth && !allowlist.enforced ? 'warn' : 'ok',
    allowlist.note,
  );

  if (labyrinth && isAllowlistEnforced()) {
    push('allowlist-active', 'Scout allowlist enforcement', 'ok', 'SCOUT_ENFORCE_ALLOWLIST=true');
  }

  push(
    'auth-rate-limit',
    'Auth rate limiting',
    authRateLimitEnabled() ? 'ok' : 'warn',
    authRateLimitEnabled()
      ? 'enabled (set CARINA_AUTH_RATE_LIMIT=off to disable)'
      : 'disabled via CARINA_AUTH_RATE_LIMIT=off',
  );

  const webPassword = process.env.CARINA_WEB_PASSWORD ?? '';
  push(
    'local-web-auth',
    'Local web password',
    isProd && !webPassword ? 'fail' : webPassword.length >= 12 ? 'ok' : webPassword ? 'warn' : 'warn',
    webPassword
      ? webPassword.length >= 12
        ? 'CARINA_WEB_PASSWORD set'
        : 'password shorter than 12 characters'
      : 'CARINA_WEB_PASSWORD not set',
  );

  const approvalsPath = `${CARINA_HOME}/approvals.json`;
  push(
    'approval-store',
    'Approval store file',
    fs.existsSync(approvalsPath) ? 'ok' : 'warn',
    fs.existsSync(approvalsPath) ? approvalsPath : 'no approvals.json yet (created on first rule)',
  );

  push(
    'egress-filter',
    'Egress filter',
    process.env.CARINA_EGRESS_FILTER === 'true' ? 'ok' : labyrinth ? 'warn' : 'ok',
    process.env.CARINA_EGRESS_FILTER === 'true'
      ? 'CARINA_EGRESS_FILTER=true'
      : labyrinth
        ? 'recommended when LABYRINTH_ENABLED=true'
        : 'optional until Scout egress is required',
  );

  push(
    'prompt-guard',
    'Prompt guard default',
    process.env.CARINA_PROMPT_GUARD === 'false' ? 'warn' : 'ok',
    process.env.CARINA_PROMPT_GUARD === 'false' ? 'disabled' : 'enabled by default',
  );

  return checks;
}
