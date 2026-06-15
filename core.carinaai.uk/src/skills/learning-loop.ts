import { llm } from '../brain/llm.js';
import {
  findSkillByKeywordOverlap,
  getSkillByName,
  incrementSkillSuccess,
  incrementSkillFailure,
  saveSkill,
  updateSkill,
} from './store.js';
import { logSkillAction } from './skill-audit-log.js';
import type { Message } from '../types/index.js';

export interface LearningLoopInput {
  userMessage: string;
  assistantText: string;
  toolsUsed: string[];
  toolCallLog: string[];
  succeeded: boolean;
}

export interface LearningLoopResult {
  saved: boolean;
  skillName?: string;
  action?: 'created' | 'refined' | 'incremented';
}

const EVAL_PROMPT = `You are deciding whether a completed agentic task reveals a reusable procedure.

User request: {userMessage}
Tool calls: {toolCallLog}
Outcome (first 400 chars): {summary}
Task succeeded: {succeeded}

Rules:
- Only extract procedures involving 3 or more distinct steps or tools.
- Do not extract trivial single-tool lookups.
- Failed tasks can produce "how NOT to do X" skills -- mark steps clearly.
- Respond with JSON only. No prose.

If this is worth extracting:
{"save":true,"name":"kebab-case-name","description":"one sentence","trigger_keywords":["word","word"],"steps":"1. Step\\n2. Step\\n3. Step","tools_used":["tool"]}

If not worth extracting:
{"save":false}`;

const CORRECTION_SIGNALS = ['no,', 'no.', 'actually', 'instead,', 'wrong,', "that's not", 'not that', 'you should have'];

export function isUserCorrection(msg: string): boolean {
  const lower = msg.toLowerCase().trimStart();
  return CORRECTION_SIGNALS.some((s) => lower.startsWith(s) || lower.includes(` ${s}`));
}

function skillQualityScore(successCount: number, failureCount: number, usageCount: number): number {
  const total = successCount + failureCount;
  if (total >= 3) return successCount / total;
  return usageCount > 0 ? 0.5 : 0;
}

interface SkillDraft {
  save: boolean;
  name?: string;
  description?: string;
  trigger_keywords?: string[];
  steps?: string;
  tools_used?: string[];
}

function parseJson(text: string): SkillDraft | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as SkillDraft; } catch { return null; }
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'learned-skill';
}

async function evalForSkill(input: LearningLoopInput): Promise<SkillDraft | null> {
  const prompt = EVAL_PROMPT
    .replace('{userMessage}', input.userMessage.slice(0, 300))
    .replace('{toolCallLog}', input.toolCallLog.slice(0, 6).join('; ') || 'none')
    .replace('{summary}', input.assistantText.slice(0, 400))
    .replace('{succeeded}', String(input.succeeded));
  const messages: Message[] = [{ role: 'user', content: prompt, timestamp: new Date() }];
  const response = await llm.chatCheap(messages);
  return parseJson(response.content);
}

export async function runLearningLoop(input: LearningLoopInput): Promise<LearningLoopResult> {
  if (process.env.CARINA_AUTO_SKILL === 'false' || process.env.SKILL_AUTO_WRITE === 'false') {
    return { saved: false };
  }

  if (isUserCorrection(input.userMessage)) {
    void import('./preference-learner.js')
      .then(({ learnPreferenceFromCorrection }) => learnPreferenceFromCorrection(input.userMessage))
      .catch(() => null);
  }

  if (input.toolsUsed.length < 3) return { saved: false };

  const draft = await evalForSkill(input);
  if (!draft?.save || !draft.name) return { saved: false };

  const keywords = draft.trigger_keywords ?? [];
  const existing = await findSkillByKeywordOverlap(keywords, 0.7);

  if (existing) {
    const existingFull = await getSkillByName(existing.name);
    const existingScore = skillQualityScore(
      Number(existingFull?.successCount ?? 0),
      Number(existingFull?.failureCount ?? 0),
      existing.usageCount,
    );
    const newScore = input.succeeded ? 1 : 0;

    if (input.succeeded) {
      await incrementSkillSuccess(existing.id);
    } else {
      await incrementSkillFailure(existing.id);
    }

    if (newScore > existingScore && draft.steps) {
      await updateSkill(existing.name, { steps: draft.steps, toolsUsed: draft.tools_used ?? input.toolsUsed });
      await logSkillAction('refined', existing.id, { reason: 'higher quality approach observed' });
      return { saved: true, skillName: existing.name, action: 'refined' };
    }
    return { saved: false, skillName: existing.name, action: 'incremented' };
  }

  const name = draft.name || `learned-${slugify(input.userMessage.slice(0, 50))}`;
  const steps = input.succeeded
    ? (draft.steps ?? '')
    : `NOTE: This approach failed. Do not repeat it.\n${draft.steps ?? ''}`;

  const saved = await saveSkill({
    name,
    description: draft.description ?? `Auto-learned from task (${input.toolsUsed.join(', ')})`,
    trigger: keywords,
    steps,
    toolsUsed: draft.tools_used ?? input.toolsUsed,
    status: isUserCorrection(input.userMessage) ? 'active' : 'draft',
  });
  await logSkillAction('created', saved.id, {
    source: 'learning-loop',
    toolCount: input.toolsUsed.length,
    succeeded: input.succeeded,
    isCorrection: isUserCorrection(input.userMessage),
  });
  return { saved: true, skillName: name, action: 'created' };
}
