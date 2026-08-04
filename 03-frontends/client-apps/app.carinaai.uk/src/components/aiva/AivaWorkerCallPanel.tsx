'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2, Mic, Phone, Radio, Square } from 'lucide-react';
import { useAivaRealtimeCall } from '@/hooks/useAivaRealtimeCall';
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
  preferServerTts?: boolean;
};

const STATE_COPY: Record<CallState, string> = {
  idle: 'Ready when you are',
  connecting: 'Opening microphone…',
  listening: 'Listening… speak naturally',
  thinking: 'Thinking…',
  speaking: 'Speaking… interrupt anytime',
  ended: 'Call ended',
};

function CallWaveform({
  levels,
  active,
  tone,
}: {
  levels: number[];
  active: boolean;
  tone: 'listen' | 'speak' | 'think' | 'idle';
}) {
  const color =
    tone === 'listen'
      ? 'bg-emerald-400'
      : tone === 'speak'
        ? 'bg-amber-400'
        : tone === 'think'
          ? 'bg-sky-400'
          : 'bg-white/25';

  return (
    <div className="flex h-10 items-end justify-center gap-0.5" aria-hidden>
      {(levels.length ? levels : Array(24).fill(0.12)).slice(0, 28).map((level, i) => (
        <span
          key={i}
          className={cn('w-1 rounded-full transition-[height,opacity] duration-75', color)}
          style={{
            height: `${Math.max(8, Math.round((active ? level : 0.12) * 36))}px`,
            opacity: active ? 0.45 + level * 0.55 : 0.35,
          }}
        />
      ))}
    </div>
  );
}

