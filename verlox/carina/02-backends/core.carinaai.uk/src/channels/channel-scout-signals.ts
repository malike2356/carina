import { reportEvent } from '../security/scout-client.js';

export function logChannelScoutSignal(input: {
  workerId: string;
  eventType: string;
  severity: 'info' | 'warning';
  description: string;
  metadata?: Record<string, unknown>;
}): void {
  void reportEvent({
    severity: input.severity,
    source: 'aiva-channel',
    event_type: input.eventType,
    description: input.description,
    metadata: input.metadata,
    instance_id: input.workerId,
  }).catch(() => {});
}
