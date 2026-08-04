import {
  acpBridgeEnabled,
  acpCreateSession,
  acpHealth,
  acpPrompt,
  deleteAcpSession,
  listAcpSessions,
  setAcpSessionLabel,
} from '../../infrastructure/acp-bridge/index.js';
import { acpBridgeMode } from '../../infrastructure/acp-bridge/auth.js';
import { resolveKnownWebGatewayUrl } from '../../infrastructure/web-gateway-port.js';
import readline from 'readline';

function baseUrl(): string {
  return process.env.CARINA_GATEWAY_URL ?? resolveKnownWebGatewayUrl();
}

function usage(): void {
  console.log(`Usage: carina acp <command>

Commands:
  status                     Bridge and gateway health
  sessions                   List stored ACP sessions
  create [--label NAME]      Create session via gateway
  label <sessionId> <label>  Set session label
  delete <sessionId>         Remove session
  prompt <text>              Send prompt (--session ID, --password-file PATH)
  bridge                     Interactive bridge mode (forwards prompts to gateway)

Requires CARINA_ACP_ENABLED=true on gateway (carina web).
Set CARINA_ACP_MODE=client|bridge|server (gateway side).
`);
}

export async function runAcpCommand(args: string[]): Promise<void> {
  const cmd = args[0] ?? 'status';

  if (cmd === 'status') {
    console.log(`ACP bridge store: ${acpBridgeEnabled() ? 'enabled' : 'disabled (CARINA_ACP_ENABLED=true on gateway)'}`);
    console.log(`Mode: ${acpBridgeMode()}`);
    try {
      const health = await acpHealth({ baseUrl: baseUrl(), passwordFile: flag(args, '--password-file') });
      console.log(JSON.stringify(health, null, 2));
    } catch (err) {
      console.log(`Gateway ACP: unreachable (${err instanceof Error ? err.message : String(err)})`);
    }
    return;
  }

  if (cmd === 'sessions') {
    for (const s of listAcpSessions()) {
      console.log(`  ${s.sessionId}  label=${s.label ?? '-'}  ${s.provenance}  last=${s.lastUsed}`);
    }
    return;
  }

  if (cmd === 'create') {
    const label = flag(args, '--label');
    const result = await acpCreateSession(
      { baseUrl: baseUrl(), passwordFile: flag(args, '--password-file') },
      { label, provenance: 'bridge' },
    );
    console.log(`Session: ${result.sessionId}`);
    return;
  }

  if (cmd === 'label') {
    const sessionId = args[1];
    const label = args[2];
    if (!sessionId || !label) {
      console.error('Usage: carina acp label <sessionId> <label>');
      process.exitCode = 1;
      return;
    }
    const updated = setAcpSessionLabel(sessionId, label);
    console.log(updated ? 'Updated' : 'Session not found');
    return;
  }

  if (cmd === 'delete') {
    const sessionId = args[1];
    if (!sessionId) {
      console.error('Usage: carina acp delete <sessionId>');
      process.exitCode = 1;
      return;
    }
    console.log(deleteAcpSession(sessionId) ? 'Deleted' : 'Not found');
    return;
  }

  if (cmd === 'prompt') {
    const text = args.slice(1).join(' ').replace(/^--session\s+\S+\s*/, '').trim();
    const sessionId = flag(args, '--session');
    if (!text) {
      console.error('Usage: carina acp prompt <text> [--session ID]');
      process.exitCode = 1;
      return;
    }
    const result = await acpPrompt(
      { baseUrl: baseUrl(), passwordFile: flag(args, '--password-file') },
      { sessionId, prompt: text, provenance: 'bridge' },
    );
    console.log(result.reply);
    return;
  }

  if (cmd === 'bridge') {
    const passwordFile = flag(args, '--password-file');
    const clientOpts = { baseUrl: baseUrl(), passwordFile };
    const created = await acpCreateSession(clientOpts, { label: 'bridge', provenance: 'bridge' });
    let sessionId = created.sessionId;
    console.log(`Bridge mode connected. Session: ${sessionId}`);
    console.log('Type prompts (Ctrl+C to exit).');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (): void => {
      rl.question('> ', async (line) => {
        const text = line.trim();
        if (!text) {
          ask();
          return;
        }
        try {
          const result = await acpPrompt(clientOpts, {
            sessionId,
            prompt: text,
            provenance: 'bridge',
          });
          sessionId = result.sessionId;
          console.log(result.reply);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
        }
        ask();
      });
    };
    ask();
    return;
  }

  usage();
}

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}
