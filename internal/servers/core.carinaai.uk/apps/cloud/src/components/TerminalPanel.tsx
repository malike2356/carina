import { useEffect, useMemo, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { getToken } from '../api/client';

type PtyMessage =
  | { type: 'connected'; sessionId: string; cols: number; rows: number }
  | { type: 'output'; data: string }
  | { type: 'exit'; exitCode: number }
  | { type: 'error'; error: string };

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const [sessionId, setSessionId] = useState('');
  const [reconnectKey, setReconnectKey] = useState(0);

  const wsUrl = useMemo(() => {
    const token = getToken();
    if (!token) return null;
    const url = new URL('/api/terminal/ws', window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    return url.toString();
  }, [reconnectKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !wsUrl) return undefined;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      allowProposedApi: true,
      theme: {
        background: '#0b1020',
        foreground: '#d8e1f0',
        cursor: '#7dd3fc',
        selectionBackground: 'rgba(125, 211, 252, 0.25)',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    term.focus();
    term.writeln('Carina terminal ready.');
    termRef.current = term;
    fitRef.current = fit;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    socket.onopen = () => setStatus('open');
    socket.onerror = () => setStatus('error');
    socket.onclose = () => setStatus((curr) => (curr === 'error' ? 'error' : 'closed'));
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as PtyMessage;
        if (msg.type === 'connected') {
          setSessionId(msg.sessionId);
          return;
        }
        if (msg.type === 'output') {
          term.write(msg.data);
          return;
        }
        if (msg.type === 'exit') {
          term.writeln(`\r\n[exit ${msg.exitCode}]`);
          setStatus('closed');
          return;
        }
        if (msg.type === 'error') {
          term.writeln(`\r\n[terminal] ${msg.error}`);
        }
      } catch {
        term.write(String(event.data));
      }
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const syncSize = () => {
      fit.fit();
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    window.addEventListener('resize', syncSize);

    return () => {
      window.removeEventListener('resize', syncSize);
      observer.disconnect();
      socket.close();
      term.dispose();
      fitRef.current = null;
      termRef.current = null;
      wsRef.current = null;
    };
  }, [wsUrl]);

  return (
    <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-100">Embedded terminal</span>
          <span className="text-slate-500">status: {status}</span>
          {sessionId && <span className="text-slate-500">session: {sessionId.slice(0, 8)}</span>}
        </div>
        <button
          type="button"
          onClick={() => setReconnectKey((value) => value + 1)}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-900"
        >
          Reconnect
        </button>
      </div>
      <div ref={containerRef} className="terminal-surface flex-1" />
    </div>
  );
}
