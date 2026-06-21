import type { FormatDetectionResult } from './types.js';

export interface FormatDetectionSpec {
  fileNames?: string[];
  filePaths?: string[];
  contentPatterns?: string[];
  mimeTypes?: string[];
}

export interface FormatMappingField {
  source: 'fileName' | 'content' | 'static';
  value?: string;
  transform?: string;
  extractor?: string;
}

export interface FormatDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  ecosystem: string;
  homepage?: string;
  detection: FormatDetectionSpec;
  mapping?: Record<string, FormatMappingField>;
  permissions?: {
    defaults: {
      network: boolean;
      filesystem: string[];
      shell: boolean;
    };
  };
  examples?: Array<{ input: string; output: Record<string, unknown> }>;
  maintainers?: Array<{ name: string; url: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormatRegistryIndex {
  version: number;
  formats: FormatDefinition[];
  fetchedAt: string;
}

export type RegistryMatch = FormatDetectionResult;
