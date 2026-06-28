import { primaryMandatoryTools } from '../tools/mandatory-tools.js';

export function isImageGenerationRequest(message: string): boolean {
  return primaryMandatoryTools(message).includes('image-generation');
}

/** Turn a user request into a DALL-E prompt with enough visual detail. */
export function buildImagePromptFromRequest(message: string): string {
  const base = message.trim();
  if (!base) return 'Professional corporate welcome graphic';

  if (/\bwelcome\s+banner\b/i.test(base) && /\bverlox\b/i.test(base)) {
    return [
      'Professional welcome banner for a new staff member at VERLOX Ltd.',
      'Modern corporate design, landscape orientation.',
      'Deep navy background (#0B1829), indigo accent (#6366f1), subtle gold highlights (#C9A84C).',
      'Centered white card with bold headline text: "Welcome to the Team!"',
      'VERLOX wordmark visible, friendly and professional, subtle tech motifs.',
      'No watermark, no ASCII art, photorealistic marketing graphic.',
      `User request context: ${base}`,
    ].join(' ');
  }

  if (/\b(banner|poster|graphic|logo|illustration|image|picture|visual)\b/i.test(base)) {
    return `${base}. High quality marketing graphic, clean composition, no watermark.`;
  }

  return base;
}
