import { pool } from '../memory/db.js';
import { logSelfModEvent } from './self-mod-logger.js';
import { detectHighRiskPatterns } from './anomaly-detector.js';
import { checkPendingToolBloat, checkFailedGenerationRate } from './anomaly-detector.js';
import { RuntimeToolStore } from '../tools/dynamic/tool-store.js';

export async function runScheduledSecurityChecks(): Promise<void> {
  await checkFailedGenerationRate().catch(() => undefined);
  await checkPendingToolBloat().catch(() => undefined);
}

export async function runDailyDeepAudit(): Promise<{
  tools_reviewed: number;
  tools_flagged: number;
  findings: string[];
}> {
  const store = new RuntimeToolStore();
  const tools = await store.list().catch(() => []);
  const findings: string[] = [];
  let flagged = 0;

  for (const tool of tools) {
    if (tool.status !== 'active' && tool.status !== 'pending') continue;

    const risks = detectHighRiskPatterns(tool.sourceCode);
    if (risks.length > 0) {
      findings.push(`${tool.name}: ${risks.join('; ')}`);
      flagged++;

      const isHighRisk = risks.some((r) => r.includes('credential') || r.includes('exfiltration'));
      if (tool.status === 'active' && isHighRisk) {
        await store.disable(tool.id).catch(() => undefined);
        await logSelfModEvent('TOOL_DISABLED', {
          tool_name: tool.name,
          reason: `Daily audit found high-risk pattern: ${risks[0]}`,
          action_taken: 'Tool disabled automatically.',
        }).catch(() => undefined);
      }
    }
  }

  if (findings.length > 0) {
    await logSelfModEvent('TOOL_HIGH_RISK_PATTERN', {
      tools_reviewed: tools.length,
      tools_flagged: flagged,
      findings,
      action_taken: `Daily audit complete. ${flagged} tool(s) flagged.`,
    }).catch(() => undefined);
  }

  return { tools_reviewed: tools.length, tools_flagged: flagged, findings };
}

export async function runWeeklyCVECheck(): Promise<void> {
  // Placeholder for future OSV/NVD API integration.
  // When a CVE is detected for sandbox dependencies, emit TOOL_HIGH_RISK_PATTERN
  // with action_taken: 'Tool generation disabled until patched.'
}
