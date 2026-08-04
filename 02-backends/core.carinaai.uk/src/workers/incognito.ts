/**
 * Aiva Incognito: Carina does not retain chat bodies when enabled.
 *
 * Residual risk: the active LLM host still receives prompts for live inference.
 * Future private-inference grade (local / BYOK require) is documented in:
 * docs/rfc/0001-private-inference-incognito.md (Deferred; do not implement from this module).
 */
import type { WorkerConfig } from '../types/index.js';
import { getWorkerById, updateWorker } from './worker-store.js';
import { getWorkerSessionContext } from './worker-session-context.js';
import {
  clearIncognitoBuffer,
  isIncognitoSessionMarked,
  markIncognitoSession,
} from '../memory/aiva/incognito-buffer.js';
import { clearSession } from '../memory/store.js';
import { forceImmediateInvalidation } from '../brain/prompt-cache.js';

export function isWorkerIncognito(config?: WorkerConfig | null): boolean {
  return config?.privacy?.incognito === true;
}

/** Prefer live worker session flag; fall back to explicit mark for this process. */
export function isIncognitoSession(sessionId: string): boolean {
  if (isIncognitoSessionMarked(sessionId)) return true;
  const ctx = getWorkerSessionContext(sessionId);
  return isWorkerIncognito(ctx?.worker?.workerConfig);
}

export async function setWorkerIncognito(
  workerId: string,
  workspaceId: string,
  enabled: boolean,
  opts?: { sessionId?: string; channel?: string; contactId?: string },
): Promise<string> {
  const worker = await getWorkerById(workerId);
  if (!worker) return 'Worker not found.';

  const current = (worker.workerConfig ?? {}) as WorkerConfig;
  const nextConfig: WorkerConfig = {
    ...current,
    privacy: {
      ...(current.privacy ?? {}),
      incognito: enabled,
    },
  };
  await updateWorker(workspaceId, workerId, { workerConfig: nextConfig });

  const sessionId =
    opts?.sessionId
    ?? (opts?.contactId
      ? `aiva-${workerId}-contact-${opts.contactId}`
      : undefined);

  if (sessionId) {
    markIncognitoSession(sessionId, enabled);
    if (enabled) {
      clearIncognitoBuffer(sessionId);
      await clearSession(sessionId).catch(() => undefined);
      forceImmediateInvalidation(sessionId);
    }
  }

  return enabled
    ? [
        'Incognito: on.',
        'This chat is not saved on our servers (history, memory, and activity text).',
        'Actions you ask for (email, files, tools) still happen.',
        'Turn off with /incognito_off.',
      ].join('\n')
    : 'Incognito: off. Chats will be saved again as usual.';
}

export function redactForIncognito<T extends string | undefined | null>(
  incognito: boolean,
  value: T,
): T | undefined {
  if (!incognito) return value === null ? undefined : value;
  return undefined;
}
