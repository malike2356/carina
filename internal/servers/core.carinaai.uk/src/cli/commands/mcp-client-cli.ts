import chalk from 'chalk';
import { connectMcpFromUserInput, diagnoseMcpEnvironment } from '../../mcp/connect-helper.js';
import { readMcpServers, removeMcpServer } from '../../mcp/config.js';
import { disconnectServer, listConnections } from '../../mcp/registry.js';
import { getMcpSecurityManager } from '../../mcp/security.js';

export async function runMcpClientCommand(action: string, args: string[] = []): Promise<void> {
  const json = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--') && a !== '-y');
  const autoYes = args.includes('-y') || args.includes('--yes');

  if (action === 'connect') {
    const source = positional[0];
    const name = positional[1];
    if (!source) {
      console.error('Usage: carina mcp connect <url-or-package> [name]');
      process.exit(1);
    }
    if (!autoYes) {
      console.log(chalk.yellow('WARNING: MCP tools may access filesystem, network, or shell resources.'));
    }
    const result = await connectMcpFromUserInput(source, name);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(chalk.green(`Connected ${result.name} with ${result.tools.length} tools`));
    for (const tool of result.tools) console.log(`  ${tool}`);
    return;
  }

  if (action === 'disconnect') {
    const name = positional[0];
    if (!name) {
      console.error('Usage: carina mcp disconnect <name>');
      process.exit(1);
    }
    await disconnectServer(name);
    await removeMcpServer(name);
    console.log(chalk.green(`Disconnected ${name}`));
    return;
  }

  if (action === 'doctor') {
    const issues = await diagnoseMcpEnvironment();
    const live = listConnections();
    const persisted = await readMcpServers();
    if (json) {
      console.log(JSON.stringify({ issues, live, persisted }, null, 2));
      return;
    }
    console.log(chalk.bold('\nMCP doctor\n'));
    if (issues.length === 0) console.log(chalk.green('  Environment: OK'));
    else for (const issue of issues) console.log(chalk.red(`  Issue: ${issue}`));
    console.log(`  Live connections: ${live.length}`);
    console.log(`  Persisted servers: ${persisted.length}`);
    console.log('');
    return;
  }

  if (action === 'permissions') {
    const security = getMcpSecurityManager();
    await security.load();
    const perms = security.listPermissions();
    if (json) {
      console.log(JSON.stringify(perms, null, 2));
      return;
    }
    console.log(chalk.bold('\nMCP tool permissions\n'));
    for (const perm of perms) {
      console.log(
        `  ${perm.serverName}/${perm.toolName}  allowed=${perm.allowed}  approval=${perm.requiresApproval}`,
      );
    }
    console.log('');
    return;
  }

  if (action === 'connections') {
    const live = listConnections();
    const persisted = await readMcpServers();
    if (json) {
      console.log(JSON.stringify({ live, persisted }, null, 2));
      return;
    }
    console.log(chalk.bold('\nMCP connections\n'));
    for (const conn of live) {
      console.log(`  ${conn.name.padEnd(18)} ${conn.transport}  ${conn.tools.length} tools`);
    }
    console.log('');
    return;
  }
}
