import { maybeBootstrapHostedAccount, upsertHostedUser } from '../../api/hosted-auth.js';
import { pool } from '../../memory/db.js';

export async function runHostedCommand(args: string[]): Promise<void> {
  const sub = args[0];

  if (sub === 'reset-password') {
    const email = args[1];
    const password = args[2];

    if (!email || !password) {
      console.error('Usage: carina hosted reset-password <email> <password>');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('Error: password must be at least 8 characters');
      process.exit(1);
    }

    try {
      await upsertHostedUser(email, password);
      console.log(`Account ready: ${email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    } finally {
      await pool.end();
    }
    return;
  }

  if (sub === 'bootstrap') {
    const forceReset = args.includes('--reset');
    try {
      await maybeBootstrapHostedAccount(forceReset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    } finally {
      await pool.end();
    }
    return;
  }

  console.error(`Unknown hosted subcommand: ${sub ?? '(none)'}`);
  console.error('Available:');
  console.error('  reset-password <email> <password>  - set or create an account with a specific password');
  console.error('  bootstrap                           - apply HOSTED_BOOTSTRAP_EMAIL/PASSWORD from env');
  console.error('  bootstrap --reset                   - force-reset the bootstrap account password from env');
  process.exit(1);
}
