import type { TranslationKey } from '@/i18n/translate';

export type VoiceTranscriptionHealth = {
  serverTranscription: boolean;
  platformWhisper: boolean;
  localWhisper: boolean;
};

export function resolveVoiceComposerHintKey(input: {
  liveDictationAvailable: boolean;
  platformWhisper: boolean;
  localWhisper: boolean;
}): TranslationKey | null {
  const { liveDictationAvailable, platformWhisper, localWhisper } = input;

  if (liveDictationAvailable && platformWhisper && localWhisper) {
    return 'chat.voiceAllTiers';
  }
  if (liveDictationAvailable && platformWhisper) {
    return 'chat.voiceLivePlatform';
  }
  if (liveDictationAvailable && localWhisper) {
    return 'chat.voiceLiveLocal';
  }
  if (liveDictationAvailable) {
    return 'chat.voiceLiveOnly';
  }
  if (platformWhisper && localWhisper) {
    return 'chat.voiceServerPlatformLocal';
  }
  if (platformWhisper) {
    return 'chat.voiceServerPlatform';
  }
  if (localWhisper) {
    return 'chat.voiceServerLocal';
  }
  return null;
}
