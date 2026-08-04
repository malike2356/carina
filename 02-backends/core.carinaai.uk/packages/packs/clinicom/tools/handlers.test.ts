import { describe, expect, it } from 'vitest';
import {
  dispatchClinicomTool,
  executeClinicomConfidenceExplain,
  executeClinicomTranslate,
  simplifyText,
} from './handlers.js';

describe('clinicom pack handlers', () => {
  it('translates same-language text unchanged', async () => {
    const result = await executeClinicomTranslate({
      text: 'My chest hurts',
      source_language: 'en',
      target_language: 'en',
    });
    expect(result.translated_text).toBe('My chest hurts');
  });

  it('simplifies jargon', () => {
    const simplified = simplifyText('Patient presents with hypertension.', 8);
    expect(simplified.toLowerCase()).toContain('high blood pressure');
  });

  it('dispatches HTTP route names', async () => {
    const result = await dispatchClinicomTool('speak', { text: 'Hello', language: 'en' });
    expect(result).toMatchObject({ language: 'en', format: 'mp3' });
    expect(String((result as { audio_base64?: string }).audio_base64 ?? '')).not.toBe('');
  });

  it('supports deep AI confidence explanations', async () => {
    const result = await executeClinicomConfidenceExplain({
      score: 82,
      provider_sources: { translation: 'carina' },
    });
    expect(result).toMatchObject({ score: 82 });
    expect(result.source).toBeTruthy();
  });

  it('dispatches deep route names', async () => {
    const result = await dispatchClinicomTool('confidence_explain', { score: 70 });
    expect(result).toMatchObject({ score: 70 });
  });
});
