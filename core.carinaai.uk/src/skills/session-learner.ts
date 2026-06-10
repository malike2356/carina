import { curateFromWorkflow } from './curator.js';

export interface SessionTurnSummary {
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
  toolCallLog: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workflow-skill';
}

export async function learnFromSessionTurn(turn: SessionTurnSummary): Promise<void> {
  if (process.env.CARINA_AUTO_SKILL_LEARN !== 'true') return;
  if (turn.toolsUsed.length < 2) return;
  if (!turn.assistantText.trim() || turn.assistantText.length < 80) return;

  const uniqueTools = [...new Set(turn.toolsUsed)];
  const name = `learned-${slugify(turn.userMessage.slice(0, 60))}-${Date.now().toString(36)}`;
  const steps = [
    `User request: ${turn.userMessage.slice(0, 500)}`,
    ...turn.toolCallLog.slice(0, 8).map((l) => `- ${l}`),
    `Outcome: ${turn.assistantText.slice(0, 800)}`,
  ].join('\n');

  const trigger = turn.userMessage
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 6);

  try {
    const result = await curateFromWorkflow({
      name,
      description: `Auto-learned from session (${uniqueTools.join(', ')})`,
      trigger,
      steps,
      toolsUsed: uniqueTools,
    });
    if (result.action !== 'skipped' && process.env.CARINA_AUTO_SKILL_LEARN_VERBOSE === 'true') {
      console.log(`[skill-learn] ${result.action}: ${result.skill ?? name}`);
    }
  } catch {
    // non-fatal
  }
}
