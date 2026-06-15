import type { CliCommand, PackageInfo } from './types.js';
import { loadLocalEnv } from './config/env.js';
import { loadCarinaEnv } from '../config/load-env.js';

function cmd(
  name: string,
  summary: string,
  handler: (args: string[]) => Promise<void>,
  opts: { usage?: string; aliases?: string[]; loadEnv?: boolean } = {},
): CliCommand {
  return {
    name,
    summary,
    usage: opts.usage ?? `carina ${name}`,
    aliases: opts.aliases,
    loadEnv: opts.loadEnv,
    handler,
  };
}

let cachedPackage: PackageInfo | null = null;

export function readPackageInfo(): PackageInfo {
  if (cachedPackage) return cachedPackage;
  cachedPackage = { name: 'carina-agent', version: '0.1.0' };
  return cachedPackage;
}

export function setPackageInfo(pkg: PackageInfo): void {
  cachedPackage = pkg;
}

export function buildCommands(): CliCommand[] {
  return [
    cmd('chat', 'Interactive agent REPL (default)', async () => {
      const { runChat } = await import('./commands/agent.js');
      await runChat();
    }, { usage: 'carina [chat]', aliases: [''] }),

    cmd('tui', 'Rich terminal UI with provider picker', async () => {
      const { runTui } = await import('../tui/index.js');
      await runTui({ memoryReady: true });
    }, { loadEnv: true }),

    cmd('setup', 'First-run setup wizard', async () => {
      const { runCliSetup } = await import('./commands/setup.js');
      await runCliSetup();
    }, { aliases: ['onboard'] }),

    cmd('onboard', 'Guided first-run (setup + doctor)', async (args) => {
      const { runOnboardCommand } = await import('./commands/onboard-cli.js');
      await runOnboardCommand(args);
    }, { loadEnv: true, usage: 'carina onboard [--skip-setup] [--skip-doctor] [--json]' }),

    cmd('status', 'Operator overview (health, gateway, backups)', async (args) => {
      const { runStatusCommand } = await import('./commands/status-cli.js');
      await runStatusCommand(args);
    }, { loadEnv: true, usage: 'carina status [--json] [--quick] [--control] [--no-update]' }),

    cmd('reset', 'Clear local Carina state (keeps CLI installed)', async (args) => {
      const { runResetCommand } = await import('./commands/reset-cli.js');
      await runResetCommand(args);
    }, { usage: 'carina reset [--scope soft|state|full] [--dry-run] [--force] [audit]' }),

    cmd('uninstall', 'Remove CLI and optionally purge ~/.carina', async (args) => {
      const { runUninstallCommand } = await import('./commands/uninstall-cli.js');
      await runUninstallCommand(args);
    }, { usage: 'carina uninstall [--purge-state] [--force]' }),

    cmd('serve', 'Local web/API server on localhost:3000 (or: carina serve mcp)', async (args) => {
      const { runServe } = await import('./commands/serve.js');
      await runServe(args);
    }, { loadEnv: true, usage: 'carina serve [mcp] [--stdio|--http] [options]' }),

    cmd('mcp', 'MCP server mode (expose Carina tools to external clients)', async (args) => {
      const { runMcpCommand } = await import('./commands/mcp-server-cli.js');
      await runMcpCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina mcp <server|status> [options]',
    }),

    cmd('web', 'Start web UI and gateway', async () => {
      const { runWeb } = await import('./commands/agent.js');
      await runWeb();
    }, { loadEnv: true }),

    cmd('config', 'Manage config.yaml and .env', async (args) => {
      const { runConfigCommand } = await import('./commands/config-cli.js');
      await runConfigCommand(args);
    }, { usage: 'carina config <list|get|set|edit|check|migrate>' }),

    cmd('model', 'List, set, or pick LLM provider/model', async (args) => {
      const { runModelCommand } = await import('./commands/model.js');
      await runModelCommand(args);
    }, { usage: 'carina model [menu|list|set|pick|test]' }),

    cmd('tools', 'List and toggle agent tools/toolsets', async (args) => {
      const { runToolsCommand } = await import('./commands/tools-cli.js');
      await runToolsCommand(args);
    }, { usage: 'carina tools [menu|list|toolsets|platform|enable|disable]' }),

    cmd('profile', 'Manage isolated agent profiles', async (args) => {
      const { runProfileCommand } = await import('./commands/profile-cli.js');
      await runProfileCommand(args);
    }, { usage: 'carina profile <list|create|use|show|delete>' }),

    cmd('agents', 'Named agent workspaces and channel routing', async (args) => {
      const { runAgentsCommand } = await import('./commands/agents-cli.js');
      await runAgentsCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina agents <list|add|use|bind|route|show|remove> [args]',
      aliases: ['agent'],
    }),

    cmd('personality', 'View or edit profile personality', async (args) => {
      const { runPersonalityCommand } = await import('./commands/personality-cli.js');
      await runPersonalityCommand(args);
    }, { usage: 'carina personality <show|edit>' }),

    cmd('gateway', 'Messaging gateway control', async (args) => {
      const { runGatewayCommand } = await import('./commands/gateway.js');
      await runGatewayCommand(args);
    }, { usage: 'carina gateway <status|start|setup>' }),

    cmd('channels', 'List and configure messaging channels', async (args) => {
      const { runChannelsCommand } = await import('./commands/channels.js');
      await runChannelsCommand(args[0] ?? 'list', ...args.slice(1));
    }, { loadEnv: true, usage: 'carina channels <list|status|setup|dm|threads|directory> [args]' }),

    cmd('whatsapp', 'WhatsApp pairing via Baileys', async (args) => {
      const { runWhatsAppCommand } = await import('./commands/whatsapp.js');
      await runWhatsAppCommand(args[0] ?? 'setup');
    }, { loadEnv: true }),

    cmd('pairing', 'Device pairing codes', async (args) => {
      const { runPairingCommand } = await import('./commands/pairing-cli.js');
      await runPairingCommand(args);
    }, { usage: 'carina pairing <status|code|devices|nodes|approve|reject|revoke|rotate|qr> [id]' }),

    cmd('pair', 'Pair a mobile device via token and QR', async (args) => {
      const { runPairCommand } = await import('./commands/pair-cli.js');
      await runPairCommand(args);
    }, { usage: 'carina pair [list|revoke|token|accept] [args]' }),

    cmd('host', 'Gateway host daemon (install, start, logs)', async (args) => {
      const { runHostCommand } = await import('./commands/host-cli.js');
      await runHostCommand(args);
    }, { loadEnv: true, usage: 'carina host <status|install|start|stop|restart|uninstall|logs|supervise> [args]' }),

    cmd('node-host', 'Remote node daemon (pair, install, start)', async (args) => {
      const { runNodeHostCommand } = await import('./commands/node-host-cli.js');
      await runNodeHostCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina node-host <status|pair|pair-wait|configure|start|stop|restart|install|uninstall|audit> [args]',
    }),

    cmd('cron', 'Scheduled job management', async (args) => {
      const { runCronCommand } = await import('./commands/cron.js');
      await runCronCommand(args[0] ?? 'list', args[1]);
    }, { loadEnv: true }),

    cmd('tasks', 'Background processes, cron, TaskFlows, delivery queue', async (args) => {
      const { runTasksCommand } = await import('./commands/tasks-cli.js');
      await runTasksCommand(args);
    }, { loadEnv: true, usage: 'carina tasks [background|cron|taskflows|delivery] [--json]' }),

    cmd('taskflows', 'Durable automation workflows', async (args) => {
      const { runTaskFlowsCommand } = await import('./commands/taskflows-cli.js');
      await runTaskFlowsCommand(args);
    }, { loadEnv: true }),

    cmd('acp', 'ACP bridge client and session management', async (args) => {
      const { runAcpCommand } = await import('./commands/acp-cli.js');
      await runAcpCommand(args);
    }, { loadEnv: true }),

    cmd('doctor', 'Health check (Node, DB, Redis, gateway)', async (args) => {
      const { runDoctor } = await import('./commands/doctor.js');
      await runDoctor(args);
    }, { loadEnv: true, usage: 'carina doctor [--json] [--repair] [--quiet]' }),

    cmd('logs', 'View agent log files', async (args) => {
      const { runLogsCommand } = await import('./commands/logs.js');
      const action = args[0] ?? 'tail';
      const logName = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      await runLogsCommand(action, logName, args);
    }, { usage: 'carina logs <list|tail> [file] [--lines N] [--json]' }),

    cmd('skills', 'Curated skills from skill curator', async (args) => {
      const { runSkillsCommand } = await import('./commands/skills-cli.js');
      await runSkillsCommand(args[0] ?? 'list');
    }, { loadEnv: true }),

    cmd('curator', 'Skill curator operator (report, prune, archive)', async (args) => {
      const { runCuratorCommand } = await import('./commands/curator-cli.js');
      await runCuratorCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina curator <report|list|duplicates|prune|archive|restore|run> [--profile NAME]',
    }),

    cmd('workshop', 'Review queue for captured skills (opt-in)', async (args) => {
      const { runWorkshopCommand } = await import('./commands/workshop-cli.js');
      await runWorkshopCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina workshop <status|list|show|approve|reject|purge> [id]',
    }),

    cmd('kanban', 'Kanban operator queue (claim, board, status)', async (args) => {
      const { runKanbanCommand } = await import('./commands/kanban-cli.js');
      await runKanbanCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina kanban <status|board|queue|add|claim|release|complete> [--profile NAME]',
    }),

    cmd('packs', 'Skill pack install/remove', async (args) => {
      const { runPacksCommand } = await import('./commands/packs-cli.js');
      await runPacksCommand(args);
    }, { usage: 'carina packs <list|status|enable|disable|install|remove> [--bypass-eval]' }),

    cmd('pack', 'Domain pack hub (search, install, publish)', async (args) => {
      const { runPackCommand } = await import('./commands/pack/index.js');
      await runPackCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina pack <search|list|install|publish> [args]',
    }),

    cmd('rfc', 'RFC workflow (propose kernel API changes)', async (args) => {
      const { runRfcCommand } = await import('./commands/rfc/index.js');
      await runRfcCommand(args);
    }, { usage: 'carina rfc <propose|list> [args]' }),

    cmd('extensions', 'Extension bundle install/enable (operator, opt-in)', async (args) => {
      const { runExtensionsCommand } = await import('./commands/extensions-cli.js');
      await runExtensionsCommand(args);
    }, {
      usage: 'carina extensions <list|install|enable|disable|remove|rollback|validate|status> [args]',
    }),

    cmd('eval', 'Offline skill pack evaluation harness', async (args) => {
      const { runEvalCommand } = await import('./commands/eval-cli.js');
      await runEvalCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina eval <run|compare|generate|gate|authoring|reports|report> [args]',
    }),

    cmd('install-pack', 'Install skill pack (alias)', async (args) => {
      const { runPacksCommand } = await import('./commands/packs-cli.js');
      await runPacksCommand(['install', args[0] ?? '']);
    }),

    cmd('list-packs', 'List installed packs (alias)', async () => {
      const { runPacksCommand } = await import('./commands/packs-cli.js');
      await runPacksCommand(['list']);
    }),

    cmd('commitments', 'Inferred follow-up commitments', async (args) => {
      const { runCommitmentsCommand } = await import('./commands/commitments-cli.js');
      await runCommitmentsCommand(args);
    }, { usage: 'carina commitments [list|dismiss] [--all] [--agent <id>] [--status <status>] [--json]' }),

    cmd('memory', 'Episodic and persistent memory', async (args) => {
      const { runMemoryCommand } = await import('./commands/memory-cli.js');
      await runMemoryCommand(args);
    }, { loadEnv: true, usage: 'carina memory <list|search|facts|dreams|promote|reindex|backends|use|status|test|clear>' }),

    cmd('sessions', 'Session index and local sessions', async (args) => {
      const { runSessionsCommand } = await import('./commands/sessions-cli.js');
      await runSessionsCommand(args);
    }, { usage: 'carina sessions <list|show|delete> [id] [--json]' }),

    cmd('checkpoint', 'Filesystem snapshots', async (args) => {
      const { runCheckpointCommand } = await import('./commands/checkpoint-cli.js');
      await runCheckpointCommand(args);
    }),

    cmd('rag', 'Vector knowledge search', async (args) => {
      const { runRagCommand } = await import('./commands/rag-cli.js');
      await runRagCommand(args);
    }, { loadEnv: true }),

    cmd('backup', 'Backup and restore ~/.carina', async (args) => {
      const { runBackupCommand } = await import('./commands/backup-cli.js');
      await runBackupCommand(args);
    }, { usage: 'carina backup <list|create|archive|plan|restore|verify> [label] [--force] [--dry-run] [--json]' }),

    cmd('ops', 'Sandbox, DNS, proxy, backup, secrets reload, audit', async (args) => {
      const { runOpsCommand } = await import('./commands/ops-cli.js');
      await runOpsCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina ops <sandbox|dns|proxy|backup|secrets|audit> ...',
    }),

    cmd('providers', 'LLM provider catalog and management', async (args) => {
      const { runProvidersCommand } = await import('./commands/providers-cli.js');
      await runProvidersCommand(args);
    }, { loadEnv: true, usage: 'carina providers <list|info|copilot|preset|health|test|disable|enable|scan> [args]' }),

    cmd('cookbook', 'Local model discovery and serve helper', async (args) => {
      const { runCookbookCommand, runCookbookDefault } = await import('./commands/cookbook-cli.js');
      if (args.length === 0) {
        await runCookbookDefault();
        return;
      }
      await runCookbookCommand(args);
    }, { usage: 'carina cookbook [list|search|inspect|serve] [args]' }),

    cmd('research', 'Multi-step deep research with cited report', async (args) => {
      const { runResearchCommand } = await import('./commands/research-cli.js');
      await runResearchCommand(args);
    }, { loadEnv: true, usage: 'carina research "<query>" [--rounds N] [--sources N] [--save file] [--format markdown|html] [--provider name]' }),

    cmd('compare', 'Send one prompt to multiple LLM providers in parallel', async (args) => {
      const { runCompareCommand } = await import('./commands/compare-cli.js');
      await runCompareCommand(args);
    }, { loadEnv: true, usage: 'carina compare "<prompt>" [--providers a,b] [--blind] [--save file.md] [--max-tokens N] [--format terminal|markdown]' }),

    cmd('about', 'Runtime version and MIT license information', async () => {
      const { runAboutCommand } = await import('./commands/about-cli.js');
      await runAboutCommand();
    }, { usage: 'carina about' }),

    cmd('scout', 'Labyrinth Scout integration', async (args) => {
      const { runScoutCommand } = await import('./commands/scout-cli.js');
      await runScoutCommand(args);
    }, { loadEnv: true }),

    cmd('security', 'Security posture audit', async (args) => {
      const { runSecurityCommand } = await import('./commands/security-cli.js');
      await runSecurityCommand(args);
    }, { loadEnv: true }),

    cmd('approvals', 'Dangerous tool approval rules and grants', async (args) => {
      const { runApprovalsCommand } = await import('./commands/approvals-cli.js');
      await runApprovalsCommand(args);
    }, {
      loadEnv: true,
      usage: 'carina approvals <list|allow|block|grant|revoke|audit|risk> ...',
    }),

    cmd('tenant', 'Hosted tenant status', async (args) => {
      const { runTenantCommand } = await import('./commands/tenant-cli.js');
      await runTenantCommand(args);
    }, { loadEnv: true }),

    cmd('billing', 'Stripe billing status', async (args) => {
      const { runBillingCommand } = await import('./commands/billing-cli.js');
      await runBillingCommand(args);
    }, { loadEnv: true }),

    cmd('plugins', 'Plugin bundles (alias for extensions)', async (args) => {
      const { runPluginsCommand } = await import('./commands/plugins-cli.js');
      await runPluginsCommand(args);
    }, {
      usage: 'carina plugins <list|install|enable|disable|remove|rollback|validate|status> [args]',
    }),

    cmd('hooks', 'Plugin and custom hooks', async (args) => {
      const { runHooksCommand } = await import('./commands/hooks-cli.js');
      await runHooksCommand(args);
    }),

    cmd('migrate', 'Import from Claude or Carina bundles', async (args) => {
      const { runMigrateCommand } = await import('./commands/migrate-cli.js');
      await runMigrateCommand(args);
    }, { usage: 'carina migrate <status|claude|export|import> [--from PATH] [--dry-run] [--force]' }),

    cmd('update', 'Check for package updates', async (args) => {
      const { runUpdateCommand } = await import('./commands/update-cli.js');
      await runUpdateCommand(args);
    }),

    cmd('ingest', 'Ingest RAG corpus for a pack', async (args) => {
      const { runIngestCommand } = await import('./commands/ingest-cli.js');
      await runIngestCommand(args);
    }),

    cmd('hub', 'Community Skills Hub (browse, registry, server)', async (args) => {
      const { runHubCommand } = await import('./commands/hub-cli.js');
      await runHubCommand(args);
    }),

    cmd('contacts', 'Contact directory', async (args) => {
      const { runContactsCommand } = await import('./commands/contacts-cli.js');
      await runContactsCommand(args);
    }),

    cmd('secrets', 'Manage .env secrets (redacted list)', async (args) => {
      const { runSecretsCommand } = await import('./commands/secrets-cli.js');
      await runSecretsCommand(args);
    }),

    cmd('credentials', 'API key pools and OAuth device login', async (args) => {
      const { runCredentialsCommand } = await import('./commands/credentials-cli.js');
      await runCredentialsCommand(args);
    }, { loadEnv: true, usage: 'carina credentials <status|add|remove|retire|rotate|test|oauth> [--profile NAME]' }),

    cmd('env', 'Show non-secret environment', async (args) => {
      const { runEnvCommand } = await import('./commands/env-cli.js');
      await runEnvCommand(args);
    }, { loadEnv: true }),

    cmd('completion', 'Shell completion scripts', async (args) => {
      const { runCompletionCommand } = await import('./commands/completion-cli.js');
      await runCompletionCommand(args);
    }),

    cmd('ide', 'IDE extension install/build', async (args) => {
      const action = args[0] ?? 'install';
      const target = (args[1] ?? 'all') as 'vscode' | 'cursor' | 'zed' | 'jetbrains' | 'all';
      const { buildIdeExtensions, installIdeExtension } = await import('./commands/ide.js');
      if (action === 'build') await buildIdeExtensions();
      else if (action === 'install') await installIdeExtension(target);
      else {
        console.error('Usage: carina ide <install|build> [target]');
        process.exit(1);
      }
    }),

    cmd('help', 'Show help', async (args) => {
      const { buildHelpText, buildCommandHelp } = await import('./help.js');
      const pkg = readPackageInfo();
      if (args[0]) {
        const target = resolveCommand(args[0]);
        if (!target) {
          console.error(`Unknown command: ${args[0]}`);
          process.exit(1);
        }
        console.log(buildCommandHelp(target, pkg));
        return;
      }
      console.log(buildHelpText(buildCommands(), pkg));
    }, { aliases: ['-h', '--help'] }),

    cmd('hosted', 'Operator recovery for hosted-auth accounts', async (args) => {
      const { runHostedCommand } = await import('./commands/hosted-cli.js');
      await runHostedCommand(args);
    }, { loadEnv: true, usage: 'carina hosted <reset-password|bootstrap> [options]' }),

    cmd('version', 'Print version', async () => {
      const { versionWithLicenseLine } = await import('./commands/about-cli.js');
      console.log(versionWithLicenseLine());
    }, { aliases: ['-v', '--version'] }),
  ];
}

