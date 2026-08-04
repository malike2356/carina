import type { Tool } from '../types/index.js';
import {
  closeProcessStdin,
  getProcessDetail,
  getProcessLog,
  killProcess,
  listProcesses,
  pollProcess,
  spawnBackgroundProcess,
  startProcessCleanup,
  waitForProcess,
  writeToProcess,
} from './process-registry.js';

type ProcessAction = 'list' | 'poll' | 'log' | 'wait' | 'kill' | 'write' | 'submit' | 'close' | 'detail';

const MUTATING_ACTIONS = new Set<ProcessAction>(['kill', 'write', 'submit', 'close']);

export const processTool: Tool = {
  name: 'process',
  description:
    'Manage background processes spawned by shell-exec (background=true). Use list first to find the session_id. Actions: list - all tracked processes with status and uptime; detail - full metadata including watch rules and notifications; poll - new output lines since the last poll call (advances an internal cursor - use repeatedly while a process runs); log - read the output buffer non-destructively by offset/limit (does not advance cursor); wait - block until the process exits, up to timeout seconds (max 600); kill - sends SIGTERM then SIGKILL after a grace period (on Windows, SIGTERM is an immediate kill with no graceful shutdown; on Linux/macOS, SIGTERM allows cleanup); write - write data to stdin without a newline; submit - write data to stdin with a trailing newline (use for interactive prompts and menu choices); close - close stdin so the process sees EOF.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'poll', 'log', 'wait', 'kill', 'write', 'submit', 'close', 'detail'],
        description: 'Process management action',
      },
      session_id: { type: 'string', description: 'Background process session ID' },
      data: { type: 'string', description: 'Stdin payload for write/submit' },
      offset: { type: 'number', description: 'Log offset (negative counts from end)' },
      limit: { type: 'number', description: 'Maximum log lines to return' },
      timeout: { type: 'number', description: 'Wait timeout in seconds (max 600)' },
    },
    required: ['action'],
  },
  dangerous: true,
  needsConfirmation: (params) => MUTATING_ACTIONS.has(String(params.action ?? '').toLowerCase() as ProcessAction),
  execute: async (params) => {
    startProcessCleanup();

    const action = String(params.action ?? '').toLowerCase() as ProcessAction;
    const sessionId = String(params.session_id ?? '').trim();

    switch (action) {
      case 'list':
        return { processes: listProcesses() };

      case 'detail':
        if (!sessionId) return { error: 'session_id is required for detail' };
        try {
          return getProcessDetail(sessionId);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'poll':
        if (!sessionId) return { error: 'session_id is required for poll' };
        try {
          return pollProcess(sessionId);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'log':
        if (!sessionId) return { error: 'session_id is required for log' };
        try {
          return getProcessLog(
            sessionId,
            params.offset !== undefined ? Number(params.offset) : -200,
            params.limit !== undefined ? Number(params.limit) : 200,
          );
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'wait':
        if (!sessionId) return { error: 'session_id is required for wait' };
        try {
          return await waitForProcess(
            sessionId,
            params.timeout !== undefined ? Number(params.timeout) : 60,
          );
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'kill':
        if (!sessionId) return { error: 'session_id is required for kill' };
        try {
          return await killProcess(sessionId);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'write':
        if (!sessionId) return { error: 'session_id is required for write' };
        try {
          return writeToProcess(sessionId, String(params.data ?? ''), false);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'submit':
        if (!sessionId) return { error: 'session_id is required for submit' };
        try {
          return writeToProcess(sessionId, String(params.data ?? ''), true);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      case 'close':
        if (!sessionId) return { error: 'session_id is required for close' };
        try {
          return closeProcessStdin(sessionId);
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }

      default:
        return { error: `Unknown action: ${action}` };
    }
  },
};

export { spawnBackgroundProcess };
export { isProcessAlive, killProcessByPid } from './process-signals.js';
