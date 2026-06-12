import {
  addApprovalRule,
  grantApproval,
  listApprovalAudit,
  listApprovalGrants,
  listApprovalRules,
  pruneExpiredGrants,
  removeApprovalRule,
  revokeApprovalGrant,
} from '../../security/approval-store.js';
import { toolRiskTier } from '../../security/tool-risk.js';
import { registry } from '../../tools/index.js';

function parseTtlMs(raw: string | undefined, fallbackMs: number): number {
  if (!raw) return fallbackMs;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;
  const match = /^(\d+)(m|h|d)$/i.exec(raw.trim());
  if (!match) return fallbackMs;
  const value = Number(match[1]);
  const unit = match[2]!.toLowerCase();
  if (unit === 'm') return value * 60_000;
  if (unit === 'h') return value * 3_600_000;
  return value * 86_400_000;
}

function printUsage(): void {
  console.log(`Usage: carina approvals <command> [options]

Commands:
  list                     List rules and active grants
  audit                    Recent approval audit entries
  allow [--tool NAME] [--tier low|medium|high|critical] [--profile NAME] [--session ID] [--note TEXT]
  block [--tool NAME] [--tier TIER] [--profile NAME] [--session ID] [--note TEXT]
  grant <tool> [--profile NAME|--session ID] [--ttl 30m|1h|24h] [--params]
  revoke <grant-id>
  rule-rm <rule-id>
  prune                    Remove expired grants
  risk [tool-name]         Show risk tier for a tool
`);
}

export async function runApprovalsCommand(args: string[]): Promise<void> {
  const cmd = args[0];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    printUsage();
    return;
  }

  if (cmd === 'list') {
    const rules = listApprovalRules();
    const grants = listApprovalGrants();
    console.log('Rules:');
    if (rules.length === 0) console.log('  (none)');
    for (const r of rules) {
      console.log(`  ${r.id}  ${r.action}  scope=${r.scope}${r.scopeId ? `:${r.scopeId}` : ''}  tool=${r.tool ?? '*'}  tier=${r.riskTier ?? '*'}`);
    }
    console.log('Active grants:');
    if (grants.length === 0) console.log('  (none)');
    for (const g of grants) {
      console.log(`  ${g.id}  ${g.tool}  ${g.scope}:${g.scopeId}  expires=${g.expiresAt}`);
    }
    return;
  }

  if (cmd === 'audit') {
    for (const e of listApprovalAudit(30)) {
      console.log(`${e.at}  ${e.action}  ${e.tool ?? ''}  ${e.detail ?? ''}`);
    }
    return;
  }

  if (cmd === 'allow' || cmd === 'block') {
    const flags = parseFlags(args.slice(1));
    const scope = flags.session ? 'session' : flags.profile ? 'profile' : 'global';
    addApprovalRule({
      action: cmd,
      scope,
      scopeId: flags.session ?? flags.profile,
      tool: flags.tool,
      riskTier: flags.tier as 'low' | 'medium' | 'high' | 'critical' | undefined,
      note: flags.note,
    });
    console.log(`Added ${cmd} rule (${scope}).`);
    return;
  }

  if (cmd === 'grant') {
    const tool = args[1];
    if (!tool) {
      console.error('grant requires a tool name');
      process.exitCode = 1;
      return;
    }
    const flags = parseFlags(args.slice(2));
    const scope = flags.session ? 'session' : 'profile';
    const scopeId = flags.session ?? flags.profile ?? process.env.CARINA_PROFILE ?? 'default';
    const ttlMs = parseTtlMs(flags.ttl, 3_600_000);
    const entry = grantApproval({
      tool,
      scope,
      scopeId,
      ttlMs,
      params: flags.params ? {} : undefined,
      grantedBy: 'cli',
    });
    console.log(`Granted ${tool} until ${entry.expiresAt} (${entry.id})`);
    return;
  }

  if (cmd === 'revoke') {
    const id = args[1];
    if (!id || !revokeApprovalGrant(id)) {
      console.error('Grant not found');
      process.exitCode = 1;
    } else {
      console.log('Revoked grant');
    }
    return;
  }

  if (cmd === 'rule-rm') {
    const id = args[1];
    if (!id || !removeApprovalRule(id)) {
      console.error('Rule not found');
      process.exitCode = 1;
    } else {
      console.log('Removed rule');
    }
    return;
  }

  if (cmd === 'prune') {
    const n = pruneExpiredGrants();
    console.log(`Removed ${n} expired grant(s)`);
    return;
  }

  if (cmd === 'risk') {
    const name = args[1];
    if (!name) {
      printUsage();
      return;
    }
    const tool = registry.get(name);
    console.log(`${name}: ${toolRiskTier(name, tool)}`);
    return;
  }

  console.error(`Unknown approvals command: ${cmd}`);
  printUsage();
  process.exitCode = 1;
}

function parseFlags(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tool') out.tool = argv[++i];
    else if (a === '--tier') out.tier = argv[++i];
    else if (a === '--profile') out.profile = argv[++i];
    else if (a === '--session') out.session = argv[++i];
    else if (a === '--note') out.note = argv[++i];
    else if (a === '--ttl') out.ttl = argv[++i];
    else if (a === '--params') out.params = 'true';
  }
  return out;
}
