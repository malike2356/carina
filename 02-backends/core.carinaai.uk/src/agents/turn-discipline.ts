import type { Message } from '../types/index.js';

export function buildTurnEndingBlock(): string {
  return [
    'How to end a turn:',
    'There are exactly three valid ways to end a turn:',
    '(1) DONE: sanity-check that every concrete thing the operator asked for actually exists or succeeded (file written, edit applied, command exited clean). Then stop calling tools and write the final answer.',
    '(2) BLOCKED: you genuinely cannot proceed (missing capability, permission denied, unobtainable data). State what blocks you in one or two sentences, then stop.',
    '(3) KEEP GOING: take the single most useful next step while the task still needs work.',
    'Wrong moves: trailing off mid-task without DONE or BLOCKED; repeating a tool call you already ran; stopping early because you made "enough" calls.',
    'Only end the turn after DONE or BLOCKED. If work remains, you should still be in KEEP GOING.',
  ].join('\n');
}

export function buildFailureHandlingBlock(): string {
  return [
    'After a tool fails:',
    'A failed tool call is mid-task information, not the end of the task.',
    'DO NOT go silent. The operator is waiting.',
    'DO NOT pretend it succeeded.',
    'DO NOT change the subject.',
    'Choose one: retry with corrected arguments; try a different approach or tool; run a diagnostic; or state plainly what failed and ask whether to try an alternative.',
    'Take one step forward after every failure unless you are truly BLOCKED.',
    '',
    'Bias toward action:',
    'On edit requests, act immediately with your best interpretation. The operator can undo or re-prompt if wrong.',
    'After a tool succeeds, confirm in one short sentence. Do not re-check or perform validation theater.',
    'After a tool fails, follow up in the same turn when possible. A failed tool is not a stopping condition.',
  ].join('\n');
}

export function buildTurnDisciplineBlock(): string {
  return [buildTurnEndingBlock(), '', buildFailureHandlingBlock()].join('\n');
}

const FAILURE_STATUS = new Set(['failed', 'error', 'blocked', 'denied', 'rejected']);

export function isToolResultFailure(result: unknown): boolean {
  const record = asRecord(result);
  if (!record) {
    if (typeof result === 'string') {
      const lower = result.toLowerCase();
      return lower.includes('error') || lower.includes('failed');
    }
    return false;
  }
  if ('error' in record && record.error !== undefined && record.error !== null && record.error !== '') {
    return true;
  }
  const status = String(record.status ?? '').toLowerCase();
  if (FAILURE_STATUS.has(status)) return true;
  const code = String(record.code ?? '').toUpperCase();
  if (code.endsWith('_BLOCKED') || code.endsWith('_DENIED')) return true;
  if (record.ok === false) return true;
  return false;
}

export function failureSummary(result: unknown): string {
  const record = asRecord(result);
  if (!record) return String(result ?? 'unknown error');
  if (record.error) {
    const error = asRecord(record.error);
    if (error) {
      const code = String(error.code ?? '').trim();
      const message = String(error.message ?? error.detail ?? '').trim();
      const nested = [code, message].filter(Boolean).join(': ');
      if (nested) return nested;
    }
    return String(record.error);
  }
  if (record.message) return String(record.message);
  if (record.reason) return String(record.reason);
  return JSON.stringify(record).slice(0, 200);
}

export function buildFailureFollowUpHint(toolName: string, result: unknown): string {
  const summary = failureSummary(result);
  return [
    'Turn discipline:',
    `${toolName} failed (${summary}).`,
    'This is not DONE. Retry, try another tool, diagnose, or declare BLOCKED with a plain explanation.',
    'Do not go silent and do not claim success.',
  ].join(' ');
}

export function augmentFailedToolResult(result: unknown, toolName: string): unknown {
  if (!isToolResultFailure(result)) return result;
  const record = asRecord(result);
  const hint = buildFailureFollowUpHint(toolName, result);
  if (record) return { ...record, _turnDiscipline: hint };
  return { error: String(result ?? 'tool failed'), _turnDiscipline: hint };
}

export function isSilentOrWeakResponse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/\b(?:the operation|the requested operation)\s+(?:failed|could not be completed)|operation was not completed|tool failed\b/i.test(trimmed)) {
    return true;
  }
  return trimmed.length < 24;
}

export function getRecentToolFailures(messages: Message[]): Array<{ toolName: string; summary: string }> {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  const failures: Array<{ toolName: string; summary: string }> = [];
  for (let i = Math.max(0, lastUserIdx + 1); i < messages.length; i++) {
    const message = messages[i];
    if (message?.role !== 'tool_result') continue;
    if (!isToolResultFailure(message.result)) continue;
    failures.push({
      toolName: message.toolName ?? 'tool',
      summary: failureSummary(message.result),
    });
  }
  return failures;
}

export function buildSilentTurnPreventionNudge(
  failures: Array<{ toolName: string; summary: string }>,
): string {
  const lines = failures
    .slice(-3)
    .map((f) => `- ${f.toolName}: ${f.summary}`)
    .join('\n');
  return [
    'Turn discipline enforcement:',
    'You ended the turn without DONE or BLOCKED after tool failures.',
    'Recent failures:',
    lines,
    'Respond now: retry with a fix, try another approach, run a diagnostic, or declare BLOCKED.',
    'Do not go silent. Do not fabricate success.',
  ].join('\n');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
