import { runLearningLoop, isUserCorrection } from './learning-loop.js';
import { runLightCuratorPass } from './curator.js';
import type { LearningLoopInput, LearningLoopResult } from './learning-loop.js';

export interface PostTaskInput {
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
  toolCallLog: string[];
  sessionId?: string;
  tenantId?: string;
}

export type LearningNotice =
  | { kind: 'skill'; skillName: string; action: 'created' | 'refined' }
  | { kind: 'preference'; preference: string; action: 'added' | 'replaced' }
  | { kind: 'protected'; skillName: string; reason: string }
  | { kind: 'ignored'; reason: string };

const BLOCKED_REASON_LABELS: Record<string, string> = {
  weak_evidence: 'new evidence was weaker than the existing approach',
  high_quality_protected: 'existing skill is high quality and well used',
  no_steps: 'no revised procedure was extracted',
};

const IGNORED_REASON_LABELS: Record<string, string> = {
  no_extractable_preference: 'no clear preference to save yet',
  low_confidence: 'correction was too vague to promote safely',
  no_clear_preference_or_procedure: 'noted, but nothing specific enough to save',
};

function reasonLabel(reason: string, labels: Record<string, string>): string {
  return labels[reason] ?? reason.replace(/_/g, ' ');
}

export function formatLearningNotice(notice: LearningNotice): string {
  switch (notice.kind) {
    case 'skill':
      if (notice.action === 'created') {
        return `(saved approach as skill: ${notice.skillName})`;
      }
      return `(refined skill from your correction: ${notice.skillName})`;
    case 'preference':
      if (notice.action === 'replaced') {
        return `(updated your preference: ${notice.preference})`;
      }
      return `(learned your preference: ${notice.preference})`;
    case 'protected':
      return `(kept skill "${notice.skillName}"; ${reasonLabel(notice.reason, BLOCKED_REASON_LABELS)})`;
    case 'ignored':
      return `(noted your correction; ${reasonLabel(notice.reason, IGNORED_REASON_LABELS)})`;
    default:
      return '';
  }
}

export function buildLearningNotice(
  result: LearningLoopResult,
  isCorrection: boolean,
): LearningNotice | null {
  if (result.saved && result.skillName && (result.action === 'created' || result.action === 'refined')) {
    return { kind: 'skill', skillName: result.skillName, action: result.action };
  }

  if (result.preferenceLearned && result.preferenceText) {
    return {
      kind: 'preference',
      preference: result.preferenceText,
      action: result.preferenceAction === 'replaced' ? 'replaced' : 'added',
    };
  }

  if (result.blockedReason && result.skillName) {
    return { kind: 'protected', skillName: result.skillName, reason: result.blockedReason };
  }

  if (isCorrection) {
    const reason = result.preferenceSkipReason ?? 'no_clear_preference_or_procedure';
    return { kind: 'ignored', reason };
  }

  return null;
}

function inferSucceeded(assistantText: string): boolean {
  const lower = assistantText.toLowerCase();
  return !lower.includes("i couldn't")
    && !lower.includes('i was unable')
    && !lower.includes('failed to');
}

export async function evaluateAfterTurn(input: PostTaskInput): Promise<LearningNotice | null> {
  const isCorrection = isUserCorrection(input.userMessage);
  if (!isCorrection && input.toolsUsed.length < 3) return null;

  const loopInput: LearningLoopInput = {
    ...input,
    succeeded: inferSucceeded(input.assistantText),
  };

  try {
    const result = await runLearningLoop(loopInput);
    const notice = buildLearningNotice(result, isCorrection);

    if (notice?.kind === 'skill' && process.env.CARINA_SKILL_CURATOR_ENABLED !== 'false') {
      void runLightCuratorPass();
    }

    return notice;
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
