import { randomUUID } from 'node:crypto';
import type { SensorName, SensorSignal } from '../types.js';

export function signal(
  sensor: SensorName,
  title: string,
  description: string,
  severity: number,
  confidence: number,
  extra: Partial<SensorSignal> = {},
): SensorSignal {
  return {
    id: randomUUID(),
    sensor,
    title,
    description,
    severity,
    confidence,
    evidence: {},
    timestamp: new Date().toISOString(),
    ...extra,
  };
}
