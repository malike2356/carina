import {
  ExpoSpeechRecognitionModule,
  addSpeechRecognitionListener,
  isRecognitionAvailable,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bufferRef = useRef('');
  const subsRef = useRef<Array<{ remove: () => void }>>([]);

  useEffect(() => {
    try {
      setAvailable(isRecognitionAvailable());
    } catch {
      setAvailable(false);
    }
  }, []);

  const clearListeners = useCallback(() => {
    for (const sub of subsRef.current) sub.remove();
    subsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    clearListeners();
    ExpoSpeechRecognitionModule.stop();
    setListening(false);
    const text = bufferRef.current.trim();
    if (text) onTranscript(text);
    bufferRef.current = '';
  }, [clearListeners, onTranscript]);

  const start = useCallback(async () => {
    setError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission denied');
      return;
    }

    bufferRef.current = '';
    clearListeners();

    subsRef.current.push(
      addSpeechRecognitionListener('result', (event) => {
        const transcript =
          event.results?.map((result) => result.transcript).join(' ').trim() ?? '';
        if (transcript) bufferRef.current = transcript;
      }),
      addSpeechRecognitionListener('end', () => {
        clearListeners();
        setListening(false);
        const text = bufferRef.current.trim();
        if (text) onTranscript(text);
        bufferRef.current = '';
      }),
      addSpeechRecognitionListener('error', () => {
        clearListeners();
        setListening(false);
        setError('Voice recognition failed');
      }),
    );

    ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true });
    setListening(true);
  }, [clearListeners, onTranscript]);

  const toggle = useCallback(async () => {
    if (listening) {
      stop();
      return;
    }
    if (!available) {
      setError('Voice input requires a development build');
      return;
    }
    await start();
  }, [available, listening, start, stop]);

  useEffect(() => () => clearListeners(), [clearListeners]);

  return { available, listening, error, toggle, stop };
}
