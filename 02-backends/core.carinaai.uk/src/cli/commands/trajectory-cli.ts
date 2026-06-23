import chalk from 'chalk';
import { getTrajectoryRecorder } from '../../agents/trajectory-recorder.js';

export async function runTrajectoryCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const target = args[1];
  const recorder = getTrajectoryRecorder();

  if (action === 'start') {
    const sessionId = target ?? 'cli-session';
    const bundle = recorder.startBundle(sessionId, 'cli');
    console.log(chalk.green(`Trajectory recording started: ${bundle.bundleId} (${sessionId})`));
    return;
  }

  if (action === 'stop') {
    const sessionId = target ?? 'cli-session';
    const bundle = recorder.completeBundle(sessionId);
    if (!bundle) {
      console.error('No active trajectory for that session.');
      process.exit(1);
    }
    console.log(chalk.green(`Trajectory archived: ${bundle.bundleId} (${bundle.steps.length} steps)`));
    return;
  }

  if (action === 'show') {
    const sessionId = target ?? 'cli-session';
    const bundle = recorder.getBundle(sessionId);
    if (!bundle) {
      console.error('Trajectory not found.');
      process.exit(1);
    }
    console.log(JSON.stringify(bundle, null, 2));
    return;
  }

  if (action === 'export') {
    if (!target) {
      console.error('Usage: carina trajectory export <bundleId>');
      process.exit(1);
    }
    console.log(recorder.exportBundle(target));
    return;
  }

  if (action === 'list') {
    const bundles = recorder.listRecent(20);
    if (bundles.length === 0) {
      console.log('No trajectory bundles recorded yet.');
      return;
    }
    for (const bundle of bundles) {
      console.log(`${bundle.bundleId}  ${bundle.sessionId.slice(0, 8)}  ${bundle.metadata.totalToolCalls} tools  ${bundle.steps.length} steps`);
    }
    return;
  }

  console.error('Usage: carina trajectory <start|stop|show|export|list> [sessionId|bundleId]');
  process.exit(1);
}
