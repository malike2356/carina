import {
  ExpoSpeechRecognitionModule,
  addSpeechRecognitionListener,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useVoiceCapture() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subsRef = useRef<Array<{ remove: () => void }>>([]);

  const clearListeners = useCallback(() => {
    for (const sub of subsRef.current) sub.remove();
    subsRef.current = [];
  }, []);

  const stopCapture = useCallback(async () => {
    clearListeners();
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore stop errors
    }
    setIsRecording(false);
  }, [clearListeners]);

  const startCapture = useCallback(async () => {
    setError(null);
    setTranscript('');

    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone permission denied');
      return;
    }

    clearListeners();
    subsRef.current.push(
      addSpeechRecognitionListener('result', (event) => {
        const text = event.results?.map((r) => r.transcript).join(' ').trim() ?? '';
        if (text) setTranscript(text);
      }),
      addSpeechRecognitionListener('end', () => {
        setIsRecording(false);
      }),
      addSpeechRecognitionListener('error', () => {
        setError('Voice capture failed');
        setIsRecording(false);
      }),
    );

    await ExpoSpeechRecognitionModule.start({ lang: 'en-GB', interimResults: true });
    setIsRecording(true);
  }, [clearListeners]);

  useEffect(() => () => {
    clearListeners();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
  }, [clearListeners]);

  return { transcript, isRecording, error, startCapture, stopCapture };
}
