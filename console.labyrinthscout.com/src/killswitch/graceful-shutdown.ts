import { publishControlMessage } from '../lib/instance-control.js';

const PHASE1_DELAY_MS = 0;
const PHASE2_DELAY_MS = 1000;
const PHASE3_DELAY_MS = 3000;
const PHASE4_DELAY_MS = 5000;

class GracefulShutdown {
  async execute(instanceId: string, reason: string): Promise<void> {
    await publishControlMessage({
      action: 'suspend',
      instance_id: instanceId,
      reason,
      timestamp: new Date().toISOString(),
      phases: ['reject', 'sigterm', 'sigkill'],
    });

    // Phase 1: Immediate rejection of new requests (agent-side listener)
    // The control message above is received immediately by kill-switch-listener
    // ------------------------------------------------------------------

    // Phase 2: 1s — soft stop (SIGTERM equivalent via Redis pub/sub)
    await new Promise((resolve) => setTimeout(resolve, PHASE2_DELAY_MS));
    await publishControlMessage({
      action: 'soft_stop',
      instance_id: instanceId,
      phase: 2,
      message: 'Emergency stop activated. Session ending.',
      timestamp: new Date().toISOString(),
    });

    // Phase 3: 3s — hard stop (SIGKILL equivalent)
    await new Promise((resolve) => setTimeout(resolve, PHASE3_DELAY_MS - PHASE2_DELAY_MS));
    await publishControlMessage({
      action: 'hard_stop',
      instance_id: instanceId,
      phase: 3,
      message: 'Carina is temporarily unavailable.',
      timestamp: new Date().toISOString(),
    });

    // Phase 4: 5s — alerts already fired by global-kill-switch via alertDispatcher
    await new Promise((resolve) => setTimeout(resolve, PHASE4_DELAY_MS - PHASE3_DELAY_MS));
  }
}

export const gracefulShutdown = new GracefulShutdown();
