'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceInputStatus = 'idle' | 'recording' | 'processing';

const BAR_COUNT = 32;

function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'audio/webm';
}

function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export function useVoiceInput() {
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.08));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [livePreview, setLivePreview] = useState('');
  const [error, setError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const speechBaseRef = useRef('');
  const recordingRef = useRef(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceBlockedReason, setVoiceBlockedReason] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.isSecureContext) {
      setVoiceBlockedReason('Voice input requires HTTPS.');
      setVoiceReady(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceBlockedReason('Microphone is not available in this browser.');
      setVoiceReady(false);
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setVoiceBlockedReason('Audio recording is not supported in this browser.');
      setVoiceReady(false);
      return;
    }

    setVoiceBlockedReason('');
    setVoiceReady(true);
  }, []);

  const stopVisualizer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
  }, []);

  const stopSpeechPreview = useCallback(() => {
    recordingRef.current = false;
    const speech = speechRef.current;
    if (!speech) return;
    try {
      speech.stop();
    } catch {}
  }, []);

  const cleanupStream = useCallback(() => {
    stopVisualizer();
    stopSpeechPreview();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopSpeechPreview, stopVisualizer]);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  useEffect(() => {
    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) return;

    const speech = new SpeechRecognitionImpl();
    speech.continuous = true;
    speech.interimResults = true;
    speech.lang = navigator.language || 'en-GB';

    speech.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const part = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) finalText += part;
        else interim += part;
      }
      if (finalText) {
        speechBaseRef.current = `${speechBaseRef.current} ${finalText}`.trim();
      }
      const preview = `${speechBaseRef.current} ${interim}`.trim();
      if (preview) setLivePreview(preview);
    };

    speech.onend = () => {
      if (recordingRef.current) {
        try {
          speech.start();
        } catch {}
      }
    };

    speechRef.current = speech;
    return () => {
      recordingRef.current = false;
      try {
        speech.stop();
      } catch {}
      speechRef.current = null;
    };
  }, []);

  const tickLevels = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const bins = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(bins);
    const next: number[] = [];
    const step = Math.max(1, Math.floor(bins.length / BAR_COUNT));
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const idx = Math.min(bins.length - 1, i * step);
      const normalized = Math.max(0.08, bins[idx] / 255);
      next.push(normalized);
    }
    setLevels(next);
    rafRef.current = requestAnimationFrame(tickLevels);
  }, []);

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return;
    if (!voiceReady) {
      setError(voiceBlockedReason || 'Microphone is not available in this browser.');
      return;
    }
    setError('');
    setLivePreview('');
    speechBaseRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start(250);

      recordingRef.current = true;
      const speech = speechRef.current;
      if (speech) {
        try {
          speech.start();
        } catch {}
      }

      setElapsedMs(0);
      timerRef.current = window.setInterval(() => {
        setElapsedMs((value) => value + 100);
      }, 100);
      rafRef.current = requestAnimationFrame(tickLevels);
      setStatus('recording');
    } catch (err) {
      cleanupStream();
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('Permission') ? 'Microphone permission denied' : 'Microphone unavailable');
      setStatus('idle');
    }
  }, [cleanupStream, status, tickLevels, voiceBlockedReason, voiceReady]);

  const cancelRecording = useCallback(() => {
    cleanupStream();
    setStatus('idle');
    setElapsedMs(0);
    setLivePreview('');
    setLevels(Array(BAR_COUNT).fill(0.08));
  }, [cleanupStream]);

  const stopRecording = useCallback(async (): Promise<string> => {
    if (status !== 'recording') return '';

    const recorder = recorderRef.current;
    const mimeType = recorder?.mimeType || pickRecorderMime();
    stopVisualizer();
    stopSpeechPreview();

    if (!recorder) {
      cleanupStream();
      setStatus('idle');
      return livePreview.trim();
    }

    setStatus('processing');

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        resolve(new Blob(chunksRef.current, { type: mimeType }));
      };
      try {
        recorder.stop();
      } catch {
        resolve(new Blob([], { type: mimeType }));
      }
    });

    chunksRef.current = [];

    if (blob.size === 0) {
      setStatus('idle');
      setElapsedMs(0);
      setLevels(Array(BAR_COUNT).fill(0.08));
      return livePreview.trim();
    }

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'X-Transcribe-Lang': (navigator.language || 'en').slice(0, 2),
        },
        body: blob,
      });
      const data = (await res.json()) as { data?: { text?: string }; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Transcription failed');
      }
      const text = String(data.data?.text ?? '').trim();
      if (text) {
        setLivePreview('');
        setStatus('idle');
        setElapsedMs(0);
        setLevels(Array(BAR_COUNT).fill(0.08));
        return text;
      }
      throw new Error('Empty transcription');
    } catch (err) {
      const fallback = livePreview.trim() || speechBaseRef.current.trim();
      if (fallback) {
        setError('');
        setLivePreview('');
        setStatus('idle');
        setElapsedMs(0);
        setLevels(Array(BAR_COUNT).fill(0.08));
        return fallback;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus('idle');
      setElapsedMs(0);
      setLevels(Array(BAR_COUNT).fill(0.08));
      return '';
    }
  }, [cleanupStream, livePreview, status, stopSpeechPreview, stopVisualizer]);

  return {
    voiceAvailable: voiceReady,
    voiceReady,
    voiceBlockedReason,
    status,
    levels,
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
    livePreview,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: status === 'recording',
    isProcessing: status === 'processing',
  };
}
