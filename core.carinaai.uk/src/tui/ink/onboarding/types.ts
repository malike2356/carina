export type OnboardingStep =
  | 'welcome'
  | 'workspace'
  | 'provider'
  | 'api-key'
  | 'home'
  | 'personality'
  | 'tour'
  | 'quickstart'
  | 'done';

export type PersonalityPreset = 'direct' | 'warm' | 'technical' | 'custom';
export type TourChoice = 'yes' | 'no' | 'later';

export interface OnboardingState {
  step: OnboardingStep;
  workspaceName: string | null;
  provider: string | null;
  model: string | null;
  apiKey: string | null;
  homeDir: string | null;
  personality: PersonalityPreset | null;
  tourChoice: TourChoice | null;
}

export const ONBOARDING_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  deepseek: ['deepseek-chat'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
};

export const ONBOARDING_PROVIDERS = [
  { label: 'OpenAI (GPT-4o)', value: 'openai', hint: 'Best overall' },
  { label: 'Anthropic (Claude Sonnet)', value: 'anthropic', hint: 'Best for coding' },
  { label: 'DeepSeek (Chat)', value: 'deepseek', hint: 'Best value' },
  { label: 'Google (Gemini)', value: 'gemini', hint: 'Best for vision' },
  { label: 'Groq (Llama)', value: 'groq', hint: 'Fast inference' },
] as const;

export const DEFAULT_WORKSPACE_NAME = 'My Workspace';
