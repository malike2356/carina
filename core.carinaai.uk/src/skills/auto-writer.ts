import { config } from '../config/index.js';
import { llm } from '../brain/llm.js';
import {
  findSkillByKeywordOverlap,
  incrementSkillUsage,
  saveSkill,
} from './store.js';
import type { Message } from '../types/index.js';

const EVAL_PROMPT = `You are evaluating whether a completed agentic task produced a reusable procedure.

Task: {userMessage}
Steps taken: {toolCallLog}
Final output summary: {summary}

If this demonstrates a procedure worth saving so Carina does not have to re-derive it,
respond with JSON matching the skill schema. If not, respond: { "save": false }

Skill schema:
{
  "save": true,
  "name": "kebab-case-skill-name",
  "description": "one sentence - what this skill does",
  "trigger_keywords": ["keyword", "keyword"],
  "steps": "1. Step one\\n2. Step two\\n...",
  "tools_used": ["tool-name"]
}`;

interface SkillDraft {
  save: boolean;
  name?: string;
  description?: string;
  trigger_keywords?: string[];
  steps?: string;
  tools_used?: string[];
}

export interface SkillWriteInput {
  userMessage: string;
  response: string;
  toolsUsed: string[];
  toolCallLog: string[];
  multiStep: boolean;
}

export async function evaluateAndWriteSkill(input: SkillWriteInput): Promise<void> {
  if (!config.carina.skillAutoWrite) return;

  const shouldEvaluate =
    input.multiStep || input.toolsUsed.length > 0;
  if (!shouldEvaluate) return;

  const summary = input.response.slice(0, 300);
  const prompt = EVAL_PROMPT
    .replace('{userMessage}', input.userMessage)
    .replace('{toolCallLog}', input.toolCallLog.join('; ') || 'none')
    .replace('{summary}', summary);

  const messages: Message[] = [
    { role: 'user', content: prompt, timestamp: new Date() },
  ];

  try {
    const response = await llm.chatCheap(messages);
    const parsed = parseSkillJson(response.content);
    if (!parsed?.save) return;

    const keywords = parsed.trigger_keywords ?? [];
    const existing = await findSkillByKeywordOverlap(keywords, 0.8);
    if (existing) {
      await incrementSkillUsage(existing.id);
      console.log(`Skill usage incremented: ${existing.name}`);
      return;
    }

    await saveSkill({
      name: parsed.name ?? 'unnamed-skill',
      description: parsed.description ?? '',
      trigger: keywords,
      steps: parsed.steps ?? '',
      toolsUsed: parsed.tools_used ?? input.toolsUsed,
    });
    console.log(`Skill saved: ${parsed.name}`);
  } catch (err) {
    console.warn(
      'Skill auto-write failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

function parseSkillJson(text: string): SkillDraft | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as SkillDraft;
  } catch {
    return null;
  }
}
