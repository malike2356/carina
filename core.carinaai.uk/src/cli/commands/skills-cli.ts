import chalk from 'chalk';
import { listCuratedSkills } from '../../skills/curator.js';
import { initDb } from '../../memory/db.js';
import {
  buildSkillIndex,
  refreshSkillRuntime,
  scanSkillSecurity,
  formatSkillSecurityScan,
  validateSkillDocument,
  formatSkillValidation,
} from '../../skills/index.js';

export async function runSkillsCommand(action = 'list', args: string[] = []): Promise<void> {
  await initDb();

  if (action === 'list') {
    const active = await listCuratedSkills('active');
    const archived = await listCuratedSkills('archived');
    console.log(chalk.bold(`\nSkills: ${active.length} active, ${archived.length} archived\n`));
    for (const s of active.slice(0, 30)) {
      console.log(`  ${s.name.padEnd(28)} uses=${s.usageCount}  ${s.description.slice(0, 50)}`);
    }
    if (active.length > 30) console.log(`  ... and ${active.length - 30} more`);
    console.log('');
    return;
  }

  if (action === 'index') {
    const platform = args.find((a, i) => args[i - 1] === '--platform');
    const index = await buildSkillIndex({ platform });
    console.log(chalk.bold(`\nSkill index (${index.length} entries)\n`));
    for (const entry of index.slice(0, 50)) {
      const gate = entry.gated ? chalk.yellow(' gated') : '';
      const version = entry.version ? chalk.gray(` v${entry.version}`) : '';
      console.log(
        `  ${entry.name.padEnd(28)} ${entry.source.padEnd(10)}${version}${gate}  ${entry.description.slice(0, 40)}`,
      );
      if (entry.gateReason) console.log(chalk.gray(`      gate: ${entry.gateReason}`));
      if (entry.securityWarnings.length > 0) {
        console.log(chalk.yellow(`      security: ${entry.securityWarnings.join(', ')}`));
      }
    }
    if (index.length > 50) console.log(`  ... and ${index.length - 50} more`);
    console.log('');
    return;
  }

  if (action === 'refresh') {
    const platform = args.find((a, i) => args[i - 1] === '--platform');
    const report = await refreshSkillRuntime({ platform });
    console.log(chalk.bold('\nSkills refreshed\n'));
    console.log(`  packs loaded:      ${report.packsLoaded}`);
    console.log(`  SKILL.md loaded:   ${report.skillMdLoaded}`);
    console.log(`  user skills:       ${report.userSkillsLoaded}`);
    console.log(`  knowledge chunks:  ${report.userKnowledgeChunks}`);
    console.log(`  index size:        ${report.indexSize}`);
    console.log(`  at:                ${report.refreshedAt}`);
    console.log('');
    return;
  }

  if (action === 'audit') {
    const name = args[0];
    if (!name) {
      console.error('Usage: carina skills audit <skill-name>');
      process.exit(1);
    }
    const active = await listCuratedSkills('active');
    const skill = active.find((s) => s.name === name);
    if (!skill) {
      console.error(`Skill not found: ${name}`);
      process.exit(1);
    }
    const validation = validateSkillDocument({
      name: skill.name,
      description: skill.description,
      trigger: skill.trigger,
      steps: skill.steps,
      toolsUsed: skill.toolsUsed,
    });
    const security = scanSkillSecurity(skill);
    console.log(chalk.bold(`\nAudit: ${name}\n`));
    console.log(validation.ok ? chalk.green('Validation: passed') : chalk.red('Validation: failed'));
    if (!validation.ok) console.log(formatSkillValidation(validation));
    console.log(security.ok ? chalk.green('Security: passed') : chalk.yellow('Security: warnings'));
    if (security.issues.length > 0) console.log(formatSkillSecurityScan(security));
    console.log('');
    return;
  }

  console.error('Usage: carina skills <list|index|refresh|audit> [args]');
  process.exit(1);
}
