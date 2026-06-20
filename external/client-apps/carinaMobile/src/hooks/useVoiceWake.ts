import {
  ExpoSpeechRecognitionModule,
  addSpeechRecognitionListener,
  isRecognitionAvailable,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  containsWakePhrase,
  incrementWakeCount,
  isPrivacyHour,
} from '@/lib/voice-wake-settings';

const PICOVOICE_ACCESS_KEY = process.env.EXPO_PUBLIC_PICOVOICE_KEY ?? '';
const DEV_BUILTIN_KEYWORD = 'computer';

export interface VoiceWakeState {
  isListening: boolean;
  isWoken: boolean;
  error: string | null;
  wakeCount: number;
  engine: 'porcupine' | 'speech' | 'none';
}

export function useVoiceWake(opts: {
  enabled: boolean;
  onWake: () => void;
  privacyHoursStart?: number;
  privacyHoursEnd?: number;
  initialWakeCount?: number;
}) {
  const [state, setState] = useState<VoiceWakeState>({
    isListening: false,
    isWoken: false,
    error: null,
    wakeCount: opts.initialWakeCount ?? 0,
    engine: 'none',
  });

  const porcupineRef = useRef<{ stop: () => Promise<void>; delete: () => Promise<void> } | null>(null);
  const speechSubsRef = useRef<Array<{ remove: () => void }>>([]);
  const armedRef = useRef(false);

  const checkPrivacy = useCallback((): boolean => {
    if (opts.privacyHoursStart == null || opts.privacyHoursEnd == null) return false;
    return isPrivacyHour(new Date().getHours(), opts.privacyHoursStart, opts.privacyHoursEnd);
  }, [opts.privacyHoursEnd, opts.privacyHoursStart]);

  const clearSpeechListeners = useCallback(() => {
    for (const sub of speechSubsRef.current) sub.remove();
    speechSubsRef.current = [];
  }, []);

  const handleWake = useCallback(async () => {
    const nextCount = await incrementWakeCount();
    setState((prev) => ({ ...prev, isWoken: true, wakeCount: nextCount }));
    opts.onWake();
  }, [opts]);

  const stopSpeechWake = useCallback(async () => {
    clearSpeechListeners();
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
    armedRef.current = false;
    setState((prev) => ({ ...prev, isListening: false }));
  }, [clearSpeechListeners]);

  const startSpeechWake = useCallback(async () => {
    if (!isRecognitionAvailable()) {
      setState((prev) => ({
        ...prev,
        error: 'Speech recognition is not available on this device.',
        engine: 'none',
      }));
      return;
    }

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setState((prev) => ({ ...prev, error: 'Microphone permission denied', engine: 'none' }));
      return;
    }

    clearSpeechListeners();
    speechSubsRef.current.push(
      addSpeechRecognitionListener('result', (event) => {
        const transcript = event.results?.map((r) => r.transcript).join(' ').trim() ?? '';
        if (transcript && containsWakePhrase(transcript)) {
          void stopSpeechWake();
          void handleWake();
        }
      }),
      addSpeechRecognitionListener('error', () => {
        setState((prev) => ({ ...prev, error: 'Wake listener stopped unexpectedly' }));
        armedRef.current = false;
      }),
      addSpeechRecognitionListener('end', () => {
        if (armedRef.current && opts.enabled && !checkPrivacy()) {
          try {
            void ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true, continuous: true });
          } catch {
            // ignore restart errors
          }
        }
      }),
    );

    await ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true, continuous: true });
    armedRef.current = true;
    setState((prev) => ({ ...prev, isListening: true, error: null, engine: 'speech' }));
  }, [checkPrivacy, clearSpeechListeners, handleWake, opts.enabled, stopSpeechWake]);

  const stopPorcupine = useCallback(async () => {
    if (porcupineRef.current) {
      await porcupineRef.current.stop();
      await porcupineRef.current.delete();
      porcupineRef.current = null;
    }
  }, []);

  const startPorcupine = useCallback(async () => {
    if (!PICOVOICE_ACCESS_KEY) return false;
    try {
      const mod = await import('@picovoice/porcupine-react-native');
      const PorcupineManager = mod.default;
      const manager = await PorcupineManager.fromBuiltInKeywords(
        PICOVOICE_ACCESS_KEY,
        [DEV_BUILTIN_KEYWORD],
        () => {
          void handleWake();
        },
        (err: unknown) => {
          setState((prev) => ({ ...prev, error: String(err) }));
        },
      );
      await manager.start();
      porcupineRef.current = manager;
      setState((prev) => ({ ...prev, isListening: true, error: null, engine: 'porcupine' }));
      return true;
    } catch {
      return false;
    }
  }, [handleWake]);

  const startListening = useCallback(async () => {
    if (!opts.enabled || checkPrivacy()) return;
    const porcupineOk = await startPorcupine();
    if (!porcupineOk) {
      await startSpeechWake();
    }
  }, [checkPrivacy, opts.enabled, startPorcupine, startSpeechWake]);

  const stopListening = useCallback(async () => {
    await stopPorcupine();
    await stopSpeechWake();
    setState((prev) => ({ ...prev, isListening: false, engine: 'none' }));
  }, [stopPorcupine, stopSpeechWake]);

  useEffect(() => {
    if (opts.enabled && !checkPrivacy()) {
      void startListening();
    } else {
      void stopListening();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && opts.enabled && !checkPrivacy()) {
        void startListening();
      } else if (nextState === 'background' && Platform.OS === 'ios') {
        void stopListening();
      }
    });

    return () => {
      sub.remove();
      void stopListening();
    };
  }, [opts.enabled, checkPrivacy, startListening, stopListening]);

  return { ...state, startListening, stopListening };
}
