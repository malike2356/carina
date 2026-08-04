import type { ProviderBenchmarkFixture } from './types.js';

export const PROVIDER_BENCHMARK_FIXTURES: ProviderBenchmarkFixture[] = [
  {
    id: 'context-json-plan',
    category: 'context',
    title: 'Structured plan with retained constraints',
    description: 'Checks whether the model keeps multiple constraints in a short JSON answer.',
    weight: 3,
    maxTokens: 120,
    systemPrompt: 'You are benchmarking context retention and instruction following. Output JSON only.',
    prompt: [
      'You are helping a user recover a stalled onboarding flow.',
      'The user wants three paths: keep current account, switch to own API, or upgrade later.',
      'The account owner is Carina Admin.',
      'Return JSON with keys owner, paths, and primaryRecommendation.',
      'The paths array must include keep_current, own_api, and upgrade_later.',
      'Keep the response under 60 words.',
    ].join(' '),
    expectations: [
      { type: 'json_keys', keys: ['owner', 'paths', 'primaryRecommendation'] },
      { type: 'contains_all', values: ['keep_current', 'own_api', 'upgrade_later'] },
      { type: 'max_words', value: 60 },
    ],
  },
  {
    id: 'instruction-following',
    category: 'instruction',
    title: 'Strict instruction following',
    description: 'Checks whether the model follows a tight formatting contract.',
    weight: 2,
    maxTokens: 100,
    systemPrompt: 'You are benchmarking strict instruction following. Do not add explanation.',
    prompt: 'Reply with exactly two lines. First line: verdict. Second line: reason. Use the words keep, compare, and recover somewhere in the answer.',
    expectations: [
      { type: 'contains_all', values: ['keep', 'compare', 'recover'] },
      { type: 'max_words', value: 20 },
    ],
  },
  {
    id: 'agentic-plan',
    category: 'planning',
    title: 'Multi step recovery plan',
    description: 'Checks whether the model can preserve a multi step recovery plan.',
    weight: 3,
    maxTokens: 140,
    systemPrompt: 'You are benchmarking agentic planning. Be precise and brief.',
    prompt: [
      'A workspace has three issues: broken billing copy, missing contacts sync, and a benchmark page that only compares against static references.',
      'Return a numbered plan with exactly 3 steps.',
      'The first step must mention provider runs.',
      'The second step must mention billing copy.',
      'The third step must mention contacts.',
    ].join(' '),
    expectations: [
      { type: 'contains_all', values: ['1.', '2.', '3.', 'provider runs', 'billing copy', 'contacts'] },
      { type: 'max_words', value: 80 },
    ],
  },
  {
    id: 'context-recall',
    category: 'context',
    title: 'Context recall under detail pressure',
    description: 'Checks whether the model preserves named facts in a compact reply.',
    weight: 3,
    maxTokens: 120,
    systemPrompt: 'You are benchmarking context recall. Do not invent facts.',
    prompt: [
      'Facts: Gemini is the Google provider, DeepSeek is the low cost provider, Claude is the strong reasoning provider.',
      'User request: compare the three providers and mention all three names once.',
      'Also mention that the current task is to build a live benchmark mode.',
      'Return 3 bullet points only.',
    ].join(' '),
    expectations: [
      { type: 'contains_all', values: ['Gemini', 'DeepSeek', 'Claude', 'live benchmark mode'] },
      { type: 'max_words', value: 60 },
    ],
  },
  {
    id: 'json-action',
    category: 'structured',
    title: 'Structured action output',
    description: 'Checks whether the model can emit clean JSON for a downstream UI.',
    weight: 2,
    maxTokens: 100,
    systemPrompt: 'You are benchmarking structured output. JSON only, no markdown.',
    prompt: [
      'Return JSON with keys action, target, confidence, and notes.',
      'The action must be "run_benchmark".',
      'The target must be "providers".',
      'The confidence value should be a number from 0 to 1.',
    ].join(' '),
    expectations: [
      { type: 'json_keys', keys: ['action', 'target', 'confidence', 'notes'] },
      { type: 'contains_all', values: ['run_benchmark', 'providers'] },
    ],
  },
];

export function listProviderBenchmarkFixtureIds(): string[] {
  return PROVIDER_BENCHMARK_FIXTURES.map((fixture) => fixture.id);
}
