import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import YAML from 'yaml';
import { describeProfile, getActiveProfileName } from './manager.js';

export interface ProfilePersonality {
  name: string;
  tone: string;
  traits: string[];
  instructions: string;
  source: 'personality.md' | 'personality.yaml' | 'default';
}

const DEFAULT_PERSONALITY: ProfilePersonality = {
  name: 'default',
  tone: 'direct and professional',
  traits: ['concise', 'action-oriented', 'honest about limits'],
  instructions: 'Complete tasks fully. Use tools proactively. No emojis or em dashes.',
  source: 'default',
};

function parsePersonalityMd(content: string): ProfilePersonality {
  const lines = content.split('\n');
  const title = lines.find((l) => l.startsWith('# '))?.slice(2).trim() ?? 'custom';
  const toneMatch = content.match(/tone:\s*(.+)/i);
  const traitsMatch = content.match(/traits:\s*(.+)/i);
  const traits = traitsMatch
    ? traitsMatch[1].split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  return {
    name: title,
    tone: toneMatch?.[1]?.trim() ?? 'custom',
    traits,
    instructions: content.trim(),
    source: 'personality.md',
  };
}

function parsePersonalityYaml(content: string): ProfilePersonality {
  const raw = YAML.parse(content) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') return DEFAULT_PERSONALITY;
  return {
    name: String(raw.name ?? 'custom'),
    tone: String(raw.tone ?? 'custom'),
    traits: Array.isArray(raw.traits) ? raw.traits.map(String) : [],
    instructions: String(raw.instructions ?? raw.system_suffix ?? ''),
    source: 'personality.yaml',
  };
}

export async function loadProfilePersonality(profileName?: string): Promise<ProfilePersonality> {
  const name = profileName ?? getActiveProfileName();
  if (!name) return DEFAULT_PERSONALITY;

  const profile = describeProfile(name);
  const mdPath = path.join(profile.dir, 'personality.md');
  const yamlPath = path.join(profile.dir, 'personality.yaml');

  try {
    if (fsSync.existsSync(mdPath)) {
      return parsePersonalityMd(await fs.readFile(mdPath, 'utf8'));
    }
    if (fsSync.existsSync(yamlPath)) {
      return parsePersonalityYaml(await fs.readFile(yamlPath, 'utf8'));
    }
  } catch {
    return DEFAULT_PERSONALITY;
  }

  return { ...DEFAULT_PERSONALITY, name };
}

export function personalityToSystemSuffix(personality: ProfilePersonality): string {
  if (personality.source === 'default') return '';
  const traitLine = personality.traits.length > 0
    ? `Traits: ${personality.traits.join(', ')}.`
    : '';
  return [
    `Active profile personality: ${personality.name}`,
    `Tone: ${personality.tone}.`,
    traitLine,
    personality.instructions,
  ].filter(Boolean).join('\n');
}

export async function ensureDefaultPersonalityFiles(profileName: string): Promise<void> {
  const profile = describeProfile(profileName);
  const mdPath = path.join(profile.dir, 'personality.md');
  if (fsSync.existsSync(mdPath)) return;

  await fs.writeFile(mdPath, `# ${profileName}
tone: direct, warm, and precise
traits: concise, proactive, transparent

Respond as this profile personality. Stay in character while following all safety rules.
`, 'utf8');
}
