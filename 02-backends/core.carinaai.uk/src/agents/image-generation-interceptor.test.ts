import { describe, expect, it } from 'vitest';
import {
  buildImagePromptFromRequest,
  isImageGenerationRequest,
} from './image-generation-interceptor.js';

describe('image-generation-interceptor', () => {
  it('detects welcome banner requests', () => {
    expect(
      isImageGenerationRequest('Generate a welcome banner for a new VERLOX staff member.'),
    ).toBe(true);
  });

  it('ignores casual chat', () => {
    expect(isImageGenerationRequest('hello')).toBe(false);
  });

  it('builds a detailed VERLOX welcome banner prompt', () => {
    const prompt = buildImagePromptFromRequest(
      'Generate a welcome banner for a new VERLOX staff member.',
    );
    expect(prompt).toContain('VERLOX');
    expect(prompt).toContain('Welcome to the Team');
    expect(prompt).toMatch(/photorealistic|marketing graphic/i);
  });
});
