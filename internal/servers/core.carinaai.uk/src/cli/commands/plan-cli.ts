import chalk from 'chalk';
import {
  formatPlanModeAllowlistPreview,
  getPlanModeToolAllowlist,
} from '../../security/plan-mode-allowlist.js';
import {
  isGlobalPlanMode,
  isSessionPlanMode,
  resolvePlanMode,
  setGlobalPlanMode,
  setSessionPlanMode,
} from '../../security/plan-mode-state.js';

function parseSessionFlag(args: string[]): string | undefined {
  const idx = args.indexOf('--session');
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  const eq = args.find((a) => a.startsWith('--session='));
  if (eq) return eq.split('=').slice(1).join('=');
  return undefined;
}

export async function runPlanCommand(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const action = args.find((a) => !a.startsWith('--')) ?? 'status';
  const sessionId = parseSessionFlag(args);

  if (action === 'on') {
    if (sessionId) {
      setSessionPlanMode(sessionId, true);
    } else {
      setGlobalPlanMode(true);
    }
    const payload = {
      planMode: true,
      scope: sessionId ? 'session' : 'global',
      sessionId: sessionId ?? null,
      allowlistSize: getPlanModeToolAllowlist().size,
    };
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(chalk.green(`Plan mode ON (${payload.scope}).`));
    console.log(chalk.gray(`Allowlisted tools: ${getPlanModeToolAllowlist().size}`));
    return;
  }

  if (action === 'off') {
    if (sessionId) {
      setSessionPlanMode(sessionId, false);
    } else {
      setGlobalPlanMode(false);
    }
    const payload = {
      planMode: false,
      scope: sessionId ? 'session' : 'global',
      sessionId: sessionId ?? null,
    };
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(chalk.green(`Plan mode OFF (${payload.scope}).`));
    return;
  }

  if (action === 'status') {
    const active = sessionId
      ? isSessionPlanMode(sessionId)
      : resolvePlanMode({ sessionId, contextPlanMode: isGlobalPlanMode() });
    const payload = {
      planMode: active,
      globalPlanMode: isGlobalPlanMode(),
      sessionPlanMode: sessionId ? isSessionPlanMode(sessionId) : null,
      sessionId: sessionId ?? null,
      allowlistSize: getPlanModeToolAllowlist().size,
      allowlistPreview: formatPlanModeAllowlistPreview(),
    };
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(chalk.bold('\nPlan mode\n'));
    console.log(`  Active: ${active ? chalk.green('ON') : chalk.gray('OFF')}`);
    console.log(`  Global: ${isGlobalPlanMode() ? 'ON' : 'OFF'}`);
    if (sessionId) {
      console.log(`  Session ${sessionId}: ${isSessionPlanMode(sessionId) ? 'ON' : 'OFF'}`);
    }
    console.log(`  Allowlist (${payload.allowlistSize}): ${payload.allowlistPreview}`);
    console.log('');
    console.log(chalk.gray('Usage: carina plan <on|off|status> [--session ID] [--json]'));
    console.log('');
    return;
  }

  console.error('Usage: carina plan <on|off|status> [--session ID] [--json]');
  process.exit(1);
}
