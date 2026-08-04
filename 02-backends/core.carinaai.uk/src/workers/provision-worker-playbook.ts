import type { WorkerConfig, WorkerPlaybookConfig } from '../types/index.js';
import { getAivaPlaybookTemplate, resolvePlaybookVariables } from './aiva-playbook-templates.js';
import { updateWorkerConfig } from './worker-bridge-store.js';

export async function provisionWorkerPlaybook(
  workspaceId: string,
  workerId: string,
  options: {
    playbookId: string;
    variables?: Record<string, string | number | boolean>;
    inboundTriggers?: string[];
  },
): Promise<WorkerPlaybookConfig> {
  const template = getAivaPlaybookTemplate(options.playbookId);
  const playbookId = template?.keprixPlaybookId ?? options.playbookId;
  const playbook: WorkerPlaybookConfig = {
    playbookId,
    keprixGraphId: playbookId,
    playbookVariables: resolvePlaybookVariables(playbookId, options.variables),
    inboundTriggers: options.inboundTriggers ?? ['email_received'],
    scheduleEnabled: false,
  };
  await updateWorkerConfig(workspaceId, workerId, { playbook } satisfies WorkerConfig);
  return playbook;
}

export function readWorkerPlaybook(workerConfig?: WorkerConfig): WorkerPlaybookConfig | null {
  if (!workerConfig?.playbook?.playbookId) return null;
  return workerConfig.playbook;
}
