import chalk from 'chalk';
import { buildCapabilityAudit, CAPABILITY_TARGETS } from '../../capabilities/audit.js';
import { buildToolSurfaceCatalog } from '../../tools/tool-surface-catalog.js';

function statusColor(status: string): (text: string) => string {
  if (status === 'met') return chalk.green;
  if (status === 'narrow') return chalk.yellow;
  return chalk.red;
}

export async function runCapabilitiesCommand(action = 'audit', ...rest: string[]): Promise<void> {
  const json = rest.includes('--json');
  const args = rest.filter((a) => a !== '--json');

  if (action === 'audit' || action === 'status') {
    const audit = await buildCapabilityAudit();
    if (json) {
      console.log(JSON.stringify(audit, null, 2));
      return;
    }

    console.log(chalk.bold('\nCarina capability audit\n'));
    const toolColor = statusColor(audit.tools.status);
    const skillColor = statusColor(audit.skills.status);
    const channelColor = statusColor(audit.channels.status);

    console.log(`Targets: tools ${CAPABILITY_TARGETS.tools}+, skills ${CAPABILITY_TARGETS.skills}+, channels ${CAPABILITY_TARGETS.channels}+`);
    console.log(toolColor(`Tools:     ${audit.tools.registered} registered (${audit.tools.status}, gap ${audit.tools.gap})`));
    console.log(skillColor(`Skills:    ${audit.skills.builtin} curated (${audit.skills.status}, gap ${audit.skills.gap}) across ${audit.skills.packs} packs`));
    console.log(channelColor(`Channels:  ${audit.channels.total} catalogued (${audit.channels.status}, gap ${audit.channels.gap})`));
    console.log(chalk.gray(`  connected=${audit.channels.connected} configured=${audit.channels.configured} partial=${audit.channels.partial} disabled=${audit.channels.disabled}`));

    const healthOk = audit.health.toolCatalogComplete && audit.health.skillsIndexed && audit.health.channelDiscoveryReady;
    console.log(healthOk ? chalk.green('\nHealth: catalog complete') : chalk.yellow('\nHealth: gaps remain (see audit --json)'));

    if (audit.tools.missingMetadata.length > 0) {
      console.log(chalk.yellow(`\nTools missing metadata: ${audit.tools.missingMetadata.join(', ')}`));
    }
    return;
  }

  if (action === 'tools') {
    const catalog = buildToolSurfaceCatalog().filter((e) => e.registered);
    if (json) {
      console.log(JSON.stringify(catalog, null, 2));
      return;
    }
    console.log(chalk.bold(`\nRegistered tools (${catalog.length})\n`));
    for (const entry of catalog) {
      console.log(`${entry.name.padEnd(28)} ${entry.category.padEnd(12)} ${entry.purpose.slice(0, 60)}`);
    }
    console.log('');
    return;
  }

  if (action === 'channels') {
    const audit = await buildCapabilityAudit();
    if (json) {
      console.log(JSON.stringify(audit.channels.reports, null, 2));
      return;
    }
    console.log(chalk.bold(`\nChannel catalog (${audit.channels.total})\n`));
    for (const report of audit.channels.reports) {
      const color = report.state === 'connected' ? chalk.green
        : report.state === 'partial' || report.state === 'configured' ? chalk.yellow
          : chalk.gray;
      console.log(`${String(report.channel).padEnd(22)} ${color(report.state.padEnd(12))} ${report.transport ?? ''}`);
    }
    console.log('');
    return;
  }

  if (action === 'gaps') {
    const audit = await buildCapabilityAudit();
    const gaps = {
      tools: audit.tools.gap > 0 ? { gap: audit.tools.gap, unregistered: audit.tools.unregistered } : null,
      skills: audit.skills.gap > 0 ? { gap: audit.skills.gap } : null,
      channels: audit.channels.gap > 0 ? { gap: audit.channels.gap } : null,
      missingToolMetadata: audit.tools.missingMetadata,
    };
    if (json) {
      console.log(JSON.stringify(gaps, null, 2));
      return;
    }
    console.log(chalk.bold('\nCapability gaps\n'));
    if (!gaps.tools && !gaps.skills && !gaps.channels && gaps.missingToolMetadata.length === 0) {
      console.log(chalk.green('No gaps versus targets.'));
      return;
    }
    if (gaps.tools) console.log(`Tools: need ${gaps.tools.gap} more`);
    if (gaps.skills) console.log(`Skills: need ${gaps.skills.gap} more`);
    if (gaps.channels) console.log(`Channels: need ${gaps.channels.gap} more`);
    if (gaps.missingToolMetadata.length) {
      console.log(`Metadata: ${gaps.missingToolMetadata.join(', ')}`);
    }
    console.log('');
    return;
  }

  console.log('Usage: carina capabilities <audit|status|tools|channels|gaps> [--json]');
}