function PstnDialForm({ workerId }: { workerId: string }) {
  const [to, setTo] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [voiceNumber, setVoiceNumber] = useState<string | null>(null);
  const [channelReady, setChannelReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/channels`);
        if (!res.ok) {
          if (!cancelled) setChannelReady(false);
          return;
        }
        const data = (await res.json()) as {
          channels?: Array<{ channel?: string; type?: string; enabled?: boolean; connected?: boolean; identifier?: string }>;
        };
        const channels = data.channels ?? [];
        const isConnected = (c: (typeof channels)[number]) =>
          c.connected === true || (c.connected !== false && c.enabled !== false && Boolean(c.identifier));
        const voice = channels.find((c) => (c.type === 'voice' || c.channel === 'voice') && isConnected(c))
          ?? channels.find((c) => (c.type === 'sms' || c.channel === 'sms') && isConnected(c));
        if (cancelled) return;
        setChannelReady(Boolean(voice));
        setVoiceNumber(voice?.identifier ?? null);
      } catch {
        if (!cancelled) setChannelReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  async function placeCall(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/voice/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      const data = (await res.json()) as { ok?: boolean; callSid?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not place call');
        return;
      }
      setMessage(`Calling… sid ${data.callSid ?? ''}`);
    } catch {
      setError('Could not place call');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-elevated/60 p-3">
      <div>
        <p className="text-xs font-medium text-text-secondary">Phone call (PSTN)</p>
        <p className="mt-1 text-[11px] text-text-muted">
          Turn-based speech via Twilio Gather. Connect a voice-capable number on Channels, then point
          the Twilio Voice webhook (POST) at:
        </p>
        <code className="mt-1.5 block break-all rounded-md border border-border bg-base px-2 py-1.5 font-mono text-[10px] text-text-secondary">
          https://core.carinaai.uk/api/channels/webhook/voice
        </code>
      </div>

      <ul className="space-y-1 text-[11px] text-text-muted">
        <li className={channelReady ? 'text-emerald-400' : undefined}>
          {channelReady ? '1. Voice/SMS number connected' : '1. Connect Voice (or SMS) on Channels'}
          {voiceNumber ? ` (${voiceNumber})` : ''}
        </li>
        <li>2. Twilio Console → Phone Numbers → Voice webhook → URL above (HTTP POST)</li>
        <li>3. Dial that number to instruct this Aiva, or use Dial below to call out</li>
      </ul>

      {!channelReady && channelReady !== null ? (
        <a
          href={`?tab=channels`}
          className="inline-flex text-xs font-medium text-accent hover:underline"
        >
          Open Channels to connect Twilio
        </a>
      ) : null}

      <form onSubmit={(e) => void placeCall(e)} className="space-y-2">
        <p className="text-[11px] font-medium text-text-secondary">Outbound: call a real phone number</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="+447700900000"
            className="min-h-10 flex-1 rounded-lg border border-border bg-base px-3 text-sm text-text-primary"
            required
          />
          <button
            type="submit"
            disabled={pending || to.trim().length < 8 || channelReady === false}
            className="btn-primary shrink-0 rounded-lg px-3 text-sm disabled:opacity-50"
          >
            {pending ? 'Calling…' : 'Dial'}
          </button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        {message ? <p className="text-xs text-emerald-400">{message}</p> : null}
      </form>
    </div>
  );
}

async function playBrowserTts(
  text: string,
  shouldCancel: () => boolean,
): Promise<'done' | 'interrupted'> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return 'done';
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.onend = () => resolve(shouldCancel() ? 'interrupted' : 'done');
    utterance.onerror = () => resolve(shouldCancel() ? 'interrupted' : 'done');
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function AivaWorkerCallPanel({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName: string;
}) {
  const realtime = useAivaRealtimeCall(workerId, workerName);
  const [forceClassic, setForceClassic] = useState(false);
  const [autoFallbackNotice, setAutoFallbackNotice] = useState('');
  const useWebRtc = realtime.available && !forceClassic && !realtime.fallbackToClassic;

  useEffect(() => {
    if (!realtime.fallbackToClassic) return;
    setForceClassic(true);
    setAutoFallbackNotice(
      realtime.fallbackReason
      || realtime.unavailableReason
      || 'Realtime duplex is unavailable. Switched to classic voice.',
    );
  }, [realtime.fallbackToClassic, realtime.fallbackReason, realtime.unavailableReason]);

  const [turns, setTurns] = useState<CallTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [features, setFeatures] = useState<VoiceFeatures>({});
  const [callState, setCallState] = useState<CallState>('idle');
  const [live, setLive] = useState(false);
  const [ttsSource, setTtsSource] = useState<'server' | 'browser' | null>(null);

  const speakingRef = useRef(false);
  const liveRef = useRef(false);
  const pendingRef = useRef(false);
  const bargeAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlingEndpointRef = useRef(false);
  const endpointingArmedRef = useRef(false);
  const onEndpointActionRef = useRef<(() => Promise<void>) | null>(null);

  const duplexMode = features.mode === 'duplex';
  const provider = features.duplexProvider ?? 'browser_loop';
  const classicRealtime = duplexMode && (provider === 'realtime' || provider === 'browser_loop' || provider === 'openai-webrtc');
  const bargeIn = features.bargeIn !== false && features.interruptOnSpeech !== false;
  const preferServerTts = features.preferServerTts !== false;
  const endpointingMs = Math.max(400, Number(features.endpointingMs ?? 650));
  const showWaveform = features.showWaveform !== false;

  const stopPlayback = useCallback(() => {
    bargeAbortRef.current?.abort();
    bargeAbortRef.current = null;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
  }, []);

  const handleEndpoint = useCallback(() => {
    if (!endpointingArmedRef.current || handlingEndpointRef.current || pendingRef.current) return;
    if (speakingRef.current) return;
    handlingEndpointRef.current = true;
    endpointingArmedRef.current = false;
    void (async () => {
      try {
        await onEndpointActionRef.current?.();
      } finally {
        handlingEndpointRef.current = false;
      }
    })();
  }, []);

  const voice = useVoiceInput({
    endpointingMs: !useWebRtc && classicRealtime ? endpointingMs : 0,
    minSpeechMs: 300,
    onEndpoint: handleEndpoint,
  });

  const cancelRecording = voice.cancelRecording;
  const startRecording = voice.startRecording;
  const stopRecording = voice.stopRecording;

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
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    return () => {
      cancelRecording();
      stopPlayback();
    };
  }, [cancelRecording, stopPlayback]);

  const watchBargeIn = useCallback(async (signal: AbortSignal): Promise<boolean> => {
    if (!bargeIn || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (signal.aborted) return false;
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let loudFrames = 0;
      const started = Date.now();
      while (!signal.aborted) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        if (Date.now() - started > 180 && rms > 0.055) {
          loudFrames += 1;
          if (loudFrames >= 3) return true;
        } else {
          loudFrames = 0;
        }
        await new Promise((r) => setTimeout(r, 40));
      }
    } catch {
      return false;
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx) void ctx.close().catch(() => undefined);
    }
    return false;
  }, [bargeIn]);

  const speakReply = useCallback(
    async (text: string): Promise<'done' | 'interrupted'> => {
      setCallState('speaking');
      speakingRef.current = true;
      const abort = new AbortController();
      bargeAbortRef.current = abort;

      const bargePromise = watchBargeIn(abort.signal).then((hit) => {
        if (hit) {
          stopPlayback();
          return 'interrupted' as const;
        }
        return 'done' as const;
      });

      let result: 'done' | 'interrupted' = 'done';

      if (preferServerTts) {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) throw new Error('server_tts_failed');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          setTtsSource('server');

          result = await Promise.race([
            new Promise<'done' | 'interrupted'>((resolve) => {
              audio.onended = () => resolve(abort.signal.aborted ? 'interrupted' : 'done');
              audio.onerror = () => resolve('done');
              void audio.play().catch(() => resolve('done'));
            }),
            bargePromise,
          ]);
          URL.revokeObjectURL(url);
        } catch {
          setTtsSource('browser');
          result = await Promise.race([
            playBrowserTts(text, () => abort.signal.aborted),
            bargePromise,
          ]);
        }
      } else {
        setTtsSource('browser');
        result = await Promise.race([
          playBrowserTts(text, () => abort.signal.aborted),
          bargePromise,
        ]);
      }

      abort.abort();
      bargeAbortRef.current = null;
      speakingRef.current = false;
      if (result === 'interrupted') {
        setCallState(liveRef.current ? 'listening' : 'idle');
      }
      return result;
    },
    [preferServerTts, stopPlayback, watchBargeIn],
  );

  const resumeListening = useCallback(async () => {
    if (!classicRealtime || !liveRef.current) {
      setCallState('idle');
      return;
    }
    setCallState('listening');
    endpointingArmedRef.current = true;
    try {
      await startRecording();
    } catch {
      /* duplex loop best-effort */
    }
  }, [classicRealtime, startRecording]);

  const sendTranscript = useCallback(
    async (transcript: string) => {
      const cleaned = transcript.trim();
      if (!cleaned) {
        if (liveRef.current) await resumeListening();
        return;
      }
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
          if (liveRef.current) await resumeListening();
          return;
        }
        const reply =
          data.reply
          ?? data.employeeMessage?.content
          ?? data.message?.content
          ?? 'Got it.';
        setTurns((prev) => [...prev, { id: `w-${Date.now()}`, role: 'worker', text: reply }]);
        const speakResult = await speakReply(reply);
        if (speakResult === 'interrupted' && liveRef.current) {
          await resumeListening();
          return;
        }
        await resumeListening();
      } catch {
        setError('Could not reach the worker');
        setCallState(liveRef.current ? 'listening' : 'idle');
        if (liveRef.current) await resumeListening();
      } finally {
        setPending(false);
      }
    },
    [resumeListening, speakReply, workerId],
  );

  useEffect(() => {
    onEndpointActionRef.current = async () => {
      if (voice.status !== 'recording') return;
      const transcript = await stopRecording();
      await sendTranscript(transcript || voice.livePreview);
    };
  }, [sendTranscript, stopRecording, voice.livePreview, voice.status]);

  useEffect(() => {
    if (!bargeIn || useWebRtc) return;
    if (voice.status === 'recording' && speakingRef.current) {
      stopPlayback();
      setCallState('listening');
      endpointingArmedRef.current = true;
    }
  }, [voice.status, bargeIn, stopPlayback, useWebRtc]);

  async function toggleTalkClassic() {
    setError('');
    if (voice.status === 'recording') {
      endpointingArmedRef.current = false;
      const transcript = await stopRecording();
      await sendTranscript(transcript || voice.livePreview);
      return;
    }
    try {
      if (speakingRef.current) stopPlayback();
      if (classicRealtime) {
        setLive(true);
        setCallState('connecting');
      }
      endpointingArmedRef.current = true;
      await startRecording();
      if (classicRealtime) setCallState('listening');
    } catch {
      setError(voice.voiceBlockedReason || 'Microphone unavailable');
      setCallState('idle');
      setLive(false);
      endpointingArmedRef.current = false;
    }
  }

  async function endCallClassic() {
    setLive(false);
    endpointingArmedRef.current = false;
    setCallState('ended');
    cancelRecording();
    stopPlayback();
    setTimeout(() => setCallState('idle'), 400);
  }

  const classicWaveTone =
    callState === 'listening'
      ? 'listen'
      : callState === 'speaking'
        ? 'speak'
        : callState === 'thinking'
          ? 'think'
          : 'idle';

  const displayTurns = useWebRtc ? realtime.turns : turns;
  const displayError = useWebRtc ? realtime.error : error;
  const statePill = useWebRtc ? realtime.state : callState;
  const stateHint = useWebRtc
    ? realtime.state === 'connecting'
      ? (realtime.connectPhase || 'Connecting duplex audio…')
      : realtime.state === 'speaking'
        ? `${workerName} is speaking · talk to interrupt`
        : realtime.state === 'listening' || realtime.state === 'live'
          ? 'Live duplex · speak naturally'
          : realtime.state === 'error'
            ? 'Realtime call failed'
            : realtime.state === 'unavailable'
              ? realtime.unavailableReason || 'Realtime unavailable'
              : 'True realtime voice over WebRTC'
    : STATE_COPY[callState];

  return (
    <section className="mx-auto w-full min-w-0 max-w-xl space-y-4 overflow-x-hidden rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            useWebRtc
              ? 'bg-violet-500/15 text-violet-300'
              : callState === 'listening'
                ? 'bg-emerald-500/15 text-emerald-300'
                : callState === 'thinking'
                  ? 'bg-sky-500/15 text-sky-300'
                  : callState === 'speaking'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-primary/10 text-primary',
          )}
        >
          {(useWebRtc ? realtime.state === 'connecting' : callState === 'thinking') ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : useWebRtc ? (
            <Radio className="h-5 w-5" />
          ) : (
            <Phone className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-lg font-semibold text-text-primary">Call {workerName}</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              {statePill}
              {useWebRtc
                ? ` · webrtc · ${realtime.modelLabel}`
                : classicRealtime
                  ? ` · classic · ${provider}`
                  : ' · PTT'}
              {!useWebRtc && ttsSource ? ` · ${ttsSource} tts` : ''}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">{stateHint}</p>
        </div>
      </div>

      {realtime.available || realtime.fallbackToClassic || forceClassic ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!realtime.available || realtime.fallbackToClassic}
            onClick={() => {
              if (realtime.isLive) realtime.end();
              if (live) void endCallClassic();
              setForceClassic(false);
              setAutoFallbackNotice('');
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              useWebRtc
                ? 'border-violet-400/50 bg-violet-500/10 text-violet-200'
                : 'border-border text-text-muted hover:text-text-secondary',
              (!realtime.available || realtime.fallbackToClassic) && 'cursor-not-allowed opacity-50',
            )}
          >
            Realtime duplex
          </button>
          <button
            type="button"
            onClick={() => {
              if (realtime.isLive) realtime.end();
              setForceClassic(true);
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              !useWebRtc
                ? 'border-amber-400/50 bg-amber-500/10 text-amber-200'
                : 'border-border text-text-muted hover:text-text-secondary',
            )}
          >
            Classic voice loop
          </button>
        </div>
      ) : null}

      {autoFallbackNotice ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">{autoFallbackNotice}</p>
      ) : null}
      {!useWebRtc && voice.voiceBlockedReason ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">{voice.voiceBlockedReason}</p>
      ) : null}
      {displayError ? <p className="text-sm text-danger">{displayError}</p> : null}
      {!realtime.available && !autoFallbackNotice && realtime.unavailableReason ? (
        <p className="text-sm text-text-muted">
          Realtime duplex unavailable. Using classic voice. {realtime.unavailableReason}
        </p>
      ) : null}

      {showWaveform && !useWebRtc ? (
        <div className="rounded-xl border border-border bg-elevated/80 px-3 py-3">
          <CallWaveform
            levels={voice.levels}
            active={callState === 'listening' || callState === 'speaking' || voice.isRecording}
            tone={classicWaveTone}
          />
          <div className="mt-2 min-h-[1.25rem] text-center text-xs text-text-muted">
            {voice.isRecording && voice.livePreview ? (
              <span className="text-text-secondary">
                <span className="text-text-muted">You: </span>
                {voice.livePreview}
                <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-emerald-400 align-middle" />
              </span>
            ) : (
              <span>{STATE_COPY[callState]}</span>
            )}
          </div>
        </div>
      ) : null}

      {useWebRtc ? (
        <div className="rounded-xl border border-border bg-elevated/80 px-3 py-3">
          <div className="flex flex-col items-center justify-center gap-1 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  realtime.isConnecting
                    ? 'bg-amber-400 animate-pulse'
                    : realtime.isLive
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-white/30',
                )}
              />
              {realtime.liveTranscript
                || (realtime.isConnecting
                  ? (realtime.connectPhase || 'Connecting…')
                  : realtime.isLive
                    ? 'Connected · waiting for speech'
                    : 'Idle')}
            </div>
            {realtime.toolStatus ? (
              <span className="text-violet-300">{realtime.toolStatus}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="min-h-[14rem] space-y-3 rounded-xl border border-border bg-elevated p-4">
        {displayTurns.length === 0 ? (
          <p className="text-sm text-text-muted">
            {useWebRtc
              ? 'No call turns yet. Start realtime call for low-latency duplex audio.'
              : 'No call turns yet. Press talk to start.'}
          </p>
        ) : (
          displayTurns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                'w-fit max-w-[min(90%,28rem)] px-3 py-2 text-sm leading-relaxed',
                turn.role === 'user'
                  ? 'ml-auto rounded-lg rounded-br-sm bg-bubble-user text-text-primary'
                  : 'rounded-lg rounded-bl-sm border border-border bg-elevated text-text-primary',
              )}
            >
              {turn.text}
            </div>
          ))
        )}
      </div>

      {useWebRtc ? (
        <>
          <button
            type="button"
            disabled={realtime.state === 'checking'}
            onClick={() => {
              if (realtime.isConnecting || realtime.isLive) {
                realtime.end();
                return;
              }
              void realtime.start();
            }}
            className={cn(
              'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold',
              realtime.isConnecting || realtime.isLive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'btn-primary',
            )}
          >
            {realtime.isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancel connect
              </>
            ) : realtime.isLive ? (
              <>
                <Square className="h-4 w-4" />
                End realtime call
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" />
                Start realtime call
              </>
            )}
          </button>
          <PstnDialForm workerId={workerId} />
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={pending || Boolean(voice.voiceBlockedReason)}
            onClick={() => void toggleTalkClassic()}
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
                {voice.speechHeard
                  ? `Send now (${Math.round(voice.elapsedMs / 1000)}s) · or pause to auto-send`
                  : `Listening… (${Math.round(voice.elapsedMs / 1000)}s)`}
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                {pending
                  ? 'Waiting for reply…'
                  : classicRealtime
                    ? (live ? 'Continue talking' : 'Start classic call')
                    : 'Push to talk'}
              </>
            )}
          </button>
          {classicRealtime && live ? (
            <button type="button" onClick={() => void endCallClassic()} className="btn-ghost w-full min-h-10 text-sm">
              End call
            </button>
          ) : null}
          <PstnDialForm workerId={workerId} />
        </>
      )}
    </section>
  );
}
