import type { Tool } from '../types/index.js';
import {
  closeProcessStdin,
  getProcessLog,
  killProcess,
  listProcesses,
  pollProcess,
  spawnBackgroundProcess,
  startProcessCleanup,
  waitForProcess,
  writeToProcess,
} from './process-registry.js';

type ProcessAction = 'list' | 'poll' | 'log' | 'wait' | 'kill' | 'write' | 'submit' | 'close';

const MUTATING_ACTIONS = new Set<ProcessAction>(['kill', 'write', 'submit', 'close']);

export const processTool: Tool = {
  name: 'process',
  description:
    'Manage background processes started by shell-exec (background=true): list, poll, log, wait, kill, write stdin, submit input, or close stdin.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'poll', 'log', 'wait', 'kill', 'write', 'submit', 'close'],
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

      case 'poll':
        if (!sessionId) return { error: 'session_id is required for poll' };
        return pollProcess(sessionId);

      case 'log':
        if (!sessionId) return { error: 'session_id is required for log' };
        return getProcessLog(
          sessionId,
          params.offset !== undefined ? Number(params.offset) : -200,
          params.limit !== undefined ? Number(params.limit) : 200,
        );

      case 'wait':
        if (!sessionId) return { error: 'session_id is required for wait' };
        return waitForProcess(sessionId, params.timeout !== undefined ? Number(params.timeout) : 60);

      case 'kill':
        if (!sessionId) return { error: 'session_id is required for kill' };
        return killProcess(sessionId);

      case 'write':
        if (!sessionId) return { error: 'session_id is required for write' };
        return writeToProcess(sessionId, String(params.data ?? ''), false);

      case 'submit':
        if (!sessionId) return { error: 'session_id is required for submit' };
        return writeToProcess(sessionId, String(params.data ?? ''), true);

      case 'close':
        if (!sessionId) return { error: 'session_id is required for close' };
        return closeProcessStdin(sessionId);

      default:
        return { error: `Unknown action: ${action}` };
    }
  },
};

export { spawnBackgroundProcess };
