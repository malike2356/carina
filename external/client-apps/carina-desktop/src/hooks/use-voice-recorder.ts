import { useCallback, useRef, useState } from 'react';
import { transcribeAudio } from '../lib/gateway-client.js';

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setElapsedMs(0);
      timerRef.current = window.setInterval(() => {
        setElapsedMs((value) => value + 100);
      }, 100);
    } catch {
      setError('Voice not available');
      setRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    stopTimer();
    const recorder = recorderRef.current;
    if (!recorder) return '';

    return await new Promise<string>((resolve) => {
      recorder.onstop = () => {
        void (async () => {
          recorder.stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          recorderRef.current = null;
          setRecording(false);
          setElapsedMs(0);
          if (blob.size === 0) {
            resolve('');
            return;
          }
          try {
            const text = await transcribeAudio(blob, blob.type || 'audio/webm');
            resolve(text);
          } catch {
            setError('Voice not available');
            resolve('');
          }
        })();
      };
      recorder.stop();
    });
  }, [stopTimer]);

  const toggleRecording = useCallback(async (): Promise<string> => {
    if (recording) {
      return stopRecording();
    }
    await startRecording();
    return '';
  }, [recording, startRecording, stopRecording]);

  return {
    recording,
    elapsedMs,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
