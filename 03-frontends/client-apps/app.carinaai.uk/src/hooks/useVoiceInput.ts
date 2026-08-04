'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceInputStatus = 'idle' | 'recording' | 'processing';
export type VoiceTranscriptionMode = 'live' | 'server';

const BAR_COUNT = 32;
const SPEECH_FINALIZE_MS = 120;
const DEFAULT_ENDPOINTING_MS = 650;
const DEFAULT_MIN_SPEECH_MS = 350;
const SPEECH_RMS_THRESHOLD = 0.045;

export type UseVoiceInputOptions = {
  /** Auto-fire onEndpoint after this much silence once speech was heard. 0 disables. */
  endpointingMs?: number;
  /** Minimum recording time before auto-endpoint can fire. */
  minSpeechMs?: number;
  /** Called once when silence endpointing triggers (caller should stopRecording). */
  onEndpoint?: () => void;
};

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

function resolveVoiceBlockedReason(input: {
  micBlockedReason: string;
  liveDictationAvailable: boolean;
  serverTranscriptionAvailable: boolean;
  transcriptionHealthLoading: boolean;
}): string {
  if (input.micBlockedReason) return input.micBlockedReason;
  if (input.transcriptionHealthLoading) return '';
  if (input.liveDictationAvailable || input.serverTranscriptionAvailable) return '';
  return 'Voice input is unavailable. Use Chrome or Edge for live dictation, or ensure platform Whisper or local Whisper is configured.';
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const endpointingMs = Math.max(0, options.endpointingMs ?? 0);
  const minSpeechMs = Math.max(0, options.minSpeechMs ?? DEFAULT_MIN_SPEECH_MS);
  const onEndpointRef = useRef(options.onEndpoint);
  onEndpointRef.current = options.onEndpoint;

  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.08));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [livePreview, setLivePreview] = useState('');
  const [error, setError] = useState('');
  const [speechHeard, setSpeechHeard] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const endpointFiredRef = useRef(false);
  const speechHeardRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const endpointingMsRef = useRef(endpointingMs);
  const minSpeechMsRef = useRef(minSpeechMs);
  endpointingMsRef.current = endpointingMs;
  minSpeechMsRef.current = minSpeechMs;
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const speechRef = useRef<SpeechRecognition | null>(null);
  const speechBaseRef = useRef('');
  const livePreviewRef = useRef('');
  const recordingRef = useRef(false);
  const [micReady, setMicReady] = useState(false);
  const [micBlockedReason, setMicBlockedReason] = useState('');
  const [liveDictationAvailable, setLiveDictationAvailable] = useState(false);
  const [serverTranscriptionAvailable, setServerTranscriptionAvailable] = useState(false);
  const [platformWhisperAvailable, setPlatformWhisperAvailable] = useState(false);
  const [localWhisperAvailable, setLocalWhisperAvailable] = useState(false);
  const [transcriptionHealthLoading, setTranscriptionHealthLoading] = useState(true);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceBlockedReason, setVoiceBlockedReason] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.isSecureContext) {
      setMicBlockedReason('Voice input requires HTTPS.');
      setMicReady(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicBlockedReason('Microphone is not available in this browser.');
      setMicReady(false);
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setMicBlockedReason('Audio recording is not supported in this browser.');
      setMicReady(false);
      return;
    }

    const hasLiveDictation = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setLiveDictationAvailable(hasLiveDictation);
    setMicBlockedReason('');
    setMicReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/transcribe/health', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: {
        data?: {
          serverTranscription?: boolean;
          platformWhisper?: boolean;
          localWhisper?: boolean;
        };
      }) => {
        if (cancelled) return;
        setServerTranscriptionAvailable(Boolean(payload.data?.serverTranscription));
        setPlatformWhisperAvailable(Boolean(payload.data?.platformWhisper));
        setLocalWhisperAvailable(Boolean(payload.data?.localWhisper));
      })
      .catch(() => {
        if (!cancelled) setServerTranscriptionAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setTranscriptionHealthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const blocked = resolveVoiceBlockedReason({
      micBlockedReason,
      liveDictationAvailable,
      serverTranscriptionAvailable,
      transcriptionHealthLoading,
    });
    setVoiceBlockedReason(blocked);
    setVoiceReady(micReady && !blocked && !transcriptionHealthLoading);
  }, [
    liveDictationAvailable,
    micBlockedReason,
    micReady,
    serverTranscriptionAvailable,
    transcriptionHealthLoading,
  ]);

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
    if (!SpeechRecognitionImpl) {
      setLiveDictationAvailable(false);
      return;
    }

    setLiveDictationAvailable(true);
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
      if (preview) {
        livePreviewRef.current = preview;
        setLivePreview(preview);
        if (!speechHeardRef.current) {
          speechHeardRef.current = true;
          setSpeechHeard(true);
        }
        lastSpeechAtRef.current = Date.now();
      }
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
    let sum = 0;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const idx = Math.min(bins.length - 1, i * step);
      const normalized = Math.max(0.08, bins[idx] / 255);
      next.push(normalized);
      sum += bins[idx] / 255;
    }
    setLevels(next);

    if (recordingRef.current) {
      const rms = sum / BAR_COUNT;
      const now = Date.now();
      if (rms >= SPEECH_RMS_THRESHOLD) {
        if (!speechHeardRef.current) {
          speechHeardRef.current = true;
          setSpeechHeard(true);
        }
        lastSpeechAtRef.current = now;
      }

      const silenceTarget = endpointingMsRef.current || DEFAULT_ENDPOINTING_MS;
      const canEndpoint =
        endpointingMsRef.current > 0
        && !endpointFiredRef.current
        && speechHeardRef.current
        && now - recordingStartedAtRef.current >= minSpeechMsRef.current
        && now - lastSpeechAtRef.current >= silenceTarget;

      if (canEndpoint) {
        endpointFiredRef.current = true;
        onEndpointRef.current?.();
      }
    }

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
    setSpeechHeard(false);
    speechBaseRef.current = '';
    livePreviewRef.current = '';
    speechHeardRef.current = false;
    endpointFiredRef.current = false;
    lastSpeechAtRef.current = 0;
    recordingStartedAtRef.current = Date.now();

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
    setSpeechHeard(false);
    livePreviewRef.current = '';
    speechBaseRef.current = '';
    speechHeardRef.current = false;
    endpointFiredRef.current = false;
    setLevels(Array(BAR_COUNT).fill(0.08));
  }, [cleanupStream]);

  const resetAfterCapture = useCallback(() => {
    setLivePreview('');
    setSpeechHeard(false);
    livePreviewRef.current = '';
    speechBaseRef.current = '';
    speechHeardRef.current = false;
    endpointFiredRef.current = false;
    setStatus('idle');
    setElapsedMs(0);
    setLevels(Array(BAR_COUNT).fill(0.08));
  }, []);

  const collectBrowserTranscript = useCallback(() => {
    return (livePreviewRef.current || speechBaseRef.current).trim();
  }, []);

  const waitForSpeechFinalize = useCallback(async () => {
    if (!speechRef.current) return;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, SPEECH_FINALIZE_MS);
    });
  }, []);

  const transcribeViaServer = useCallback(
    async (blob: Blob, mimeType: string): Promise<string> => {
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
      if (!text) throw new Error('Empty transcription');
      return text;
    },
    [],
  );

  const stopRecording = useCallback(async (): Promise<string> => {
    if (status !== 'recording') return '';

    const recorder = recorderRef.current;
    const mimeType = recorder?.mimeType || pickRecorderMime();
    const useLiveDictation = Boolean(speechRef.current);
    stopVisualizer();
    stopSpeechPreview();

    if (!recorder) {
      cleanupStream();
      await waitForSpeechFinalize();
      const browserOnly = collectBrowserTranscript();
      resetAfterCapture();
      return browserOnly;
    }

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
    await waitForSpeechFinalize();
    const browserText = collectBrowserTranscript();

    if (useLiveDictation && browserText) {
      setError('');
      resetAfterCapture();
      return browserText;
    }

    if (blob.size === 0) {
      resetAfterCapture();
      if (browserText) return browserText;
      setError('No speech detected');
      return '';
    }

    if (!serverTranscriptionAvailable) {
      resetAfterCapture();
      if (browserText) return browserText;
      setError('No speech detected');
      return '';
    }

    setStatus('processing');

    try {
      const text = await transcribeViaServer(blob, mimeType);
      setError('');
      resetAfterCapture();
      return text;
    } catch (err) {
      if (browserText) {
        setError('');
        resetAfterCapture();
        return browserText;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        useLiveDictation
          ? msg
          : 'Server transcription failed. Use Chrome or Edge for live dictation, or check platform Whisper and local Whisper configuration.',
      );
      resetAfterCapture();
      return '';
    }
  }, [
    cleanupStream,
    collectBrowserTranscript,
    resetAfterCapture,
    serverTranscriptionAvailable,
    status,
    stopSpeechPreview,
    stopVisualizer,
    transcribeViaServer,
    waitForSpeechFinalize,
  ]);

  const transcriptionMode: VoiceTranscriptionMode =
    liveDictationAvailable ? 'live' : serverTranscriptionAvailable ? 'server' : 'server';

  return {
    voiceAvailable: voiceReady,
    voiceReady,
    voiceBlockedReason,
    liveDictationAvailable,
    serverTranscriptionAvailable,
    platformWhisperAvailable,
    localWhisperAvailable,
    transcriptionHealthLoading,
    transcriptionMode,
    status,
    levels,
    elapsedMs,
    elapsedLabel: formatElapsed(elapsedMs),
    livePreview,
    speechHeard,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: status === 'recording',
    isProcessing: status === 'processing',
  };
}
