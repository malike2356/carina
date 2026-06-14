import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../types/index.js';
import { runDirectShell, runInSandbox } from './sandbox.js';
import { execInSessionSandbox, sessionSandboxEnabled, type SandboxSessionState } from '../infrastructure/sandbox-session.js';
import { expandPath, isBlockedSystemWrite, isSafePath } from './path-utils.js';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { spawnBackgroundProcess, startProcessCleanup, type CompletionNotify } from './process-registry.js';
import { isPtyEnabled, runPtyCommand } from './pty-runner.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_BYTES = 50 * 1024;
const LOG_PATH = 'data/logs/shell.log';
const SANDBOX_IMAGE = 'alpine:latest';

async function logShell(command: string, exitCode: number): Promise<void> {
  const line = `${new Date().toISOString()}\texit=${exitCode}\t${command}\n`;
  await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
  await fs.appendFile(LOG_PATH, line, 'utf8');
}

export function truncateShellOutput(text: string, maxBytes = MAX_OUTPUT_BYTES): string {
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes <= maxBytes) return text;
  const buf = Buffer.from(text, 'utf8').subarray(0, maxBytes);
  return `${buf.toString('utf8')}\n[truncated: output exceeded ${maxBytes} bytes]`;
}

function clampTimeout(timeoutMs?: number): number {
  const requested = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Math.max(1_000, Math.min(requested, MAX_TIMEOUT_MS));
}

function resolveWorkdir(raw?: string): string | { error: string } | undefined {
  const value = String(raw ?? '').trim();
  if (!value) return undefined;
  const resolved = path.resolve(expandPath(value));
  if (!isSafePath(resolved) || isBlockedSystemWrite(resolved)) {
    return { error: 'workdir is outside allowed paths.' };
  }
  return resolved;
}

export const shellExecTool: Tool = {
  name: 'shell-exec',
  description:
    'Execute a shell command and return stdout, stderr, and exit code. Supports foreground (default), background (background=true), and PTY mode (pty=true, requires CARINA_PTY_ENABLED=true). Set CARINA_DIRECT_SHELL=true in .env to run commands directly on the host (required for npm, git, pip, and file writes). Without it, commands run in a restricted Docker sandbox (alpine:latest, no network, read-only fs). workdir sets the working directory. Use background=true for long-running servers or builds.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to run' },
      workdir: { type: 'string', description: 'Optional working directory (absolute or ~/ path)' },
      timeout: { type: 'number', description: 'Foreground timeout in seconds (max 600)' },
      background: { type: 'boolean', description: 'Start in background and return session_id' },
      pty: {
        type: 'boolean',
        description: 'Run with pseudo-TTY for interactive programs (vim, python REPL). Gated by CARINA_PTY_ENABLED.',
      },
      notify_on_complete: {
        type: 'object',
        description: 'Send a message when the background process exits',
        properties: {
          channel: {
            type: 'string',
            enum: ['telegram', 'discord', 'slack', 'sms', 'whatsapp'],
          },
          conversation_id: { type: 'string' },
          message: { type: 'string', description: 'Optional custom prefix' },
        },
        required: ['channel', 'conversation_id'],
      },
    },
    required: ['command'],
  },
  dangerous: true,
  requiresConfirmation: true,
  execute: async (params) => {
    const command = String(params.command ?? '').trim();
    const background = params.background === true;
    const pty = params.pty === true;

    if (process.getuid?.() === 0) {
      throw new Error('Shell execution refused: running as root.');
    }

    if (!command) {
      return { error: 'command is required' };
    }

    const workdirRaw = params.workdir !== undefined
      ? String(params.workdir)
      : (process.env.CARINA_JOB_WORKDIR ?? '');
    const workdirResult = resolveWorkdir(workdirRaw || undefined);
    if (workdirResult && typeof workdirResult === 'object' && 'error' in workdirResult) {
      return workdirResult;
    }
    const workdir = workdirResult;

    if (pty) {
      if (!isPtyEnabled()) {
        return { error: 'PTY mode disabled. Set CARINA_PTY_ENABLED=true (and CARINA_PTY_SCOUT_ALLOW=true with Scout).' };
      }
      const timeoutMs = clampTimeout(
        params.timeout !== undefined ? Number(params.timeout) * 1000 : undefined,
      );
      try {
        const result = await runPtyCommand(command, workdir, timeoutMs);
        await logShell(command, result.exitCode);
        return {
          stdout: truncateShellOutput(result.stdout),
          stderr: truncateShellOutput(result.stderr),
          exitCode: result.exitCode,
          pty: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: msg };
      }
    }

    if (background) {
      startProcessCleanup();
      let notify: CompletionNotify | undefined;
      const rawNotify = params.notify_on_complete;
      if (rawNotify && typeof rawNotify === 'object') {
        const n = rawNotify as Record<string, unknown>;
        const channel = String(n.channel ?? '').toLowerCase() as ChannelName;
        const conversationId = String(n.conversation_id ?? '').trim();
        if (channel && conversationId) {
          notify = {
            channel,
            conversationId,
            messagePrefix: n.message ? String(n.message) : undefined,
          };
        }
      }
      const state = spawnBackgroundProcess(command, workdir, notify);
      await logShell(command, 0);
      return {
        session_id: state.sessionId,
        pid: state.pid,
        status: state.status,
        command: state.command,
        background: true,
        notify_on_complete: notify ? true : undefined,
      };
    }

    const timeoutMs = clampTimeout(
      params.timeout !== undefined ? Number(params.timeout) * 1000 : undefined,
    );

    const sessionId = typeof params._sessionId === 'string' ? params._sessionId : 'default-session';
    const useSessionSandbox = sessionSandboxEnabled() || params.sandbox_session === true;
    const useDirectShell = process.env.CARINA_DIRECT_SHELL === 'true';

    const result = useDirectShell
      ? await runDirectShell(command, { timeout: timeoutMs, workdir })
      : useSessionSandbox
        ? await execInSessionSandbox(sessionId, command, undefined, timeoutMs)
        : await runInSandbox(command, SANDBOX_IMAGE, {
            timeout: timeoutMs,
            memoryMb: 128,
            networkDisabled: true,
            workdir,
          });

    await logShell(command, result.exitCode);
    const payload: Record<string, unknown> = {
      stdout: truncateShellOutput(result.stdout),
      stderr: truncateShellOutput(result.stderr),
      exitCode: result.exitCode,
    };
    if ('sandbox' in result && result.sandbox) {
      const sandbox = result.sandbox as SandboxSessionState;
      payload.sandbox = {
        label: sandbox.label,
        status: sandbox.status,
        profile: sandbox.profile,
      };
    }
    return payload;
  },
};
