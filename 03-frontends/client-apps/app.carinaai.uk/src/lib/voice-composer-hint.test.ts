import { describe, expect, it } from 'vitest';
import { resolveVoiceComposerHintKey } from '@/lib/voice-composer-hint';

describe('resolveVoiceComposerHintKey', () => {
  it('returns live-only when only browser dictation is available', () => {
    expect(
      resolveVoiceComposerHintKey({
        liveDictationAvailable: true,
        platformWhisper: false,
        localWhisper: false,
      }),
    ).toBe('chat.voiceLiveOnly');
  });
});
