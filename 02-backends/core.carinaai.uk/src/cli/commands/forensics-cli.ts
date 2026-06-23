#!/usr/bin/env tsx
import chalk from 'chalk';
import { loadLocalEnv } from '../config/env.js';
import { forensicsEngine } from '../../security/forensics/engine.js';
import { formatForensicReportMarkdown } from '../../security/forensics/export.js';
import { FORENSIC_PLAYBOOKS } from '../../security/forensics/playbooks.js';

function parseFormatArg(args: string[]): 'json' | 'csv' | 'markdown' | 'all' {
  const raw = args.find((arg) => arg.startsWith('--format='))?.split('=')[1]
    ?? (args.includes('--format') ? args[args.indexOf('--format') + 1] : 'all');
  if (raw === 'json' || raw === 'csv' || raw === 'markdown' || raw === 'all') return raw;
  return 'all';
}

export async function runForensicsCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'list';
  const json = args.includes('--json');

  if (action === 'list') {
    const incidents = await forensicsEngine.listIncidents();
    if (json) {
      console.log(JSON.stringify(incidents, null, 2));
      return;
    }
    console.log(chalk.bold('\nForensic incidents\n'));
    if (incidents.length === 0) {
      console.log('  No incidents recorded.');
    } else {
      for (const row of incidents) {
        console.log(`  [${row.severity}] ${row.id} ${row.title} (${row.status})`);
      }
    }
    console.log('');
    return;
  }

  if (action === 'snapshot') {
    const incidentId = args[1];
    if (!incidentId) {
      console.error('Usage: carina forensics snapshot <incidentId> [--session ID] [--json]');
      process.exit(1);
    }
    const sessionId = args.find((arg) => arg.startsWith('--session='))?.split('=')[1]
      ?? (args.includes('--session') ? args[args.indexOf('--session') + 1] : undefined);
    const snapshot = await forensicsEngine.captureSnapshot(incidentId, { sessionId });
    if (json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log(chalk.green(`Snapshot captured: ${snapshot.id}`));
      console.log(chalk.gray(`Hash: ${snapshot.hash}`));
    }
    return;
  }

  if (action === 'timeline') {
    const incidentId = args[1];
    if (!incidentId) {
      console.error('Usage: carina forensics timeline <incidentId> [--json]');
      process.exit(1);
    }
    const timeline = await forensicsEngine.reconstructTimeline(incidentId);
    if (json) {
      console.log(JSON.stringify(timeline, null, 2));
    } else {
      console.log(chalk.bold(`\nTimeline for ${incidentId} (${timeline.length} events)\n`));
      for (const event of timeline.slice(0, 50)) {
        console.log(`  ${new Date(event.timestamp).toISOString()} [${event.severity}] ${event.description}`);
      }
      console.log('');
    }
    return;
  }

  if (action === 'report') {
    const incidentId = args[1];
    if (!incidentId) {
      console.error('Usage: carina forensics report <incidentId> [--json] [--output path.md]');
      process.exit(1);
    }
    const report = await forensicsEngine.generateReport(incidentId);
    const markdown = formatForensicReportMarkdown(report);
    const output = args.find((arg) => arg.startsWith('--output='))?.split('=')[1];
    if (output) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(output, markdown, 'utf8');
      console.log(chalk.green(`Report written to ${output}`));
      return;
    }
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(markdown);
    }
    return;
  }

  if (action === 'export') {
    const incidentId = args[1];
    if (!incidentId) {
      console.error('Usage: carina forensics export <incidentId> [--format json|csv|markdown|all]');
      process.exit(1);
    }
    const files = await forensicsEngine.exportEvidence(incidentId, parseFormatArg(args));
    if (json) {
      console.log(JSON.stringify({ incidentId, files }, null, 2));
    } else {
      console.log(chalk.green('Export complete:'));
      for (const file of files) console.log(chalk.gray(`  ${file}`));
    }
    return;
  }

  if (action === 'verify') {
    const verification = await forensicsEngine.verifyCustody();
    if (json) {
      console.log(JSON.stringify(verification, null, 2));
    } else {
      console.log(verification.valid
        ? chalk.green('Chain of custody intact')
        : chalk.red(`Chain of custody broken at record ${verification.brokenAt}`));
    }
    if (!verification.valid) process.exit(1);
    return;
  }

  if (action === 'playbook') {
    const name = args[1];
    if (!name) {
      if (json) {
        console.log(JSON.stringify(FORENSIC_PLAYBOOKS, null, 2));
      } else {
        console.log(chalk.bold('\nForensics playbooks\n'));
        for (const row of FORENSIC_PLAYBOOKS) {
          console.log(`  ${row.id}: ${row.name} (${row.steps.length} steps)`);
        }
        console.log('');
      }
      return;
    }
    const playbook = forensicsEngine.getPlaybook(name);
    if (!playbook) {
      console.error(`Unknown playbook: ${name}`);
      process.exit(1);
    }
    if (json) {
      console.log(JSON.stringify(playbook, null, 2));
    } else {
      console.log(chalk.bold(`\n${playbook.name}\n`));
      for (const step of playbook.steps) {
        console.log(`  ${step.order}. [${step.action}] ${step.description}${step.automated ? '' : ' (manual)'}`);
      }
      console.log('');
    }
    return;
  }

  if (action === 'run') {
    const playbookId = args[1];
    const incidentId = args[2];
    if (!playbookId || !incidentId) {
      console.error('Usage: carina forensics run <playbook> <incidentId> [--session ID] [--json]');
      process.exit(1);
    }
    const sessionId = args.find((arg) => arg.startsWith('--session='))?.split('=')[1]
      ?? (args.includes('--session') ? args[args.indexOf('--session') + 1] : undefined);
    const execution = await forensicsEngine.runPlaybook(playbookId, { incidentId, sessionId });
    if (json) {
      console.log(JSON.stringify(execution, null, 2));
    } else {
      console.log(chalk.green(`Playbook ${playbookId} ${execution.status}`));
      for (const line of execution.log) console.log(chalk.gray(`  ${line}`));
    }
    return;
  }

  if (action === 'open') {
    const eventType = args.find((arg) => arg.startsWith('--event='))?.split('=')[1] ?? args[1];
    if (!eventType) {
      console.error('Usage: carina forensics open --event prompt_injection [--session ID] [--title text] [--json]');
      process.exit(1);
    }
    const sessionId = args.find((arg) => arg.startsWith('--session='))?.split('=')[1]
      ?? (args.includes('--session') ? args[args.indexOf('--session') + 1] : undefined);
    const title = args.find((arg) => arg.startsWith('--title='))?.split('=')[1] ?? `Security event: ${eventType}`;
    const result = await forensicsEngine.openFromSecurityEvent({
      eventType,
      title,
      sessionId,
      autoRunPlaybook: !args.includes('--no-playbook'),
    });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(chalk.green(`Incident opened: ${result.incident.id}`));
      if (result.execution) {
        console.log(chalk.gray(`Playbook ${result.execution.playbookId}: ${result.execution.status}`));
      }
    }
    return;
  }

  console.error('Usage: carina forensics <list|snapshot|timeline|report|export|verify|playbook|run|open> ...');
  process.exit(1);
}
