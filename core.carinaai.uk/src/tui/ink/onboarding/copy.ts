import type { PersonalityPreset } from './types.js';

export const ONBOARDING_STEP_COUNT = 6;

export const API_KEY_ERRORS = {
  invalid: 'Hmm, that API key did not work. Double-check it and try again.',
  network: 'I cannot reach the provider right now. Check your connection and try again.',
  validating: 'Checking your key...',
  verified: 'Verified',
} as const;

export const PERSONALITY_PRESETS: Array<{
  value: PersonalityPreset;
  label: string;
  hint: string;
  preview: string;
}> = [
  {
    value: 'direct',
    label: 'Direct & concise',
    hint: 'Just the facts. No fluff.',
    preview: "Hey. I'm Carina. I'll be direct, skip the pleasantries, and get straight to what matters.",
  },
  {
    value: 'warm',
    label: 'Warm & playful',
    hint: 'Friendly coworker who knows everything.',
    preview: "Hey! I'm Carina. Think of me as the sharp coworker who actually enjoys helping.",
  },
  {
    value: 'technical',
    label: 'Technical expert',
    hint: 'Precise. Thorough. Code-first.',
    preview: "I'm Carina. I'll be precise, cite assumptions, and prefer concrete steps over hand-waving.",
  },
  {
    value: 'custom',
    label: 'Custom',
    hint: 'Write your own SOUL.md later.',
    preview: 'You can shape my voice anytime in your workspace SOUL.md file.',
  },
];

export const SOUL_SNIPPETS: Record<Exclude<PersonalityPreset, 'custom'>, string> = {
  direct: `# SOUL.md

Be direct and concise. Lead with the answer, then context if needed.
Skip pleasantries on task work. Warm on people moments.
Have opinions. Disagree when it helps. No performative enthusiasm.
`,
  warm: `# SOUL.md

Be warm, competent, and lightly playful. Friendly coworker energy.
Have opinions. You are allowed to find things amusing or interesting.
Be resourceful before asking. Earn trust through competence.
`,
  technical: `# SOUL.md

Be precise, thorough, and code-first. Name assumptions and edge cases.
Prefer concrete steps, file paths, and verifiable checks over vague advice.
Warm on people moments; surgical on technical work.
`,
};

export const QUICKSTART_LINES = [
  { label: 'Chat', command: 'carina', detail: 'Start a conversation. Code, research, create, analyze.' },
  { label: 'Terminal UI', command: 'carina', detail: 'Full terminal experience with streaming and tools.' },
  { label: 'Setup', command: 'carina setup', detail: 'Re-run onboarding or change your provider.' },
  { label: 'Doctor', command: 'carina doctor', detail: 'Diagnose and repair issues automatically.' },
  { label: 'Skills', command: 'carina hub search <topic>', detail: 'Install skills from the community.' },
  { label: 'Scout', command: 'carina scout status', detail: 'AI security monitoring add-on.' },
  { label: 'Cron', command: 'carina cron create "..."', detail: 'Schedule recurring tasks and briefings.' },
  { label: 'Mobile', command: 'carina pair', detail: 'Pair your phone for relay, camera, and notifications.' },
] as const;

export function personalityLabel(preset: PersonalityPreset | null): string {
  return PERSONALITY_PRESETS.find((p) => p.value === preset)?.label ?? 'Default';
}
