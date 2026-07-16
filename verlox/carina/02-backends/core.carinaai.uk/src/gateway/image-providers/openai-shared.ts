import type { OpenAiSize } from './shared.js';

export type GptImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto';

export function mapToGptImageSize(size: OpenAiSize): GptImageSize {
  if (size === '1792x1024') return '1536x1024';
  if (size === '1024x1792') return '1024x1536';
  return '1024x1024';
}

export {
  imageBufferFromResponse,
  imageBufferFromUrl,
  parseSizeDimensions,
  resolveOpenAiSize,
} from './shared.js';
