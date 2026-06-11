import chalk from 'chalk';
import { initDb } from '../../memory/db.js';
import {
  archiveSkill,
  listCuratedSkills,
  pruneStaleSkills,
  restoreSkill,
  type SkillStatus,
} from '../../skills/curator.js';
import {
  buildCuratorReviewReport,
  writeCuratorReviewReport,
} from '../../skills/curator-report.js';
import { bindOperatorProfile } from '../../ops/operator-profile.js';

function parseProfileFlag(args: string[]): { profile?: string; rest: string[] } {
  const rest: string[] = [];
  let profile: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[++i];
    } else {
      rest.push(args[i]!);
    }
  }
  return { profile, rest };
}

export async function runCuratorCommand(args: string[]): Promise<void> {
  const { profile, rest } = parseProfileFlag(args);
  const ctx = bindOperatorProfile(profile);
  await initDb();

  const action = rest[0] ?? 'report';

  if (action === 'report') {
    const asJson = rest.includes('--json');
    const report = await buildCuratorReviewReport();
    const paths = await writeCuratorReviewReport(ctx.reportsDir, report);
    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(chalk.bold(`\nCurator review (profile: ${ctx.profileName})\n`));
    console.log(`  active: ${report.summary.active}`);
    console.log(`  archived: ${report.summary.archived}`);
    console.log(`  pruned: ${report.summary.pruned}`);
    console.log(`  stale candidates: ${report.summary.staleCandidates}`);
    if (report.staleCandidates.length > 0) {
      console.log(chalk.yellow('\n  Stale candidates:'));
      for (const s of report.staleCandidates.slice(0, 15)) {
        console.log(`    ${s.name}  uses=${s.usageCount}`);
      }
    }
    if (report.recommendations.length > 0) {
      console.log(chalk.cyan('\n  Recommendations:'));
      for (const r of report.recommendations) console.log(`    - ${r}`);
    }
    console.log(chalk.gray(`\n  Report: ${paths.latestPath}\n`));
    return;
  }

  if (action === 'list') {
    const status = (rest[1] ?? 'active') as SkillStatus;
    const skills = await listCuratedSkills(status);
    console.log(chalk.bold(`\n${status} skills (${skills.length})\n`));
    for (const s of skills) {
      console.log(`  ${s.name.padEnd(28)} uses=${String(s.usageCount).padStart(4)}  ${s.description.slice(0, 60)}`);
    }
    console.log('');
    return;
  }

  if (action === 'prune') {
    const dryRun = rest.includes('--dry-run');
    const result = await pruneStaleSkills({ dryRun });
    console.log(dryRun
      ? `Dry run: ${result.candidates.length} candidate(s)`
      : `Pruned: ${result.pruned.length} skill(s)`);
    if (result.candidates.length > 0) {
      for (const name of result.candidates) console.log(`  ${name}`);
    }
    return;
  }

  if (action === 'archive') {
    const name = rest[1];
    if (!name) {
      console.error('Usage: carina curator archive <name> [--reason text]');
      process.exit(1);
    }
    const reasonIdx = rest.indexOf('--reason');
    const reason = reasonIdx >= 0 ? rest[reasonIdx + 1] : undefined;
    const ok = await archiveSkill(name, reason);
    console.log(ok ? `Archived: ${name}` : `Not found or already archived: ${name}`);
    return;
  }

  if (action === 'restore') {
    const name = rest[1];
    if (!name) {
      console.error('Usage: carina curator restore <name>');
      process.exit(1);
    }
    const ok = await restoreSkill(name);
    console.log(ok ? `Restored: ${name}` : `Not found: ${name}`);
    return;
  }

  if (action === 'run') {
    const report = await buildCuratorReviewReport();
    await writeCuratorReviewReport(ctx.reportsDir, report);
    const result = await pruneStaleSkills({});
    console.log(`Curator run complete. Pruned ${result.pruned.length}. Report: ${ctx.reportsDir}/latest.json`);
    return;
  }

  console.error(`Usage: carina curator <report|list|prune|archive|restore|run> [--profile NAME]`);
  process.exit(1);
}
