'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type RealtimeCallState =
  | 'idle'
  | 'checking'
  | 'connecting'
  | 'live'
  | 'speaking'
  | 'listening'
  | 'thinking'
  | 'ended'
  | 'unavailable'
  | 'error';

export type RealtimeTurn = {
  id: string;
  role: 'user' | 'worker';
  text: string;
};

type RealtimeStatus = {
  available?: boolean;
  provider?: string;
  model?: string;
  reason?: string | null;
  error?: string;
  fallback?: 'classic' | null;
  code?: string;
};

type RealtimeToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const CONNECT_TIMEOUT_MS = 25_000;

function parseEventData(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useAivaRealtimeCall(workerId: string, workerName: string) {
  const [state, setState] = useState<RealtimeCallState>('checking');
  const [available, setAvailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<RealtimeTurn[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [modelLabel, setModelLabel] = useState('gpt-realtime');
  const [toolStatus, setToolStatus] = useState('');
  const [connectPhase, setConnectPhase] = useState('');
  const [fallbackToClassic, setFallbackToClassic] = useState(false);
  const [fallbackReason, setFallbackReason] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const assistantBufferRef = useRef('');
  const userBufferRef = useRef('');
  const workerIdRef = useRef(workerId);
  const startGenerationRef = useRef(0);
  const greetedRef = useRef(false);
  workerIdRef.current = workerId;

  const cleanup = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {
      /* ignore */
    }
    dcRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    assistantBufferRef.current = '';
    userBufferRef.current = '';
    greetedRef.current = false;
    setLiveTranscript('');
    setToolStatus('');
    setConnectPhase('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState('checking');
    setFallbackToClassic(false);
    setFallbackReason('');
    void fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/realtime/session`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = (await res.json()) as RealtimeStatus;
        if (cancelled) return;
        const ok = Boolean(data.available);
        setAvailable(ok);
        setModelLabel(data.model || 'gpt-realtime');
        const reason = data.reason || data.error || '';
        setUnavailableReason(reason);
        if (!ok || data.fallback === 'classic') {
          setFallbackToClassic(true);
          setFallbackReason(reason || 'Realtime duplex unavailable');
          setState('unavailable');
          return;
        }
        setState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setAvailable(false);
        setUnavailableReason('Could not check realtime availability');
        setFallbackToClassic(true);
        setFallbackReason('Could not check realtime availability');
        setState('unavailable');
      });
    return () => {
      cancelled = true;
      startGenerationRef.current += 1;
      cleanup();
    };
  }, [cleanup, workerId]);

  const pushToolsToSession = useCallback(async () => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;
    try {
      setToolStatus('Loading tools…');
      const res = await fetch(
        `/api/aiva/workers/${encodeURIComponent(workerIdRef.current)}/realtime/tools`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setToolStatus('');
        return;
      }
      const data = (await res.json()) as {
        tools?: RealtimeToolDefinition[];
        instructionsSuffix?: string;
      };
      const tools = Array.isArray(data.tools) ? data.tools : [];
      if (tools.length === 0) {
        setToolStatus('');
        return;
      }
      dc.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          tools,
          tool_choice: 'auto',
        },
      }));
      setToolStatus(`${tools.length} tools ready`);
      window.setTimeout(() => setToolStatus(''), 2500);
    } catch {
      setToolStatus('');
    }
  }, []);

  const maybeGreet = useCallback(() => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open' || greetedRef.current) return;
    greetedRef.current = true;
    dc.send(JSON.stringify({
      type: 'response.create',
      response: {
        instructions: `Greet the caller briefly as ${workerName}. One short spoken sentence.`,
      },
    }));
  }, [workerName]);

  const runToolCall = useCallback(async (callId: string, name: string, argsJson: string) => {
    setToolStatus(`Running ${name}…`);
    setState('thinking');
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
    } catch {
      parsedArgs = {};
    }

    let output = JSON.stringify({ ok: false, error: 'Tool execution failed' });
    try {
      const res = await fetch(
        `/api/aiva/workers/${encodeURIComponent(workerIdRef.current)}/realtime/tools/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, arguments: parsedArgs }),
        },
      );
      const data = await res.json().catch(() => ({}));
      output = JSON.stringify(data);
      setToolStatus(res.ok ? `Finished ${name}` : `${name} failed`);
      setTurns((prev) => [
        ...prev,
        {
          id: `t-${Date.now()}`,
          role: 'worker',
          text: res.ok ? `Used tool: ${name}` : `Tool ${name} failed`,
        },
      ]);
    } catch (err) {
      output = JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Tool execution failed',
      });
      setToolStatus(`${name} failed`);
    }

    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output,
        },
      }));
      dc.send(JSON.stringify({ type: 'response.create' }));
    }
    setState('live');
    window.setTimeout(() => setToolStatus(''), 2500);
  }, []);

  const handleServerEvent = useCallback(
    (event: Record<string, unknown>) => {
      const type = String(event.type ?? '');

      if (type === 'session.updated' || type === 'session.created') {
        return;
      }

      if (type === 'response.function_call_arguments.done') {
        const callId = String(event.call_id ?? '');
        const name = String(event.name ?? '');
        const args = String(event.arguments ?? '{}');
        if (callId && name) {
          void runToolCall(callId, name, args);
        }
        return;
      }

      if (type === 'error') {
        const errObj = event.error as { message?: string } | undefined;
        const message = errObj?.message || String(event.message ?? 'Realtime error');
        setError(message);
        return;
      }

      if (type === 'input_audio_buffer.speech_started') {
        setState('listening');
        return;
      }
      if (type === 'input_audio_buffer.speech_stopped') {
        setState('live');
        return;
      }
      if (type === 'response.created' || type === 'output_audio_buffer.started') {
        setState('speaking');
        return;
      }
      if (type === 'response.done' || type === 'output_audio_buffer.stopped') {
        setState('live');
        return;
      }

      if (type === 'conversation.item.input_audio_transcription.delta') {
        const delta = String(event.delta ?? '');
        if (!delta) return;
        userBufferRef.current = `${userBufferRef.current}${delta}`;
        setLiveTranscript(userBufferRef.current);
        return;
      }

      if (type === 'conversation.item.input_audio_transcription.completed') {
        const text = String(event.transcript ?? userBufferRef.current).trim();
        userBufferRef.current = '';
        setLiveTranscript('');
        if (text) {
          setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
        }
        return;
      }

      if (type === 'response.output_audio_transcript.delta' || type === 'response.audio_transcript.delta') {
        const delta = String(event.delta ?? '');
        if (!delta) return;
        assistantBufferRef.current = `${assistantBufferRef.current}${delta}`;
        setLiveTranscript(`${workerName}: ${assistantBufferRef.current}`);
        return;
      }

      if (
        type === 'response.output_audio_transcript.done'
        || type === 'response.audio_transcript.done'
      ) {
        const text = String(event.transcript ?? assistantBufferRef.current).trim();
        assistantBufferRef.current = '';
        setLiveTranscript('');
        if (text) {
          setTurns((prev) => [...prev, { id: `w-${Date.now()}`, role: 'worker', text }]);
        }
        setState('live');
      }
    },
    [runToolCall, workerName],
  );

  const start = useCallback(async () => {
    if (!available) {
      setError(unavailableReason || 'Realtime voice is unavailable');
      setState('unavailable');
      return;
    }
    const generation = ++startGenerationRef.current;
    setError('');
    setState('connecting');
    setConnectPhase('Requesting microphone…');
    cleanup();

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      if (generation !== startGenerationRef.current) {
        pc.close();
        return;
      }
      pcRef.current = pc;
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Realtime media connection dropped');
          setState('error');
          cleanup();
        }
      };

      const remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute('playsinline', 'true');
      remoteAudioRef.current = remoteAudio;
      pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0] ?? null;
        void remoteAudio.play().catch(() => undefined);
      };

      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
        15_000,
        'Microphone access',
      );
      if (generation !== startGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      setConnectPhase('Opening realtime channel…');
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.addEventListener('open', () => {
        if (generation !== startGenerationRef.current) return;
        void pushToolsToSession();
        maybeGreet();
      });
      dc.addEventListener('message', (message) => {
        const event = parseEventData(String(message.data ?? ''));
        if (event) handleServerEvent(event);
      });

      setConnectPhase('Creating offer…');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Brief ICE wait; do not block forever if complete never fires.
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const onChange = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', onChange);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', onChange);
        window.setTimeout(() => {
          pc.removeEventListener('icegatheringstatechange', onChange);
          resolve();
        }, 800);
      });

      if (generation !== startGenerationRef.current) return;

      setConnectPhase('Connecting to OpenAI…');
      const localSdp = pc.localDescription?.sdp || offer.sdp || '';
      const controller = new AbortController();
      const sdpRes = await withTimeout(
        fetch(`/api/aiva/workers/${encodeURIComponent(workerId)}/realtime/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp',
            'X-Aiva-Worker-Name': workerName,
          },
          body: localSdp,
          signal: controller.signal,
        }),
        CONNECT_TIMEOUT_MS,
        'Realtime handshake',
      ).catch((err: unknown) => {
        controller.abort();
        throw err;
      });

      if (generation !== startGenerationRef.current) return;

      if (!sdpRes.ok) {
        const errBody = (await sdpRes.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          fallback?: string;
          code?: string;
        };
        const message = errBody.message || errBody.error || `Realtime connect failed (${sdpRes.status})`;
        const shouldFallback =
          errBody.fallback === 'classic'
          || errBody.code === 'openai_quota'
          || /quota|rate limit|invalid_api_key|timed out|unavailable|could not reach/i.test(message);
        if (shouldFallback) {
          setAvailable(false);
          setFallbackToClassic(true);
          setFallbackReason(message);
          setUnavailableReason(message);
        }
        throw new Error(message);
      }

      const answerSdp = await sdpRes.text();
      if (!answerSdp.includes('v=0')) {
        throw new Error('Server returned an invalid realtime answer');
      }
      setConnectPhase('Finishing WebRTC…');
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      if (generation !== startGenerationRef.current) return;
      setConnectPhase('');
      setState('live');
    } catch (err) {
      if (generation !== startGenerationRef.current) return;
      cleanup();
      const message = err instanceof Error ? err.message : 'Could not start realtime call';
      const shouldFallback = /quota|rate limit|invalid_api_key|timed out|unavailable|could not reach/i.test(message);
      if (shouldFallback) {
        setAvailable(false);
        setFallbackToClassic(true);
        setFallbackReason(message);
        setUnavailableReason(message);
      }
      setError(message);
      setConnectPhase('');
      setState(shouldFallback ? 'unavailable' : 'error');
    }
  }, [
    available,
    cleanup,
    handleServerEvent,
    maybeGreet,
    pushToolsToSession,
    unavailableReason,
    workerId,
    workerName,
  ]);

  const end = useCallback(() => {
    startGenerationRef.current += 1;
    cleanup();
    setError('');
    setState(available ? 'ended' : 'unavailable');
    window.setTimeout(() => {
      setState(available ? 'idle' : 'unavailable');
    }, 400);
  }, [available, cleanup]);

  const isConnected =
    state === 'live'
    || state === 'listening'
    || state === 'speaking'
    || state === 'thinking';

  return {
    available,
    unavailableReason,
    fallbackToClassic,
    fallbackReason,
    state,
    error,
    turns,
    liveTranscript,
    modelLabel,
    toolStatus,
    connectPhase,
    start,
    end,
    /** True only after the WebRTC answer is applied (not while connecting). */
    isLive: isConnected,
    isConnecting: state === 'connecting',
  };
}
