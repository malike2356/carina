import { loadDepthFeatures } from './features.js';
import { proposeWorkerSkill } from './depth-extras.js';
import { listToolGrants } from '../spinnable-parity-store.js';

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchSaveAsSkillPhrase(userMessage: string): string | null {
  const features = loadDepthFeatures();
  if (features.skills.conversationalSave === false) return null;
  const phrases = features.skills.savePhrases ?? [];
  if (phrases.length === 0) return null;
  const normalized = normalizePhrase(userMessage);
  for (const phrase of phrases) {
    const p = normalizePhrase(phrase);
    if (!p) continue;
    if (normalized === p || normalized.includes(p)) return phrase;
  }
  return null;
}

export async function handleConversationalSaveAsSkill(input: {
  workspaceId: string;
  workerId: string;
  userMessage: string;
  recentReply?: string;
  usedToolSlugs?: string[];
}): Promise<{ handled: boolean; ack?: string; mode?: string }> {
  const matched = matchSaveAsSkillPhrase(input.userMessage);
  if (!matched) return { handled: false };

  const features = loadDepthFeatures();
  const grants = await listToolGrants(input.workspaceId, input.workerId);
  const granted = new Set(
    grants.filter((g) => g.status === 'connected').map((g) => g.toolSlug),
  );
  let toolSlugs = (input.usedToolSlugs ?? []).filter(Boolean);
  if (features.skills.bindToolsStrict) {
    toolSlugs = toolSlugs.filter((slug) => granted.has(slug));
  }

  const titleHint = input.userMessage.replace(new RegExp(matched, 'ig'), '').trim();
  const title = titleHint.slice(0, 80) || `Skill from chat (${new Date().toISOString().slice(0, 10)})`;
  const description = (input.recentReply ?? 'Saved from conversational request.').slice(0, 500);
  const steps = [
    { type: 'chat_request', text: input.userMessage },
    ...(input.recentReply ? [{ type: 'assistant_summary', text: description }] : []),
  ];

  const result = await proposeWorkerSkill({
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    title,
    description,
    steps,
    toolSlugs,
    sourceRef: `conversational:${matched}`,
  });

  if (result.mode === 'saved') {
    return {
      handled: true,
      mode: 'saved',
      ack: `Saved skill "${title}". You can run it from the Skills panel.`,
    };
  }
  return {
    handled: true,
    mode: 'proposed',
    ack: `Queued skill proposal "${title}". Confirm it under Skills → Pending proposals.`,
  };
}
