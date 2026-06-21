export interface FormatMetadata {
  fileName: string;
  sourceUrl: string;
  originalFormat: string;
  content: string;
}

export interface CarinaSkillSource {
  hub: string;
  url: string;
  originalFormat: string;
  convertedAt: string;
  converterVersion: string;
}

export interface CarinaSkillPermissions {
  network: boolean;
  filesystem: string[];
  shell: boolean;
  mcpTools: string[];
}

export interface CarinaSkillDependency {
  name: string;
  version: string;
}

export interface CarinaSkill {
  name: string;
  version: string;
  description: string;
  category: string;
  tags: string[];
  platforms: string[];
  source: CarinaSkillSource;
  tools: {
    required: string[];
    optional: string[];
  };
  triggers: string[];
  dependencies: CarinaSkillDependency[];
  permissions: CarinaSkillPermissions;
  content: string;
}

export type Converter = (content: string, metadata: FormatMetadata) => CarinaSkill;

export interface FormatDetectionResult {
  format: string;
  confidence: number;
  converter?: string;
  metadata?: Partial<FormatMetadata>;
}

export interface IngestOptions {
  forceLlm?: boolean;
  llmModel?: string;
  skipReview?: boolean;
  skipSecurity?: boolean;
  hub?: string;
}

export interface IngestResult {
  skill: CarinaSkill;
  filePath: string;
  detection: FormatDetectionResult;
  securityFlags: string[];
  usedLlm: boolean;
}

export interface LlmConversionResult {
  skill: CarinaSkill;
  warnings: string[];
  confidence: number;
  rawOutput: string;
  tokensUsed: number;
  provider: string;
  model: string;
}
