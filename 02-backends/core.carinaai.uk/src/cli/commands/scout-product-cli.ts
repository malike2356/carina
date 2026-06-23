import chalk from 'chalk';
import {
  addEngineTarget,
  exportEngineCompliance,
  getEngineComplianceScore,
  getEngineFinding,
  getEngineScoutScore,
  getEngineScoutScoreHistory,
  listEngineAgents,
  listEngineAlertRules,
  listEngineTargets,
  resolveScoutEngineConfig,
  ScoutEngineApiError,
  testEngineAlert,
  triggerEngineScan,
} from '../../integrations/scout-engine-api.js';

function requireConfig() {
  const config = resolveScoutEngineConfig();
  if (!config) {
    throw new Error('Scout Engine not configured. Set SCOUT_ENGINE_URL and SCOUT_ENGINE_API_KEY (or SCOUT_API_KEY).');
  }
  return config;
}

export function formatScoutProductCliError(err: unknown): string {
  if (err instanceof ScoutEngineApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function runScoutScoreCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const sub = args[0] ?? 'current';
  if (sub === 'history') {
    const daysIdx = args.indexOf('--days');
    const days = daysIdx >= 0 ? Number.parseInt(args[daysIdx + 1] ?? '30', 10) : 30;
    const rows = await getEngineScoutScoreHistory(config, days);
    if (args.includes('--json')) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    for (const row of rows) {
      console.log(`${row.date}  score=${row.score}`);
    }
    return;
  }

  const score = await getEngineScoutScore(config);
  if (args.includes('--json')) {
    console.log(JSON.stringify(score, null, 2));
    return;
  }
  console.log(chalk.bold('\nScout Score\n'));
  console.log(`  Total: ${chalk.cyan(String(score.score))}`);
  const breakdown = score.breakdown as Record<string, number> | undefined;
  if (breakdown) {
    for (const [key, value] of Object.entries(breakdown)) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

export async function runScoutTargetsCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const action = args[0] ?? 'list';
  if (action === 'list') {
    const targets = await listEngineTargets(config);
    if (args.includes('--json')) {
      console.log(JSON.stringify(targets, null, 2));
      return;
    }
    for (const target of targets) {
      console.log(`${target.id}  ${target.name}  ${target.type}:${target.value}  ${target.enabled ? 'on' : 'off'}`);
    }
    return;
  }

  if (action === 'add') {
    const value = args[1];
    if (!value) throw new Error('Usage: carina scout targets add <domain|url> [--schedule weekly|daily]');
    const scheduleIdx = args.indexOf('--schedule');
    const schedule = scheduleIdx >= 0 ? args[scheduleIdx + 1] ?? 'weekly' : 'weekly';
    const type = value.startsWith('http') ? 'url' : 'domain';
    const target = await addEngineTarget(config, {
      name: value,
      type,
      value: value.replace(/^https?:\/\//, ''),
      schedule,
    });
    console.log(chalk.green(`Target registered: ${target.id}`));
    return;
  }

  if (action === 'scan') {
    const targetId = args[1];
    if (!targetId) throw new Error('Usage: carina scout targets scan <target-id>');
    const result = await triggerEngineScan(config, targetId, args.includes('--fast'));
    console.log(chalk.green(`Scan started: ${result.scan_run_id}`));
    return;
  }

  throw new Error('Usage: carina scout targets <list|add|scan> [args]');
}

export async function runScoutFindingDetailCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const findingId = args[0];
  if (!findingId) throw new Error('Usage: carina scout findings <finding-id>');
  const finding = await getEngineFinding(config, findingId);
  if (args.includes('--json')) {
    console.log(JSON.stringify(finding, null, 2));
    return;
  }
  console.log(chalk.bold(String(finding.title)));
  console.log(`  Severity: ${finding.severity}`);
  console.log(`  Status: ${finding.status}`);
  console.log(`  Host: ${finding.affected_host ?? 'n/a'}`);
  console.log(`  Tool: ${finding.tool_name}`);
  if (finding.description) console.log(`  ${finding.description}`);
}

export async function runScoutAgentsCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const agents = await listEngineAgents(config);
  if (args.includes('--json')) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }
  if (agents.length === 0) {
    console.log('No connected agents.');
    return;
  }
  for (const agent of agents) {
    console.log(`${agent.id}  ${agent.name}  ${agent.status}  ${agent.agent_type ?? agent.agentType ?? ''}`);
  }
}

export async function runScoutAlertsCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const action = args[0] ?? 'list';
  if (action === 'list') {
    const rules = await listEngineAlertRules(config);
    if (args.includes('--json')) {
      console.log(JSON.stringify(rules, null, 2));
      return;
    }
    for (const rule of rules) {
      console.log(`${rule.id}  ${rule.enabled ? 'on' : 'off'}  ${rule.name}`);
    }
    return;
  }

  if (action === 'test') {
    const ruleId = args[1];
    if (!ruleId) throw new Error('Usage: carina scout alerts test <rule-id>');
    const result = await testEngineAlert(config, ruleId);
    console.log(chalk.green(JSON.stringify(result, null, 2)));
    return;
  }

  throw new Error('Usage: carina scout alerts <list|test> [args]');
}

export async function runScoutComplianceCommand(args: string[]): Promise<void> {
  const config = requireConfig();
  const action = args[0] ?? 'status';
  if (action === 'export') {
    const payload = await exportEngineCompliance(config);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const score = await getEngineComplianceScore(config);
  if (args.includes('--json')) {
    console.log(JSON.stringify(score, null, 2));
    return;
  }
  console.log(chalk.bold('\nCompliance\n'));
  console.log(`  Score: ${score.score}%`);
  console.log(`  Controls covered: ${score.controls_covered}/${score.total_controls}`);
}
