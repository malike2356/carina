import { llm } from '../brain/llm.js';
import type { Skill } from '../types/index.js';
import {
  findSkillByKeywordOverlap,
  getSkillByName,
  incrementSkillSuccess,
  incrementSkillFailure,
  saveSkill,
  skillExistsByName,
  updateSkill,
} from './store.js';
import { logSkillAction } from './skill-audit-log.js';
import {
  appendLearningEvent,
  buildLearningIdempotencyKey,
  hasLearningEvent,
} from './learning-events.js';
import { getLatestSkillVersion, recordSkillVersion } from './skill-versions.js';
import { learnPreferenceFromCorrection } from './preference-learner.js';
import type { Message } from '../types/index.js';

export interface LearningLoopInput {
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
  toolCallLog: string[];
  succeeded: boolean;
  sessionId?: string;
  tenantId?: string;
}

export interface LearningLoopResult {
  saved: boolean;
  skillName?: string;
  action?: 'created' | 'refined' | 'incremented' | 'preference_only';
  preferenceLearned?: boolean;
  preferenceText?: string;
  preferenceAction?: 'added' | 'replaced' | 'skipped';
  preferenceSkipReason?: string;
  blockedReason?: string;
  eventId?: string | null;
}

const EVAL_PROMPT = `You are deciding whether a completed agentic task reveals a reusable procedure.

User request: {userMessage}
Tool calls: {toolCallLog}
Outcome (first 400 chars): {summary}
Task succeeded: {succeeded}
User correction: {isCorrection}

Rules:
- Only extract procedures involving 3 or more distinct steps or tools unless this is a user correction.
- Do not extract trivial single-tool lookups.
- Failed tasks can produce "how NOT to do X" skills -- mark steps clearly.
- Respond with JSON only. No prose.

If this is worth extracting:
{"save":true,"name":"kebab-case-name","description":"one sentence","trigger_keywords":["word","word"],"steps":"1. Step\\n2. Step\\n3. Step","tools_used":["tool"]}

If not worth extracting:
{"save":false}`;

const CORRECTION_SIGNALS = [
  'no,', 'no.', 'actually', 'instead,', "that's not", 'not that', 'you should have',
  'incorrect', 'wrong,', 'wrong.', 'fix that', 'do not', "don't", 'never use', 'always use',
  'prefer ', 'stop doing', 'not what i', 'that is wrong', 'try again', 'use post', 'use get',
];

export function classifyCorrection(msg: string): { isCorrection: boolean; signals: string[] } {
  const lower = msg.toLowerCase().trimStart();
  const signals = CORRECTION_SIGNALS.filter((s) => lower.startsWith(s) || lower.includes(` ${s}`));
  return { isCorrection: signals.length > 0, signals };
}

export function isUserCorrection(msg: string): boolean {
  return classifyCorrection(msg).isCorrection;
}

export function skillQualityScore(successCount: number, failureCount: number, usageCount: number): number {
  const total = successCount + failureCount;
  if (total >= 3) return successCount / total;
  return usageCount > 0 ? 0.5 : 0;
}

export function shouldAllowSkillRefinement(input: {
  isCorrection: boolean;
  existingScore: number;
  newScore: number;
  usageCount: number;
  hasIncomingSteps: boolean;
}): { allow: boolean; reason?: string } {
  if (input.isCorrection) return { allow: true };
  if (!input.hasIncomingSteps) return { allow: false, reason: 'no_steps' };
  if (input.newScore <= input.existingScore) {
    return { allow: false, reason: 'weak_evidence' };
  }
  if (input.existingScore >= 0.75 && input.usageCount >= 5 && input.newScore < input.existingScore + 0.15) {
    return { allow: false, reason: 'high_quality_protected' };
  }
  return { allow: true };
}

export interface SkillDraft {
  save: boolean;
  name?: string;
  description?: string;
  trigger_keywords?: string[];
  steps?: string;
  tools_used?: string[];
}

export function parseSkillDraftJson(text: string): SkillDraft | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as SkillDraft;
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'learned-skill';
}

function correctionKeywords(message: string): string[] {
  return message
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 8);
}

