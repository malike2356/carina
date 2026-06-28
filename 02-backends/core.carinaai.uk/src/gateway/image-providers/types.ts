export type ImageAspectRatio = 'square' | 'landscape' | 'portrait';

export interface ImageGenModelInfo {
  id: string;
  display: string;
  speed?: string;
  strengths?: string;
  price?: string;
}

export interface ImageGenSetupSchema {
  name: string;
  badge?: string;
  tag?: string;
  envVars: Array<{ key: string; prompt: string; url?: string }>;
}

export interface ImageGenGenerateInput {
  prompt: string;
  width?: number;
  height?: number;
  model?: string;
}

export interface ImageGenGenerateResult {
  buffer: Buffer;
  model: string;
  width: number;
  height: number;
}

export interface ImageGenProvider {
  readonly name: string;
  readonly displayName: string;
  isAvailable(): boolean;
  listModels(): ImageGenModelInfo[];
  defaultModel(): string;
  getSetupSchema(): ImageGenSetupSchema;
  generate(input: ImageGenGenerateInput): Promise<ImageGenGenerateResult>;
}
