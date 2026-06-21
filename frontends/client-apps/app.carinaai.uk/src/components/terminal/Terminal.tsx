'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from 'xterm';
import { ChevronDown, ExternalLink, RefreshCw, Terminal as TerminalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTerminalAccess } from '@/hooks/useTerminalAccess';
import { useCloudCapabilities } from '@/hooks/useCloudCapabilities';
import { cn } from '@/lib/utils';

type TerminalMode = 'page' | 'drawer';
type TerminalStatus = 'loading' | 'connecting' | 'connected' | 'error';

type BridgeResponse = {
  data?: {
    wsUrl?: string;
    expiresInSeconds?: number;
  };
  error?: string;
};

type Props = {
  mode?: TerminalMode;
  onClose?: () => void;
};

const TERMINAL_THEME = {
  background: '#0b0f0d',
  foreground: '#d0e4f4',
  cursor: '#00d4ff',
  selectionBackground: '#183348',
  black: '#0b0f0d',
  red: '#f87171',
  green: '#16c97e',
  yellow: '#f59e0b',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#00d4ff',
  white: '#d0e4f4',
  brightBlack: '#4b5f72',
  brightRed: '#fca5a5',
  brightGreen: '#4ade80',
  brightYellow: '#fbbf24',
  brightBlue: '#93c5fd',
  brightMagenta: '#e9d5ff',
  brightCyan: '#67e8f9',
  brightWhite: '#f8fafc',
};

function statusLabel(status: TerminalStatus): string {
  if (status === 'connected') return 'Live';
  if (status === 'connecting') return 'Connecting';
  if (status === 'error') return 'Offline';
  return 'Loading';
}

export function Terminal({ mode = 'page', onClose }: Props) {
  const access = useTerminalAccess();
  const { capabilities } = useCloudCapabilities();
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<TerminalStatus>('loading');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('Preparing terminal session.');
  const [reconnectTick, setReconnectTick] = useState(0);

  const isDrawer = mode === 'drawer';

  const chromeClass = useMemo(() => {
    if (isDrawer) {
      return 'flex h-full min-h-0 flex-col overflow-hidden border-t border-border bg-surface shadow-[0_-12px_32px_rgba(0,0,0,0.24)]';
    }
    return 'flex h-full min-h-0 flex-col overflow-hidden bg-base text-text-primary';
  }, [isDrawer]);

  useEffect(() => {
    if (access.loading) return;
    if (capabilities && !capabilities.terminal) {
      setStatus('error');
      setError('Terminal requires a core connection.');
      setDetail(
        'Advanced tools (terminal, cron, MCP) need a connection to your Carina core instance. Configure core proxy in Settings.',
      );
      return;
    }
    if (!access.canUseTerminal) {
      setStatus('error');
      setError('Terminal is not enabled for this workspace.');
      setDetail('Ask the workspace owner to enable terminal access in Settings.');
      return;
    }

    let cancelled = false;
    let observer: ResizeObserver | null = null;

    async function connect() {
      setStatus('loading');
      setError('');
      setDetail('Requesting bridge token.');

      try {
        const bridgeRes = await fetch('/api/terminal/bridge', { cache: 'no-store' });
        const bridge = await bridgeRes.json() as BridgeResponse;
        if (!bridgeRes.ok) {
          throw new Error(bridge.error ?? 'Unable to prepare terminal bridge');
        }

        const wsUrl = bridge.data?.wsUrl;
        if (!wsUrl) {
          throw new Error('Terminal bridge url missing');
        }
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;

        const term = new XTerm({
          cursorBlink: true,
          convertEol: true,
          scrollback: 5000,
          fontFamily: '"JetBrains Mono","Cascadia Code","Fira Code","SFMono-Regular",monospace',
          fontSize: 14,
          lineHeight: 1.25,
          theme: TERMINAL_THEME,
          allowTransparency: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(container);
        term.focus();
        fit.fit();
        term.writeln('\x1b[1;36mCarina terminal ready\x1b[0m');
        term.writeln('\x1b[2mConnecting to PTY bridge...\x1b[0m');

        const ws = new WebSocket(wsUrl);
        xtermRef.current = term;
        fitRef.current = fit;
        wsRef.current = ws;

        const sendResize = () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        };

        ws.onopen = () => {
          setStatus('connecting');
          setDetail('Socket open, waiting for shell.');
          sendResize();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as
              | { type: 'connected'; sessionId: string; cols: number; rows: number }
              | { type: 'output'; data: string }
              | { type: 'exit'; exitCode: number }
              | { type: 'heartbeat' };
            if (msg.type === 'connected') {
              setStatus('connected');
              setDetail(`Session ${msg.sessionId}`);
              if (msg.cols > 0 && msg.rows > 0) {
                term.resize(msg.cols, msg.rows);
              }
              return;
            }
            if (msg.type === 'output') {
              term.write(msg.data);
              return;
            }
            if (msg.type === 'exit') {
              term.writeln(`\r\n\x1b[2mProcess exited with code ${msg.exitCode}\x1b[0m`);
              setDetail(`Last exit code ${msg.exitCode}`);
            }
          } catch {
            // ignore malformed frames
          }
        };

        ws.onerror = () => {
          setStatus('error');
          setError('Terminal socket failed.');
          setDetail('Reconnect to open a fresh PTY session.');
        };

        ws.onclose = () => {
          setStatus((current) => (current === 'error' ? current : 'error'));
          setDetail('Terminal socket closed.');
        };

        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

        term.onResize(() => sendResize());

        observer = new ResizeObserver(() => {
          fit.fit();
          sendResize();
        });
        observer.observe(container);

        setStatus('connected');
        setDetail('Shell connected.');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        setDetail('Retry to open another PTY bridge session.');
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }
      observer?.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [access.canUseTerminal, access.loading, capabilities, reconnectTick]);

  if (access.loading) {
    return (
      <div className={chromeClass}>
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
          Loading terminal access...
        </div>
      </div>
    );
  }

  if (!access.canUseTerminal) {
    return (
      <div className={chromeClass}>
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div className="max-w-md">
            <TerminalIcon className="mx-auto h-8 w-8 text-text-muted" />
            <h2 className="mt-3 text-sm font-semibold text-text-primary">Terminal access denied</h2>
            <p className="mt-2 text-sm text-text-muted">
              {error || 'Terminal is not enabled for this workspace.'}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Enable it in workspace settings, then reopen the panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={chromeClass}>
      <div className={cn(
        'flex items-center justify-between gap-3 border-border bg-surface px-3 py-2',
        isDrawer ? 'border-b' : 'border-b',
      )}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs font-semibold text-text-primary">Terminal</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
              {statusLabel(status)}
            </span>
          </div>
          <p className="truncate text-[11px] text-text-muted">{detail}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setReconnectTick((current) => current + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reconnect
          </Button>
          {mode === 'drawer' ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onClose}>
              <ChevronDown className="h-3.5 w-3.5" />
              Close
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <a href="/terminal">
                <ExternalLink className="h-3.5 w-3.5" />
                Full page
              </a>
            </Button>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="min-h-0 flex-1 bg-[#0b0f0d]"
        style={isDrawer ? { height: '100%' } : undefined}
      />
      {error ? (
        <div className="border-t border-border bg-surface px-3 py-2 text-xs text-danger">
          {error}
        </div>
      ) : null}
    </div>
  );
}