export function buildCommandList(): CliCommand[] {
  return buildCommands();
}

export function resolveCommand(name: string): CliCommand | undefined {
  if (!name) return buildCommands().find((c) => c.name === 'chat');
  return buildCommands().find(
    (c) => c.name === name || c.aliases?.includes(name),
  );
}

export async function runCli(argv: string[], pkg?: PackageInfo): Promise<void> {
  if (pkg) setPackageInfo(pkg);

  // Load .env before provider plugins so API keys (e.g. GITHUB_TOKEN) are available.
  loadCarinaEnv();

  // Load provider plugins before any command handler runs so plugin factories
  // are registered before the LLMRouter singleton is first imported.
  const { loadProviderPlugins } = await import('../plugins/loader.js');
  const pluginNames = await loadProviderPlugins();
  if (pluginNames.length > 0) {
    const { llm } = await import('../brain/llm.js');
    llm.refreshPlugins();
  }

  const commandName = argv[0] ?? '';
  const rest = argv.slice(1);

  if (!commandName) {
    loadLocalEnv();
    const chat = resolveCommand('chat');
    await chat?.handler?.([]);
    return;
  }

  const command = resolveCommand(commandName);
  if (!command?.handler) {
    loadLocalEnv();
    const chat = resolveCommand('chat');
    await chat?.handler?.(argv);
    return;
  }

  if (command.loadEnv) loadLocalEnv();
  await command.handler(rest);
}
