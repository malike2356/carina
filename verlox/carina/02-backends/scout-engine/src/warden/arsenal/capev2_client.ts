// CAPEv2 sandbox submit + report
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { submitSample } from '../sandbox/submit.js';

export async function runCapev2(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const available = Boolean(cfg.arsenal.capev2?.enabled);
  if (!available) {
    return {
      tool: 'capev2',
      ok: false,
      available: false,
      summary: 'CAPEv2 disabled',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  const result = await submitSample(targetPath);
  return {
    tool: 'capev2',
    ok: result.ok,
    available: true,
    summary: result.summary,
    findings: { reportPath: result.reportPath, jobId: result.jobId },
    durationMs: Date.now() - started,
  };
}