async function maybePropagateLearnedSkill(input: {
  skillName: string;
  sessionId?: string;
  tenantId?: string;
  learningEventId?: string | null;
  successCount?: number;
  isCorrection?: boolean;
}): Promise<void> {
  if (process.env.CARINA_CROSS_AGENT_LEARNING === 'false') return;
  try {
    const { propagateSkillAcrossAgents } = await import('./cross-agent-learning.js');
    await propagateSkillAcrossAgents({
      skillName: input.skillName,
      sourceAgentId: process.env.CARINA_ACTIVE_AGENT ?? 'main',
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      learningEventId: input.learningEventId,
      successCount: input.isCorrection ? 99 : input.successCount,
    });
  } catch {
    // propagation must never break learning capture
  }
}

export function mergeStepsOnConflict(
  existingSteps: string,
  incomingSteps: string,
  userMessage: string,
): string {
  const normalizedExisting = existingSteps.trim().toLowerCase();
  const normalizedIncoming = incomingSteps.trim().toLowerCase();
  if (!normalizedIncoming || normalizedExisting.includes(normalizedIncoming)) {
    return existingSteps;
  }
  if (normalizedIncoming.includes(normalizedExisting)) {
    return incomingSteps;
  }
  const stamp = new Date().toISOString().slice(0, 19);
  return `${existingSteps.trim()}\n\nCORRECTION (${stamp}):\n${userMessage.slice(0, 400)}\n\nREVISED STEPS:\n${incomingSteps}`;
}

async function evalForSkill(
  input: LearningLoopInput,
  isCorrection: boolean,
): Promise<{ draft: SkillDraft | null; raw?: string }> {
  const prompt = EVAL_PROMPT
    .replace('{userMessage}', input.userMessage.slice(0, 300))
    .replace('{toolCallLog}', input.toolCallLog.slice(0, 6).join('; ') || 'none')
    .replace('{summary}', input.assistantText.slice(0, 400))
    .replace('{succeeded}', String(input.succeeded))
    .replace('{isCorrection}', String(isCorrection));
  const messages: Message[] = [{ role: 'user', content: prompt, timestamp: new Date() }];
  const response = await llm.chatCheap(messages);
  return { draft: parseSkillDraftJson(response.content), raw: response.content };
}

async function snapshotSkillVersion(
  skill: Pick<Skill, 'id' | 'steps' | 'trigger' | 'toolsUsed'>,
  source: string,
  learningEventId?: string | null,
): Promise<number> {
  const nextVersion = (await getLatestSkillVersion(skill.id)) + 1;
  await recordSkillVersion({
    skillId: skill.id,
    version: nextVersion,
    steps: skill.steps,
    trigger: skill.trigger,
    toolsUsed: skill.toolsUsed,
    source,
    learningEventId,
  });
  return nextVersion;
}

