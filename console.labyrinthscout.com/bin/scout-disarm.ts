#!/usr/bin/env node
/**
 * Server-only CLI command for disarming the global kill switch.
 * This is deliberately NOT reachable via any HTTP endpoint --
 * it must be run via direct server/SSH access only.
 *
 * Usage: node bin/scout-disarm.js --reason "Threat resolved" --admin "admin@example.com"
 */
import { globalKillSwitch } from '../src/killswitch/global-kill-switch.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let reason = '';
  let admin = 'operator';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reason' && args[i + 1]) {
      reason = args[i + 1]!;
      i++;
    } else if (args[i] === '--admin' && args[i + 1]) {
      admin = args[i + 1]!;
      i++;
    }
  }

  if (!reason) {
    console.error('Error: --reason is required');
    console.error('Usage: scout disarm --reason "..." --admin "..."');
    process.exit(1);
  }

  try {
    await globalKillSwitch.loadState();

    if (globalKillSwitch.getState() !== 'TRIGGERED') {
      console.log('Kill switch is already ARMED. No action needed.');
      process.exit(0);
    }

    await globalKillSwitch.disarm(admin, reason);
    console.log('Kill switch disarmed.');
    console.log(`  Disarmed by: ${admin}`);
    console.log(`  Reason: ${reason}`);
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to disarm kill switch:', msg);
    process.exit(1);
  }
}

void main();
