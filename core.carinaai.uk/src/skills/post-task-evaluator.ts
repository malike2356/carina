import { runLearningLoop } from './learning-loop.js';
import type { LearningLoopInput } from './learning-loop.js';

export interface PostTaskInput {
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
  toolCallLog: string[];
}

export async function evaluateAfterTurn(input: PostTaskInput): Promise<string | null> {
  if (input.toolsUsed.length < 3) return null;

  const loopInput: LearningLoopInput = {
    ...input,
    succeeded: !input.assistantText.toLowerCase().includes("i couldn't") &&
               !input.assistantText.toLowerCase().includes('i was unable') &&
               !input.assistantText.toLowerCase().includes('failed to'),
  };

  try {
    const result = await runLearningLoop(loopInput);
    if (result.saved && result.skillName && result.action === 'created') {
      return result.skillName;
    }
  } catch {
    // evaluator must never break the user response
  }
  return null;
}

export async function recordTurnOutcome(
  skillName: string,
  succeeded: boolean,
): Promise<void> {
  const { getSkillByName, incrementSkillSuccess, incrementSkillFailure } = await import('./store.js');
  const skill = await getSkillByName(skillName);
  if (!skill) return;
  if (succeeded) {
    await incrementSkillSuccess(skill.id);
  } else {
    await incrementSkillFailure(skill.id);
  }
}