async function refineExistingSkill(input: {
  existing: Skill;
  draft: SkillDraft;
  loopInput: LearningLoopInput;
  isCorrection: boolean;
}): Promise<LearningLoopResult> {
  const existingScore = skillQualityScore(
    Number(input.existing.successCount ?? 0),
    Number(input.existing.failureCount ?? 0),
    input.existing.usageCount ?? 0,
  );
  const newScore = input.loopInput.succeeded ? 1 : 0;

  if (input.loopInput.succeeded) {
    await incrementSkillSuccess(input.existing.id);
  } else {
    await incrementSkillFailure(input.existing.id);
  }

  const refineGate = shouldAllowSkillRefinement({
    isCorrection: input.isCorrection,
    existingScore,
    newScore,
    usageCount: input.existing.usageCount ?? 0,
    hasIncomingSteps: Boolean(input.draft.steps),
  });
  if (!refineGate.allow) {
    await appendLearningEvent({
      tenantId: input.loopInput.tenantId,
      sessionId: input.loopInput.sessionId,
      eventType: 'skill_refine_blocked',
      skillId: input.existing.id,
      skillName: input.existing.name,
      outputSummary: { existingScore, newScore, reason: refineGate.reason, isCorrection: input.isCorrection },
    });
    return { saved: false, skillName: input.existing.name, action: 'incremented', blockedReason: refineGate.reason };
  }

  const mergedSteps = input.isCorrection
    ? mergeStepsOnConflict(input.existing.steps, input.draft.steps!, input.loopInput.userMessage)
    : input.draft.steps!;

  const version = await snapshotSkillVersion(input.existing, 'learning-loop-refine');
  const eventId = await appendLearningEvent({
    tenantId: input.loopInput.tenantId,
    sessionId: input.loopInput.sessionId,
    eventType: input.isCorrection ? 'skill_conflict_resolved' : 'skill_refined',
    skillId: input.existing.id,
    skillName: input.existing.name,
    version,
    outputSummary: { existingScore, newScore, isCorrection: input.isCorrection },
  });
  await updateSkill(input.existing.name, {
    steps: mergedSteps,
    toolsUsed: input.draft.tools_used ?? input.loopInput.toolsUsed,
    trigger: input.draft.trigger_keywords ?? input.existing.trigger,
    status: input.isCorrection ? 'active' : undefined,
  });
  await logSkillAction('refined', input.existing.id, {
    reason: input.isCorrection ? 'user correction' : 'higher quality approach observed',
    version,
    learningEventId: eventId,
  });
  void maybePropagateLearnedSkill({
    skillName: input.existing.name,
    sessionId: input.loopInput.sessionId,
    tenantId: input.loopInput.tenantId,
    learningEventId: eventId,
    successCount: Number(input.existing.successCount ?? 0),
    isCorrection: input.isCorrection,
  });
  return { saved: true, skillName: input.existing.name, action: 'refined', eventId };
}

