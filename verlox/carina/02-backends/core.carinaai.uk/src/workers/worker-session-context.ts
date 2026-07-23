import type { Worker, WorkerContext } from '../types/index.js';
import { setOperatorActivePacks } from '../skills/operator-pack-store.js';

const sessionWorkers = new Map<string, WorkerContext>();
const savedPackEnv = new Map<string, string | undefined>();
const savedOperatorPacks = new Map<string, string[] | undefined>();

export function setWorkerSessionContext(sessionId: string, ctx: WorkerContext): void {
  sessionWorkers.set(sessionId, ctx);
}

export function getWorkerSessionContext(sessionId: string): WorkerContext | undefined {
  return sessionWorkers.get(sessionId);
}

export function listWorkerSessionContexts(): WorkerContext[] {
  return [...sessionWorkers.values()];
}

export function clearWorkerSessionContext(sessionId: string): void {
  sessionWorkers.delete(sessionId);
  savedPackEnv.delete(sessionId);
  savedOperatorPacks.delete(sessionId);
}

export function applyWorkerSkillPacks(sessionId: string, packs: string[]): () => void {
  const previous = process.env.ACTIVE_SKILL_PACKS;
  savedPackEnv.set(sessionId, previous);
  savedOperatorPacks.set(sessionId, undefined);
  process.env.ACTIVE_SKILL_PACKS = packs.join(',');
  setOperatorActivePacks(packs);
  return () => {
    const saved = savedPackEnv.get(sessionId);
    if (saved === undefined) {
      delete process.env.ACTIVE_SKILL_PACKS;
    } else {
      process.env.ACTIVE_SKILL_PACKS = saved;
    }
    savedPackEnv.delete(sessionId);
    savedOperatorPacks.delete(sessionId);
  };
}
