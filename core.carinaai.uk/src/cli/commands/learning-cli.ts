import chalk from 'chalk';
import { initDb } from '../../memory/db.js';
import {
  getLearningLoopMetrics,
  listAcceptedImprovements,
  listLearnedPreferences,
  listPendingCorrections,
  rollbackSkillByName,
} from '../../skills/learning-ops.js';
import { listLearningEvents, replayLearningEvent } from '../../skills/learning-events.js';
import { listSkillVersions } from '../../skills/skill-versions.js';
import { getSkillByName } from '../../skills/store.js';
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

export async function runLearningCommand(args: string[]): Promise<void> {
  const { profile, rest } = parseProfileFlag(args);
  bindOperatorProfile(profile);
  await initDb();

  const action = rest[0] ?? 'status';
  const tenantId = process.env.CARINA_TENANT_ID ?? '__operator__';

  if (action === 'status') {
    const asJson = rest.includes('--json');
    const metrics = await getLearningLoopMetrics(tenantId);
    if (asJson) {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }
    console.log(chalk.bold('\nLearning loop status\n'));
    console.log(`  auto skill capture: ${metrics.autoSkillEnabled ? 'on' : 'off'}`);
    console.log(`  task outcome indexing: ${process.env.CARINA_TASK_OUTCOMES !== 'false' ? 'on' : 'off'}`);
    console.log(`  skill workshop: ${process.env.CARINA_SKILL_WORKSHOP === 'true' ? 'on' : 'off'}`);
    console.log(`  curator scheduler: ${metrics.curatorEnabled ? 'on' : 'off'}`);
    console.log(`  events (24h): ${metrics.eventsLast24h}`);
    console.log(`  corrections (24h): ${metrics.correctionsLast24h}`);
    console.log(`  drafts pending: ${metrics.draftsPending}`);
    console.log(`  promotions (7d): ${metrics.promotionsLast7d}`);
    console.log(`  preferences learned: ${metrics.preferencesLearnedTotal}`);
    console.log(`  last preference: ${metrics.lastPreferenceLearnedAt ?? 'never'}`);
    console.log(`  last curator run: ${metrics.lastCuratorRunAt ?? 'never'}`);
    console.log(chalk.gray('\n  Recap: carina learning recap'));
    console.log(chalk.gray('  Find prior work: carina memory sessions search "<topic>"\n'));
    return;
  }

  if (action === 'recap') {
    const days = Number(rest.find((a) => a.startsWith('--days='))?.split('=')[1] ?? '7');
    const { buildLearningRecap, formatLearningRecap } = await import('../../skills/learning-recap.js');
    const recap = await buildLearningRecap(tenantId, { days });
    if (rest.includes('--json')) {
      console.log(JSON.stringify(recap, null, 2));
      return;
    }
    console.log(chalk.bold(`\n${formatLearningRecap(recap)}\n`));
    return;
  }

  if (action === 'events') {
    const limit = Number(rest.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '30');
    const events = await listLearningEvents({ tenantId, limit });
    const asJson = rest.includes('--json');
    if (asJson) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }
    console.log(chalk.bold(`\nLearning events (${events.length})\n`));
    for (const e of events) {
      const skill = e.skillName ? ` skill=${e.skillName}` : '';
      console.log(`  ${e.createdAt}  ${e.eventType}${skill}`);
    }
    console.log('');
    return;
  }

  if (action === 'pending') {
    const rows = await listPendingCorrections(tenantId);
    const asJson = rest.includes('--json');
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nPending corrections and drafts (${rows.length})\n`));
    for (const row of rows) {
      console.log(`  ${row.skillName.padEnd(28)} ${row.source.padEnd(16)} uses=${row.usageCount}`);
    }
    console.log('');
    return;
  }

  if (action === 'preferences') {
    const rows = await listLearnedPreferences(tenantId);
    const asJson = rest.includes('--json');
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nLearned preferences (${rows.length})\n`));
    for (const row of rows) {
      const conf = row.confidence == null ? '' : `  confidence=${row.confidence.toFixed(2)}`;
      console.log(`  ${row.learnedAt}  [${row.action}]  ${row.preference}${conf}`);
    }
    console.log('');
    return;
  }

  if (action === 'improvements') {
    const rows = await listAcceptedImprovements(tenantId);
    const asJson = rest.includes('--json');
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nAccepted improvements (${rows.length})\n`));
    for (const row of rows) {
      console.log(`  ${row.createdAt}  ${row.eventType}  ${row.skillName}`);
    }
    console.log('');
    return;
  }

  if (action === 'show') {
    const eventId = rest[1];
    if (!eventId) {
      console.error('Usage: carina learning show <event-id>');
      process.exit(1);
    }
    const { event, internalNotes } = await replayLearningEvent(eventId);
    if (!event) {
      console.error(`Event not found: ${eventId}`);
      process.exit(1);
    }
    console.log(JSON.stringify({ event, internalNotes }, null, 2));
    return;
  }

  if (action === 'versions') {
    const skillName = rest[1];
    if (!skillName) {
      console.error('Usage: carina learning versions <skill-name>');
      process.exit(1);
    }
    const skill = await getSkillByName(skillName);
    if (!skill) {
      console.error(`Skill not found: ${skillName}`);
      process.exit(1);
    }
    const versions = await listSkillVersions(skill.id, 30);
    console.log(chalk.bold(`\nVersions for ${skillName}\n`));
    for (const v of versions) {
      console.log(`  v${v.version}  ${v.createdAt}  source=${v.source}`);
    }
    console.log('');
    return;
  }

  if (action === 'rollback') {
    const skillName = rest[1];
    const version = Number(rest[2]);
    if (!skillName || !Number.isFinite(version)) {
      console.error('Usage: carina learning rollback <skill-name> <version> [--reason text]');
      process.exit(1);
    }
    const reasonIdx = rest.indexOf('--reason');
    const reason = reasonIdx >= 0 ? rest[reasonIdx + 1] : undefined;
    const result = await rollbackSkillByName(skillName, version, { tenantId, reason });
    if (!result.ok) {
      console.error(result.message);
      process.exit(1);
    }
    console.log(result.message);
    return;
  }

  if (action === 'shared') {
    const { listSharedSkillsForAgent } = await import('../../skills/cross-agent-learning.js');
    const agentId = rest[1] ?? process.env.CARINA_ACTIVE_AGENT ?? 'main';
    const rows = await listSharedSkillsForAgent(agentId);
    if (rest.includes('--json')) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nShared skills for ${agentId} (${rows.length})\n`));
    for (const row of rows) {
      console.log(`  ${row.skillName}  from ${row.sourceAgentId}  targets=${row.targetAgentIds.join(',')}`);
    }
    console.log('');
    return;
  }

  if (action === 'share') {
    const { listSharedSkillsForAgent } = await import('../../skills/cross-agent-learning.js');
    const { exportSharedSkillsBundle, publishSharedSkillsToHub } = await import('../../skills/cross-agent-hub-sync.js');
    const agentId = rest[1] ?? process.env.CARINA_ACTIVE_AGENT ?? 'main';
    const rows = await listSharedSkillsForAgent(agentId);
    const bundle = await exportSharedSkillsBundle(rows);
    if (rest.includes('--json')) {
      console.log(JSON.stringify(bundle, null, 2));
      return;
    }
    console.log(chalk.green(`Exported ${bundle.skills.length} shared skill(s) to ${process.env.CARINA_HOME ?? '~/.carina'}/shared-skills-export.json`));
    if (rest.includes('--publish')) {
      const result = await publishSharedSkillsToHub(bundle);
      console.log(chalk.green(`Published ${result.published} skill(s) to ${result.url}`));
    }
    return;
  }

  if (action === 'sync') {
    const { syncSharedSkillsFromHub } = await import('../../skills/cross-agent-hub-sync.js');
    try {
      const result = await syncSharedSkillsFromHub();
      if (rest.includes('--json')) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(chalk.green(`Synced ${result.merged} new skill(s) from hub (${result.total} total in index)`));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  console.error(
    'Usage: carina learning <status|recap|events|pending|preferences|improvements|show|versions|rollback|shared|share|sync> [--profile NAME] [--json] [--days=N]',
  );
  process.exit(1);
}
