export type ReasoningEffort = 'low' | 'medium' | 'high';

export type AuxiliaryTaskName =
  | 'curator'
  | 'vision'
  | 'embedding'
  | 'titleGeneration'
  | 'sessionSearch'
  | 'userModeling'
  | 'summarization';

export interface AuxiliaryModelConfig {
  provider?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
}

export type AuxiliaryModelMap = Partial<Record<AuxiliaryTaskName, AuxiliaryModelConfig>>;

export const AUXILIARY_TASK_NAMES: AuxiliaryTaskName[] = [
  'curator',
  'vision',
  'embedding',
  'titleGeneration',
  'sessionSearch',
  'userModeling',
  'summarization',
];

export function isAuxiliaryTaskName(value: string): value is AuxiliaryTaskName {
  return (AUXILIARY_TASK_NAMES as string[]).includes(value);
}
