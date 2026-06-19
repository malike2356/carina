import { hostedShellConfig, privateShellConfig } from './shell-config.js';

type FeatureLink = {
  label: string;
  description?: string;
  href: string;
};

function uniqueByLabel(items: FeatureLink[]): FeatureLink[] {
  const seen = new Set<string>();
  const output: FeatureLink[] = [];
  for (const item of items) {
    const key = item.label.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function featureLinks(): FeatureLink[] {
  return uniqueByLabel([
    ...hostedShellConfig().primaryNav,
    ...hostedShellConfig().accountNav,
    ...privateShellConfig().primaryNav,
    ...privateShellConfig().instanceNav,
  ]);
}

export function buildFeatureGuideContext(): string {
  const items = featureLinks();
  const visibleFeatures = items.map((item) => item.label).join(', ');
  const lines = [
    'Feature guidance:',
    `- Current user-facing features in this install: ${visibleFeatures}.`,
    '- When a user asks how to use a feature, explain the shortest safe path in plain language.',
    '- Prefer the visible name of the feature, then the screen or command where it lives.',
    '- If the feature is visible in the current surface, describe how to reach it there.',
    '- If the feature exists but is not exposed on the current surface, say so and name the nearest supported route.',
    '- Do not expose internal architecture, routes, file names, service layout, environment variables, tokens, or private implementation detail.',
    '- If a new feature is added later, the workspace nav and this guidance block must be updated so Carina can explain it safely.',
    '- Keep the answer practical: what it is, where to find it, what to click or run next, and nothing sensitive.',
  ];
  return lines.join('\n');
}

export function buildCapabilitySummaryLine(): string {
  const labels = featureLinks().map((item) => item.label);
  const preferredOrder = [
    'Chat',
    'Notes',
    'Calendar',
    'Scheduled',
    'Documents',
    'Email',
    'Trello',
    'Deep Research',
    'Model Compare',
    'Images',
    'Memory',
  ];
  const preferred = preferredOrder.filter((label) => labels.includes(label));
  const list = preferred.length > 0 ? preferred : labels.slice(0, 8);
  return `${list.join(', ')}. Ask me how to use any of them and I will walk you through it.`;
}