export async function runLearningLoop(input: LearningLoopInput): Promise<LearningLoopResult> {
  const tenantId = input.tenantId ?? '__operator__';
  const isCorrection = isUserCorrection(input.userMessage);

  if (process.env.CARINA_AUTO_SKILL === 'false' || process.env.SKILL_AUTO_WRITE === 'false') {
    await appendLearningEvent({
      tenantId,
      sessionId: input.sessionId,
      eventType: 'capture_skipped',
      inputSummary: { reason: 'disabled', toolsUsed: input.toolsUsed.length },
    });
    return { saved: false };
  }

  const idempotencyKey = buildLearningIdempotencyKey({
    tenantId,
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    toolsUsed: input.toolsUsed,
    succeeded: input.succeeded,
    isCorrection,
  });

  if (await hasLearningEvent(idempotencyKey)) {
    await appendLearningEvent({
      tenantId,
      sessionId: input.sessionId,
      eventType: 'capture_deduped',
      idempotencyKey,
      inputSummary: { toolsUsed: input.toolsUsed.length, isCorrection },
    });
    return { saved: false };
  }

  try {
    let preferenceLearned = false;
    let preferenceText: string | undefined;
    let preferenceAction: 'added' | 'replaced' | 'skipped' | undefined;
    let preferenceSkipReason: string | undefined;
    if (isCorrection) {
      const pref = await learnPreferenceFromCorrection(input.userMessage, {
        tenantId,
        sessionId: input.sessionId,
      });
      preferenceLearned = pref.learned;
      preferenceText = pref.preference;
      preferenceAction = pref.action;
      if (!pref.learned) {
        preferenceSkipReason = pref.skipReason;
      }
    }

    if (!isCorrection && input.toolsUsed.length < 3) {
      await appendLearningEvent({
        tenantId,
        sessionId: input.sessionId,
        eventType: 'capture_skipped',
        idempotencyKey,
        inputSummary: { reason: 'tool_threshold', toolsUsed: input.toolsUsed.length },
        outputSummary: { preferenceLearned },
      });
      if (preferenceLearned) {
        return {
          saved: false,
          action: 'preference_only',
          preferenceLearned: true,
          preferenceText,
          preferenceAction,
        };
      }
      return { saved: false };
    }

    const { draft, raw } = await evalForSkill(input, isCorrection);
    if (!draft) {
      await appendLearningEvent({
        tenantId,
        sessionId: input.sessionId,
        eventType: 'eval_malformed',
        idempotencyKey,
        inputSummary: { toolsUsed: input.toolsUsed.length, isCorrection },
        internalNotes: { raw: raw?.slice(0, 2000) },
      });
      if (preferenceLearned) {
        return {
          saved: false,
          action: 'preference_only',
          preferenceLearned: true,
          preferenceText,
          preferenceAction,
        };
      }
      return { saved: false };
    }

    if (!draft.save || !draft.name) {
      await appendLearningEvent({
        tenantId,
        sessionId: input.sessionId,
        eventType: 'eval_empty',
        idempotencyKey,
        inputSummary: { toolsUsed: input.toolsUsed.length, isCorrection },
        internalNotes: { raw: raw?.slice(0, 2000) },
      });
      if (preferenceLearned) {
        return {
          saved: false,
          action: 'preference_only',
          preferenceLearned: true,
          preferenceText,
          preferenceAction,
        };
      }
      return { saved: false };
    }

    const keywords = draft.trigger_keywords?.length
      ? draft.trigger_keywords
      : (isCorrection ? correctionKeywords(input.userMessage) : []);

    const byName = await getSkillByName(draft.name);
    if (byName) {
      return refineExistingSkill({ existing: byName, draft, loopInput: input, isCorrection });
    }

    const existing = await findSkillByKeywordOverlap(keywords, isCorrection ? 0.55 : 0.7);
    if (existing) {
      const existingFull = await getSkillByName(existing.name);
      if (existingFull) {
        return refineExistingSkill({ existing: existingFull, draft, loopInput: input, isCorrection });
      }
    }

    let name = draft.name || `learned-${slugify(input.userMessage.slice(0, 50))}`;
    if (await skillExistsByName(name)) {
      name = `${name}-${Date.now().toString(36).slice(-4)}`;
      await appendLearningEvent({
        tenantId,
        sessionId: input.sessionId,
        eventType: 'skill_duplicate_avoided',
        idempotencyKey,
        skillName: draft.name,
        outputSummary: { renamedTo: name },
      });
    }

    const steps = input.succeeded
      ? (draft.steps ?? '')
      : `NOTE: This approach failed. Do not repeat it.\n${draft.steps ?? ''}`;
    const finalSteps = isCorrection
      ? `CORRECTION APPLIED:\n${input.userMessage.slice(0, 400)}\n\n${steps}`
      : steps;

    const saved = await saveSkill({
      name,
      description: draft.description ?? `Auto-learned from task (${input.toolsUsed.join(', ')})`,
      trigger: keywords,
      steps: finalSteps,
      toolsUsed: draft.tools_used ?? input.toolsUsed,
      status: isCorrection ? 'active' : 'draft',
    });

    const version = await recordSkillVersion({
      skillId: saved.id,
      version: 1,
      steps: finalSteps,
      trigger: keywords,
      toolsUsed: draft.tools_used ?? input.toolsUsed,
      source: 'learning-loop-create',
    });

    const eventId = await appendLearningEvent({
      tenantId,
      sessionId: input.sessionId,
      eventType: 'skill_created',
      idempotencyKey,
      skillId: saved.id,
      skillName: name,
      version: version ?? 1,
      inputSummary: {
        toolsUsed: input.toolsUsed.length,
        succeeded: input.succeeded,
        isCorrection,
      },
      outputSummary: { preferenceLearned },
    });

    await logSkillAction('created', saved.id, {
      source: 'learning-loop',
      toolCount: input.toolsUsed.length,
      succeeded: input.succeeded,
      isCorrection,
      version: version ?? 1,
    });

    void maybePropagateLearnedSkill({
      skillName: name,
      sessionId: input.sessionId,
      tenantId,
      learningEventId: eventId,
      successCount: isCorrection ? 99 : 0,
      isCorrection,
    });

    return {
      saved: true,
      skillName: name,
      action: 'created',
      preferenceLearned,
      eventId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendLearningEvent({
      tenantId,
      sessionId: input.sessionId,
      eventType: 'loop_error',
      idempotencyKey,
      outputSummary: { error: message.slice(0, 500) },
    });
    return { saved: false };
  }
}
