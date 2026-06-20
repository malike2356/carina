import type { Converter } from './types.js';
import {
  amazonqConfigConverter,
  aiderConventionsConverter,
  autogptAgentConverter,
  claudeMdConverter,
  clineRulesConverter,
  codyConfigConverter,
  continueConfigConverter,
  copilotInstructionsConverter,
  crewaiAgentConverter,
  cursorRulesConverter,
  devinTaskConverter,
  genericSkillMdConverter,
  langchainConfigConverter,
  piecesSnippetsConverter,
  plainInstructionsConverter,
  replitConfigConverter,
  supermavenRulesConverter,
  tabnineConfigConverter,
  taskadeAgentConverter,
  windsurfRulesConverter,
} from './converters/index.js';

const CONVERTERS: Record<string, Converter> = {
  'cursor-rules': cursorRulesConverter,
  'claude-md': claudeMdConverter,
  'windsurf-rules': windsurfRulesConverter,
  'copilot-instructions': copilotInstructionsConverter,
  'cline-rules': clineRulesConverter,
  'aider-conventions': aiderConventionsConverter,
  'continue-config': continueConfigConverter,
  'crewai-agent': crewaiAgentConverter,
  'langchain-config': langchainConfigConverter,
  'autogpt-agent': autogptAgentConverter,
  'devin-task': devinTaskConverter,
  'replit-config': replitConfigConverter,
  'pieces-snippets': piecesSnippetsConverter,
  'taskade-agent': taskadeAgentConverter,
  'supermaven-rules': supermavenRulesConverter,
  'cody-config': codyConfigConverter,
  'amazonq-config': amazonqConfigConverter,
  'tabnine-config': tabnineConfigConverter,
  'generic-skill-md': genericSkillMdConverter,
  'plain-instructions': plainInstructionsConverter,
};

export function getConverter(converterId: string): Converter | undefined {
  return CONVERTERS[converterId];
}

export function listConverterIds(): string[] {
  return Object.keys(CONVERTERS);
}
