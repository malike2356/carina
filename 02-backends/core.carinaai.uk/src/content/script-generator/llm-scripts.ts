/**
 * LLM-backed script generation for YouTube Channel with a deterministic
 * template fallback mode (PROPERTY_CHANNEL_SCRIPT_MODE=template|llm).
 */
import { config } from '../../config/index.js';
import { llm } from '../../brain/llm.js';
import type { Message } from '../../types/index.js';
import { getNiche, type ChannelNicheId } from './niches.js';
import { buildTagList, extractPrimaryKeyword } from './seo/keyword-research.js';
import { buildScriptStructure, type StructuredScript } from './templates/script-structure.js';
import { buildDescription, buildTitle } from './templates/metadata.js';

export const SCRIPT_PROMPT_VERSION = 'property-channel-script-v1';

export type ScriptMode = 'template' | 'llm';

export interface LlmScriptGenerationInput {
  niche: ChannelNicheId;
  location: string;
  dayIndex: number;
  date: string;
  theme: string;
}

export interface LlmGeneratedVideoItem {
  dayIndex: number;
  date: string;
  niche: ChannelNicheId;
  theme: string;
  title: string;
  description: string;
  tags: string[];
  thumbnailPrompt: string;
  script: StructuredScript;
  scriptMode: ScriptMode;
  model?: string;
  promptVersion?: string;
}

export function resolveScriptMode(override?: string): ScriptMode {
  const raw = (override ?? process.env.PROPERTY_CHANNEL_SCRIPT_MODE ?? config.propertyChannel.scriptMode ?? 'template')
    .toLowerCase()
    .trim();
  return raw === 'llm' ? 'llm' : 'template';
}

function parseLlmScript(raw: string, fallback: StructuredScript): StructuredScript {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]) as {
      hook?: string;
      body?: string | string[];
      cta?: string;
      estimatedDurationSeconds?: number;
    };
    const hook = String(parsed.hook ?? '').trim() || fallback.sections[0]!.text;
    const bodyPoints = Array.isArray(parsed.body)
      ? parsed.body.map((p) => String(p).trim()).filter(Boolean)
      : String(parsed.body ?? '')
          .split(/\n+/)
          .map((p) => p.replace(/^\d+\.\s*/, '').trim())
          .filter(Boolean);
    const bodyText = (bodyPoints.length ? bodyPoints : fallback.sections[1]!.text.split('\n'))
      .slice(0, 6)
      .map((point, i) => `${i + 1}. ${point}`)
      .join('\n');
    const cta = String(parsed.cta ?? '').trim() || fallback.sections[2]!.text;
    const duration = Number(parsed.estimatedDurationSeconds);
    const sections = [
      { label: 'hook' as const, text: hook, approxSeconds: 15 },
      { label: 'body' as const, text: bodyText, approxSeconds: 180 },
      { label: 'cta' as const, text: cta, approxSeconds: 15 },
    ];
    return {
      sections,
      fullText: [`[HOOK]\n${hook}`, `[BODY]\n${bodyText}`, `[CALL TO ACTION]\n${cta}`].join('\n\n'),
      estimatedDurationSeconds: Number.isFinite(duration) && duration >= 150 && duration <= 360
        ? Math.round(duration)
        : sections.reduce((sum, s) => sum + s.approxSeconds, 0),
    };
  } catch {
    return fallback;
  }
}

async function generateLlmScriptStructure(input: {
  niche: ChannelNicheId;
  location: string;
  theme: string;
  dayIndex: number;
}): Promise<{ script: StructuredScript; model: string }> {
  const niche = getNiche(input.niche);
  const fallback = buildScriptStructure({
    niche,
    location: input.location,
    theme: input.theme,
    dayIndex: input.dayIndex,
  });

  const messages: Message[] = [
    {
      role: 'system',
      content:
        'You write faceless UK YouTube scripts as JSON only. '
        + 'Schema: {"hook":string,"body":string[],"cta":string,"estimatedDurationSeconds":number}. '
        + 'Target spoken length 3-5 minutes. Use UK spelling and UK property or domain terminology. '
        + 'No presenter stage directions. No invented competitor metrics.',
      timestamp: new Date(),
    },
    {
      role: 'user',
      content:
        `Niche: ${niche.label}\nLocation/focus: ${input.location}\nTheme: ${input.theme}\n`
        + `Day index: ${input.dayIndex}\n`
        + 'Return JSON for hook, 4 body points, and cta.',
      timestamp: new Date(),
    },
  ];

  try {
    const response = await llm.chatCheap(messages);
    const model = 'chatCheap';
    return { script: parseLlmScript(response.content ?? '', fallback), model };
  } catch {
    return { script: fallback, model: 'template-fallback' };
  }
}

export async function generateScriptItem(
  input: LlmScriptGenerationInput,
  mode: ScriptMode = resolveScriptMode(),
): Promise<LlmGeneratedVideoItem> {
  const niche = getNiche(input.niche);
  const primaryKeyword = extractPrimaryKeyword(niche, input.location, input.theme);
  const tags = buildTagList(niche, input.location, input.theme);

  let script: StructuredScript;
  let model: string | undefined;
  if (mode === 'llm') {
    const llmResult = await generateLlmScriptStructure(input);
    script = llmResult.script;
    model = llmResult.model;
  } else {
    script = buildScriptStructure({
      niche,
      location: input.location,
      theme: input.theme,
      dayIndex: input.dayIndex,
    });
    model = 'template';
  }

  const uniquenessLine = `This is day ${input.dayIndex + 1} of the ${niche.label.toLowerCase()} calendar for ${input.date}.`;
  const scriptWithUniqueness: StructuredScript = {
    ...script,
    fullText: `${script.fullText}\n\n[NOTE]\n${uniquenessLine}`,
  };

  const title = buildTitle({
    niche,
    location: input.location,
    theme: input.theme,
    primaryKeyword,
    dayIndex: input.dayIndex,
  });
  const description = buildDescription({
    niche,
    location: input.location,
    theme: input.theme,
    primaryKeyword,
    script: scriptWithUniqueness,
    tags,
  });
  const thumbnailPrompt =
    `Bold text overlay reading "${script.sections[0]!.text.slice(0, 40)}" over imagery for ${input.location}, `
    + `${niche.label.toLowerCase()} branding, high contrast, 1280x720.`;

  return {
    dayIndex: input.dayIndex,
    date: input.date,
    niche: input.niche,
    theme: input.theme,
    title,
    description,
    tags,
    thumbnailPrompt,
    script: scriptWithUniqueness,
    scriptMode: mode,
    model,
    promptVersion: SCRIPT_PROMPT_VERSION,
  };
}
