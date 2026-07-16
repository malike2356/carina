import chalk from 'chalk';
import fs from 'node:fs/promises';
import { loadLocalEnv } from '../config/env.js';

export async function runGovernanceCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';
  const json = args.includes('--json');

  const {
    buildGovernanceStatus,
    evaluateGovernancePermission,
    formatGovernanceStatus,
    formatPolicyEvaluations,
    formatTrustFramework,
    governanceAuditTrail,
    governanceSsoSummary,
    isGovernanceEnabled,
    loadPolicies,
    runGovernancePolicyReview,
  } = await import('../../security/governance/index.js');

  if (!isGovernanceEnabled()) {
    console.log(chalk.yellow('Enterprise governance disabled (CARINA_GOVERNANCE_ENABLED=false).'));
    return;
  }

  if (action === 'status') {
    const status = await buildGovernanceStatus();
    if (json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(formatGovernanceStatus(status));
    }
    return;
  }

  if (action === 'audit') {
    const limitArg = args.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
      ?? (args.includes('--limit') ? args[args.indexOf('--limit') + 1] : '50');
    const limit = Number(limitArg) || 50;
    const rows = await governanceAuditTrail.search({ limit });
    const verification = await governanceAuditTrail.verify();
    const exportArg = args.find((arg) => arg.startsWith('--export='))?.split('=')[1];
    if (exportArg?.endsWith('.csv')) {
      const csv = await governanceAuditTrail.exportCsv(limit);
      await fs.writeFile(exportArg, csv, 'utf8');
      console.log(chalk.green(`Audit trail exported to ${exportArg}`));
      return;
    }
    if (json) {
      console.log(JSON.stringify({ verification, rows }, null, 2));
    } else {
      console.log(chalk.bold(`Audit chain valid: ${verification.valid} (${verification.events} events)`));
      for (const row of rows.slice(-20)) {
        console.log(`  ${new Date(row.timestamp).toISOString()} [${row.outcome}] ${row.actor.role} ${row.action.resource}:${row.action.type}`);
      }
    }
    return;
  }

  if (action === 'policies') {
    const policies = await loadPolicies();
    if (json) {
      console.log(JSON.stringify(policies, null, 2));
    } else {
      console.log(chalk.bold(`Governance policies (${policies.length})`));
      for (const policy of policies) {
        console.log(`  ${policy.id}: ${policy.name} [${policy.enforcement}]`);
      }
    }
    return;
  }

  if (action === 'trust') {
    const { buildTrustFramework } = await import('../../security/governance/index.js');
    const trust = await buildTrustFramework();
    if (json) {
      console.log(JSON.stringify(trust, null, 2));
    } else {
      console.log(formatTrustFramework(trust));
    }
    return;
  }

  if (action === 'rbac') {
    const role = args[1];
    const resource = args[2];
    const permAction = args[3] as 'read' | 'execute' | undefined;
    if (!role || !resource || !permAction) {
      console.error('Usage: carina governance rbac <role> <resource> <action> [--json]');
      process.exit(1);
    }
    const decision = evaluateGovernancePermission({
      role: role as import('../../security/governance/types.js').GovernanceRole,
      resource,
      action: permAction,
    });
    if (json) {
      console.log(JSON.stringify(decision, null, 2));
    } else {
      console.log(decision.allowed ? chalk.green('allowed') : chalk.red('denied'));
      if (decision.reason) console.log(decision.reason);
    }
    if (!decision.allowed) process.exit(1);
    return;
  }

  if (action === 'evaluate') {
    const role = args.find((arg) => arg.startsWith('--role='))?.split('=')[1] as import('../../security/governance/types.js').GovernanceRole | undefined;
    const mfaEnabled = !args.includes('--no-mfa');
    const review = await runGovernancePolicyReview({
      role,
      mfaEnabled,
      action: args.includes('--install-tool') ? 'install_tool' : undefined,
      reviewed: args.includes('--reviewed'),
      inactivityMs: args.includes('--inactive') ? 4_000_000 : 0,
      resource: args.find((arg) => arg.startsWith('--resource='))?.split('=')[1],
    });
    if (json) {
      console.log(JSON.stringify(review, null, 2));
    } else {
      console.log(formatPolicyEvaluations(review.evaluations));
    }
    if (review.blocked) process.exit(1);
    return;
  }

  if (action === 'sso') {
    const summary = governanceSsoSummary();
    if (json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`SSO protocols: ${summary.supportedProtocols.join(', ')}`);
      console.log(`Providers configured: ${summary.providersConfigured}`);
      console.log(`JIT provisioning: ${summary.jitProvisioning}`);
      console.log(`SCIM: ${summary.scimSupported}`);
      console.log(`ABAC: ${summary.abacSupported}`);
    }
    return;
  }

  console.error('Usage: carina governance <status|audit|policies|trust|rbac|evaluate|sso> [--json] [--limit=N] [--export=path.csv]');
  process.exit(1);
}
