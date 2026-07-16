'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Phone, Square } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { cn } from '@/lib/utils';

type CallTurn = {
  id: string;
  role: 'user' | 'worker';
  text: string;
};

type CallState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

type VoiceFeatures = {
  mode?: string;
  duplexProvider?: string;
  bargeIn?: boolean;
  allowPttFallback?: boolean;
  interruptOnSpeech?: boolean;
  showWaveform?: boolean;
  endpointingMs?: number;
};

export function AivaWorkerCallPanel({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName: string;
}) {
  const voice = useVoiceInput();
  const [turns, setTurns] = useState<CallTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [features, setFeatures] = useState<VoiceFeatures>({});
  const [callState, setCallState] = useState<CallState>('idle');
  const [live, setLive] = useState(false);
  const cancelRecording = voice.cancelRecording;
  const speakingRef = useRef(false);
  const liveRef = useRef(false);

  const duplexMode = features.mode === 'duplex';
  const provider = features.duplexProvider ?? 'browser_loop';
  const realtime = duplexMode && (provider === 'realtime' || provider === 'browser_loop');
  const bargeIn = features.bargeIn !== false && features.interruptOnSpeech !== false;

  useEffect(() => {
    void fetch('/api/aiva/features')
      .then((res) => res.json())
      .then((data: { features?: { voice?: VoiceFeatures } }) => {
        setFeatures(data.features?.voice ?? {});
      })
      .catch(() => setFeatures({}));
  }, []);

  useEffect(() => {
    liveRef.current = live;
  }, [live]);

  useEffect(() => {
    return () => {
      cancelRecording();
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [cancelRecording]);

  // Barge-in: if speaking and user starts recording (realtime), cancel TTS
  useEffect(() => {
    if (!bargeIn || !realtime) return;
    if (voice.status === 'recording' && speakingRef.current) {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      speakingRef.current = false;
      setCallState('listening');
    }
  }, [voice.status, bargeIn, realtime]);

  const speakReply = useCallback(async (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    setCallState('speaking');
    speakingRef.current = true;
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
    speakingRef.current = false;
  }, []);

  async function sendTranscript(transcript: string) {
    const cleaned = transcript.trim();
    if (!cleaned) return;
    setPending(true);
    setCallState('thinking');
    setError('');
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: cleaned }]);
    try {
      const res = await fetch(`/api/aiva/employees/${workerId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cleaned }),
      });
      const data = (await res.json()) as {
        reply?: string;
        employeeMessage?: { content?: string };
        message?: { content?: string };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Call turn failed');
        setCallState(liveRef.current ? 'listening' : 'idle');
        return;
      }
      const reply =
        data.reply
        ?? data.employeeMessage?.content
        ?? data.message?.content
        ?? 'Got it.';
      setTurns((prev) => [...prev, { id: `w-${Date.now()}`, role: 'worker', text: reply }]);
      await speakReply(reply);
      if (realtime && liveRef.current) {
        setCallState('listening');
        try {
          await voice.startRecording();
        } catch {
          /* duplex loop best-effort */
        }
      } else {
        setCallState('idle');
      }
    } catch {
      setError('Could not reach the worker');
      setCallState(liveRef.current ? 'listening' : 'idle');
    } finally {
      setPending(false);
    }
  }

  async function toggleTalk() {
    setError('');
    if (voice.status === 'recording') {
      const transcript = await voice.stopRecording();
      await sendTranscript(transcript || voice.livePreview);
      return;
    }
    try {
      if (realtime) {
        setLive(true);
        setCallState('connecting');
        setTimeout(() => setCallState('listening'), 200);
      }
      await voice.startRecording();
      if (realtime) setCallState('listening');
    } catch {
      setError(voice.voiceBlockedReason || 'Microphone unavailable');
      setCallState('idle');
      setLive(false);
    }
  }

  async function endCall() {
    setLive(false);
    setCallState('ended');
    cancelRecording();
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setTimeout(() => setCallState('idle'), 400);
  }

  const stateLabel = {
    idle: 'Idle',
    connecting: 'Connecting',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    ended: 'Ended',
  }[callState];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Phone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">Call {workerName}</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {stateLabel}
              {realtime ? ` · ${provider}` : ' · PTT'}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {realtime
              ? 'Realtime duplex with barge-in. End call to stop.'
              : 'Push to talk. Enable duplex in depth-features for continuous calls.'}
          </p>
        </div>
      </div>

      {voice.voiceBlockedReason ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">{voice.voiceBlockedReason}</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="min-h-[16rem] space-y-3 rounded-xl border border-border bg-elevated p-4">
        {turns.length === 0 ? (
          <p className="text-sm text-text-muted">No call turns yet. Press talk to start.</p>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                'max-w-[90%] rounded-2xl px-4 py-2 text-sm',
                turn.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-overlay text-text-primary',
              )}
            >
              {turn.text}
            </div>
          ))
        )}
      </div>

      {features.showWaveform !== false && voice.livePreview ? (
        <p className="text-xs text-text-muted">Live: {voice.livePreview}</p>
      ) : null}

      <button
        type="button"
        disabled={pending || Boolean(voice.voiceBlockedReason)}
        onClick={() => void toggleTalk()}
        className={cn(
          'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold',
          voice.status === 'recording'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'btn-primary',
          (pending || voice.voiceBlockedReason) && 'opacity-70',
        )}
      >
        {voice.status === 'recording' ? (
          <>
            <Square className="h-4 w-4" />
            Stop and send ({voice.elapsedMs > 0 ? `${Math.round(voice.elapsedMs / 1000)}s` : '...'})
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            {pending
              ? 'Waiting for reply...'
              : realtime
                ? (live ? 'Continue talking' : 'Start realtime call')
                : 'Push to talk'}
          </>
        )}
      </button>
      {realtime && live ? (
        <button type="button" onClick={() => void endCall()} className="btn-ghost w-full min-h-10 text-sm">
          End call
        </button>
      ) : null}
    </section>
  );
}
