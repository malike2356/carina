import { AIVA_QUALITY_CASES, type AivaQualityCase } from './aiva-quality-cases.js';

export type AivaBenchmarkTurn = { caseId: string; response: string; toolNames?: string[]; latencyMs?: number; contextRetained?: boolean; fallbackTransparent?: boolean };
export type AivaBenchmarkResult = { total: number; passed: number; score: number; failures: Array<{ caseId: string; reasons: string[] }>; metrics: { toolCorrectness: number; contextRetention: number; fallbackTransparency: number; latencyMs: number | null } };

function evaluate(item: AivaQualityCase, turn: AivaBenchmarkTurn): string[] {
  const response = turn.response.toLowerCase();
  const reasons: string[] = [];
  for (const forbidden of item.forbidden) if (response.includes(forbidden.toLowerCase())) reasons.push(`forbidden:${forbidden}`);
  if (!response.trim()) reasons.push('empty_response');
  return reasons;
}

export function runAivaQualityBenchmark(turns: readonly AivaBenchmarkTurn[], cases: readonly AivaQualityCase[] = AIVA_QUALITY_CASES): AivaBenchmarkResult {
  const failures: Array<{ caseId: string; reasons: string[] }> = [];
  let toolCorrect = 0;
  let context = 0;
  let fallback = 0;
  const latencies = turns.map((turn) => turn.latencyMs).filter((value): value is number => typeof value === 'number');
  for (const item of cases) {
    const turn = turns.find((candidate) => candidate.caseId === item.id);
    if (!turn) { failures.push({ caseId: item.id, reasons: ['missing_turn'] }); continue; }
    const reasons = evaluate(item, turn);
    if (item.category !== 'greeting' && item.category !== 'identity' && (turn.toolNames?.length ?? 0) === 0) reasons.push('missing_tool_evidence');
    if (item.category === 'follow_up' || item.category === 'memory') { if (turn.contextRetained !== true) reasons.push('context_not_retained'); else context += 1; }
    if (turn.fallbackTransparent !== false) fallback += 1;
    if (item.category !== 'greeting' && item.category !== 'identity' && (turn.toolNames?.length ?? 0) > 0) toolCorrect += 1;
    if (reasons.length) failures.push({ caseId: item.id, reasons });
  }
  const passed = cases.length - failures.length;
  const toolCases = cases.filter((item) => !['greeting', 'identity'].includes(item.category)).length;
  const contextCases = cases.filter((item) => ['follow_up', 'memory'].includes(item.category)).length;
  return { total: cases.length, passed, score: cases.length ? passed / cases.length : 1, failures, metrics: { toolCorrectness: toolCases ? toolCorrect / toolCases : 1, contextRetention: contextCases ? context / contextCases : 1, fallbackTransparency: turns.length ? fallback / turns.length : 1, latencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null } };
}
