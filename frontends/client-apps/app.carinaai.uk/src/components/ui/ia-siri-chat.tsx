'use client';

import { Loader2, Mic, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type VoiceChatPhase = 'idle' | 'listening' | 'processing';

interface Particle {
  id: number;
  x: number;
  y: number;
  opacity: number;
  velocity: { x: number; y: number };
}

export interface VoiceChatProps {
  phase?: VoiceChatPhase;
  waveformLevels?: number[];
  elapsedLabel?: string;
  livePreview?: string;
  onToggle?: () => void;
  onCancel?: () => void;
  onDone?: () => void;
  className?: string;
  compact?: boolean;
  demoMode?: boolean;
}

const BAR_COUNT = 32;

function levelsToWaveform(levels: number[]): number[] {
  if (!levels.length) return Array(BAR_COUNT).fill(4);
  return levels.map((level) => Math.max(4, Math.round(level * 64)));
}

export function VoiceChat({
  phase = 'idle',
  waveformLevels = [],
  elapsedLabel = '0:00',
  livePreview = '',
  onToggle,
  onCancel,
  onDone,
  className,
  compact = false,
  demoMode = false,
}: VoiceChatProps) {
  const [demoListening, setDemoListening] = useState(false);
  const [demoProcessing, setDemoProcessing] = useState(false);
  const [demoDuration, setDemoDuration] = useState(0);
  const [demoWaveform, setDemoWaveform] = useState<number[]>(Array(BAR_COUNT).fill(4));
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isListening = demoMode ? demoListening : phase === 'listening';
  const isProcessing = demoMode ? demoProcessing : phase === 'processing';
  const waveformData = demoMode ? demoWaveform : levelsToWaveform(waveformLevels);
  const durationLabel = demoMode
    ? `${Math.floor(demoDuration / 60)}:${String(demoDuration % 60).padStart(2, '0')}`
    : elapsedLabel;

  const volume = useMemo(() => {
    if (!waveformLevels.length) return isListening ? 35 : 0;
    return Math.round(Math.max(...waveformLevels) * 100);
  }, [isListening, waveformLevels]);

  useEffect(() => {
    const next: Particle[] = [];
    const count = compact ? 10 : 20;
    const span = compact ? 280 : 400;
    for (let i = 0; i < count; i += 1) {
      next.push({
        id: i,
        x: Math.random() * span,
        y: Math.random() * (compact ? 120 : 400),
        opacity: Math.random() * 0.25 + 0.08,
        velocity: { x: (Math.random() - 0.5) * 0.4, y: (Math.random() - 0.5) * 0.4 },
      });
    }
    setParticles(next);
  }, [compact]);

  useEffect(() => {
    const spanX = compact ? 280 : 400;
    const spanY = compact ? 120 : 400;
    const animateParticles = () => {
      setParticles((prev) =>
        prev.map((particle) => ({
          ...particle,
          x: (particle.x + particle.velocity.x + spanX) % spanX,
          y: (particle.y + particle.velocity.y + spanY) % spanY,
          opacity: Math.min(0.35, Math.max(0.05, particle.opacity + (Math.random() - 0.5) * 0.02)),
        })),
      );
      animationRef.current = requestAnimationFrame(animateParticles);
    };
    animationRef.current = requestAnimationFrame(animateParticles);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [compact]);

  useEffect(() => {
    if (!demoMode) return undefined;

    const runDemo = async () => {
      setDemoListening(true);
      setDemoDuration(0);
      demoIntervalRef.current = setInterval(() => {
        setDemoDuration((value) => value + 1);
        setDemoWaveform(Array(BAR_COUNT).fill(0).map(() => Math.max(4, Math.random() * 64)));
      }, 1000);

      await new Promise((resolve) => setTimeout(resolve, 2800));
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);

      setDemoListening(false);
      setDemoProcessing(true);
      setDemoWaveform(Array(BAR_COUNT).fill(8));

      await new Promise((resolve) => setTimeout(resolve, 1800));

      setDemoProcessing(false);
      setDemoDuration(0);
      setDemoWaveform(Array(BAR_COUNT).fill(4));
      window.setTimeout(runDemo, 1200);
    };

    const timeout = window.setTimeout(runDemo, 600);
    return () => {
      clearTimeout(timeout);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [demoMode]);

  const statusText = isListening
    ? 'Listening...'
    : isProcessing
      ? 'Transcribing...'
      : 'Tap to speak';

  const statusColor = isListening
    ? 'text-accent'
    : isProcessing
      ? 'text-amber-400'
      : 'text-text-muted';

  const accentRing = isListening
    ? 'border-accent shadow-lg shadow-accent/20'
    : isProcessing
      ? 'border-amber-400 shadow-lg shadow-amber-400/20'
      : 'border-border hover:border-accent/40';

  const barColor = isListening ? 'bg-accent' : isProcessing ? 'bg-amber-400' : 'bg-border';

  const buttonSize = compact ? 'h-14 w-14' : 'h-32 w-32';
  const iconSize = compact ? 'h-6 w-6' : 'h-12 w-12';

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        compact ? 'rounded-t-xl px-3 py-4' : 'flex min-h-screen flex-col items-center justify-center bg-base',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute h-1 w-1 rounded-full bg-accent/30"
            style={{ left: particle.x, top: particle.y, opacity: particle.opacity }}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className={cn(
            'rounded-full bg-gradient-to-r from-accent/10 via-purple-500/10 to-cyan-500/10 blur-3xl',
            compact ? 'h-32 w-32' : 'h-96 w-96',
          )}
          animate={{
            scale: isListening ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: isListening ? [0.25, 0.5, 0.25] : [0.08, 0.16, 0.08],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className={cn('relative z-10 flex w-full flex-col items-center', compact ? 'gap-3' : 'space-y-8')}>
        <div className="flex w-full items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className={cn('font-medium', compact ? 'text-sm' : 'text-lg', statusColor)}>{statusText}</p>
            <p className="font-mono text-xs text-text-muted">{durationLabel}</p>
          </div>
          {compact && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
              aria-label="Cancel voice input"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className={cn('flex items-center', compact ? 'gap-4' : 'flex-col gap-8')}>
          <motion.div className="relative shrink-0" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <motion.button
              type="button"
              onClick={() => {
                if (demoMode) return;
                if (isListening && onDone) onDone();
                else if (onToggle) onToggle();
              }}
              disabled={isProcessing}
              className={cn(
                'relative flex items-center justify-center rounded-full border-2 bg-gradient-to-br from-accent/15 to-accent/5 transition-all',
                buttonSize,
                accentRing,
              )}
              animate={{
                boxShadow: isListening
                  ? ['0 0 0 0 rgba(0, 212, 255, 0.35)', '0 0 0 16px rgba(0, 212, 255, 0)']
                  : undefined,
              }}
              transition={{ duration: 1.5, repeat: isListening ? Infinity : 0 }}
            >
              <AnimatePresence mode="wait">
                {isProcessing ? (
                  <motion.div key="processing" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <Loader2 className={cn(iconSize, 'animate-spin text-amber-400')} />
                  </motion.div>
                ) : (
                  <motion.div key="mic" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <Mic className={cn(iconSize, isListening ? 'text-accent' : 'text-text-muted')} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <AnimatePresence>
              {isListening && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-accent/30"
                    initial={{ scale: 1, opacity: 0.55 }}
                    animate={{ scale: 1.45, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-accent/20"
                    initial={{ scale: 1, opacity: 0.35 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.45 }}
                  />
                </>
              )}
            </AnimatePresence>
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className={cn('flex items-end justify-center gap-1', compact ? 'h-12' : 'h-16')}>
              {waveformData.map((height, index) => (
                <motion.div
                  key={index}
                  className={cn('w-1 rounded-full', barColor)}
                  animate={{
                    height: `${height}px`,
                    opacity: isListening || isProcessing ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.08, ease: 'easeOut' }}
                />
              ))}
            </div>

            {volume > 0 && (
              <motion.div
                className="mt-2 flex items-center justify-center gap-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <VolumeX className="h-3.5 w-3.5 text-text-muted" />
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="h-full rounded-full bg-accent"
                    animate={{ width: `${volume}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <Volume2 className="h-3.5 w-3.5 text-text-muted" />
              </motion.div>
            )}
          </div>
        </div>

        <div className="w-full rounded-lg border border-border/70 bg-base/70 px-3 py-2">
          {livePreview ? (
            <p className="text-sm leading-relaxed text-text-primary">{livePreview}</p>
          ) : (
            <p className="text-sm text-text-muted">
              {isProcessing ? 'Whisper is converting your speech to text...' : 'Speak clearly; live preview appears here when supported.'}
            </p>
          )}
        </div>

        {compact && isListening && onDone ? (
          <div className="flex w-full justify-end">
            <button
              type="button"
              onClick={onDone}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-accent px-4 text-xs font-semibold text-black transition-colors hover:bg-accent-hover"
            >
              Done
            </button>
          </div>
        ) : null}

        {!compact && (
          <motion.div
            className="flex items-center gap-2 text-sm text-text-muted"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="h-4 w-4 text-accent" />
            <span>Carina voice input</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
