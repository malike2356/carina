import { getControlService } from '../messaging/control-defaults.js';

export const validateKillReason = getControlService().validateKillReason;
export async function suspendInstance(instanceId: string, reason: string) {
  const result = await getControlService().suspendInstance(instanceId, reason);
  if (result.ok) {
    return {
      ...result,
      instance_id: result.target_id ?? instanceId,
    };
  }
  return result;
}

export async function resumeInstance(instanceId: string) {
  const result = await getControlService().resumeInstance(instanceId);
  if (result.ok) {
    return {
      ...result,
      instance_id: result.target_id ?? instanceId,
    };
  }
  return result;
}
