import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, useApp, useInput } from 'ink';
import { MessageList } from './components/MessageList.js';
import { InputBar } from './components/InputBar.js';
import { StatusLine } from './components/StatusLine.js';
import { Banner } from './components/Banner.js';
import { ModelPicker } from './components/ModelPicker.js';
import { SessionSwitcher } from './components/SessionSwitcher.js';
import { RuntimeTimeline } from './components/RuntimeTimeline.js';
import { ReviewMode } from './components/ReviewMode.js';
import { DebugOverlay } from './components/DebugOverlay.js';
import { InlineApproval } from './components/approval/InlineApproval.js';
import { ModalApproval } from './components/approval/ModalApproval.js';
import { ClarifyPrompt } from './components/approval/ClarifyPrompt.js';
import { SudoIndicator } from './components/approval/SudoIndicator.js';
import { AgentOverlay } from './components/agents/AgentOverlay.js';
import { ScoutOverlay } from './components/scout/ScoutOverlay.js';
import { HelpHint } from './components/HelpHint.js';
import { useActiveAgents } from './hooks/useActiveAgents.js';
import { useScoutSnapshot } from './hooks/useScoutSnapshot.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { computeResponsiveFrame } from '../responsive-frame.js';
import type { SessionInfo } from '../runtime-transport/types.js';
import { selectTuiRuntimeTransport } from '../runtime-transport/select.js';
import { useMessages } from './hooks/useMessages.js';
import { useSession } from './hooks/useSession.js';
import { useSudoSession, usePendingApproval } from './hooks/use-sudo-session.js';
import { useClarifyPrompt } from './hooks/useClarifyPrompt.js';
import {
  resolveApproval,
  grantSudoApproval,
  registerInkApprovalBridge,
} from './approval-bridge.js';
import {
  formatSkinList,
  getActiveSkin,
  setActiveSkin,
} from '../skins/skin-store.js';
import { RuntimeTimelineStore, type RuntimeTimelineEvent } from '../runtime-events/timeline-store.js';
import { getDetailsPreferences, parseDetailsPreference, setDetailsPreference } from '../details/preferences.js';
import { buildSessionMap, cycleSession as cycleSessionNode, forkSessionFallback } from '../sessions/session-map.js';
import {
  copyText,
  exportRuntimeSummaryJson,
  exportTranscriptMarkdown,
  lastAssistantReply,
  transcriptBlocks,
} from '../review/review-mode.js';

interface AppProps {
  gatewayUrl?: string;
  sessionId?: string;
  version?: string;
}

const SUDO_DURATION_MS = 5 * 60 * 1000;

export function App({ gatewayUrl = 'local', sessionId, version = '0.0.0' }: AppProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  const client = useMemo(() => selectTuiRuntimeTransport({ gatewayUrl }), [gatewayUrl]);
  const { session, setSession, sessions, loadSessions, switchProvider } = useSession(client, sessionId);
  const {
    messages,
    addUserMessage,
    appendToken,
    finalizeAssistant,
    clearDisplay,
    addAssistantMessage,
    tokenCount,
  } = useMessages();

  const lastUserMessageRef = useRef('');
  const composerDraftRef = useRef('');
  const [showBanner, setShowBanner] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [, setSkinRevision] = useState(0);

  const pendingApproval = usePendingApproval();
  const { isSudoActive, activateSudo, deactivateSudo, remainingMs } = useSudoSession();
  const clarify = useClarifyPrompt(session?.id, !pendingApproval);

  const [overlay, setOverlay] = useState<'none' | 'model' | 'session' | 'timeline' | 'review' | 'debug'>('none');
  const [showAgentOverlay, setShowAgentOverlay] = useState(false);
  const [showScoutOverlay, setShowScoutOverlay] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ok' | 'error'>('connecting');
  const [lastCommand, setLastCommand] = useState<string>('none');
  const activeAgents = useActiveAgents(!showBanner);
  const scoutSnapshot = useScoutSnapshot(!showBanner);
  const timelineStoreRef = useRef(new RuntimeTimelineStore());
  const [timelineEvents, setTimelineEvents] = useState<RuntimeTimelineEvent[]>([]);

  const addTimelineEvent = useCallback((event: Parameters<RuntimeTimelineStore['add']>[0]) => {
    timelineStoreRef.current.add(event);
    setTimelineEvents(timelineStoreRef.current.list());
  }, []);

  useEffect(() => {
    if (session?.id) {
      void registerInkApprovalBridge(session.id);
    }
  }, [session?.id]);

  useEffect(() => {
    void client.healthCheck().then((ok) => {
      setConnectionStatus(ok ? 'ok' : 'error');
      addTimelineEvent({
        type: ok ? 'transport.reconnected' : 'runtime.warning',
        detail: ok ? 'Transport ready' : 'Transport health check failed',
      });
    });
  }, [client, addTimelineEvent]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const cycleSession = useCallback((direction: -1 | 1) => {
    if (sessions.length === 0) return;
    const currentIdx = sessions.findIndex((s) => s.id === session?.id);
    const base = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (base + direction + sessions.length) % sessions.length;
    const target = sessions[nextIdx];
    if (!target) return;
    setSession(target);
    clearDisplay();
    addTimelineEvent({ type: 'session.switched', sessionId: target.id, detail: target.name });
    void registerInkApprovalBridge(target.id);
  }, [sessions, session?.id, setSession, clearDisplay, addTimelineEvent]);

  const modalApproval = pendingApproval
    && (pendingApproval.riskLevel === 'high' || pendingApproval.riskLevel === 'critical');
  const inlineApproval = pendingApproval && pendingApproval.riskLevel === 'medium';
  const blockInput = showBanner
    || showHelp
    || isStreaming
    || overlay !== 'none'
    || Boolean(modalApproval)
    || Boolean(showAgentOverlay)
    || Boolean(showScoutOverlay);

  const handleApprove = useCallback(() => {
    addTimelineEvent({ type: 'approval.resolved', sessionId: session?.id, detail: 'Approved' });
    resolveApproval(true);
  }, [addTimelineEvent, session?.id]);

  const handleDeny = useCallback(() => {
    addTimelineEvent({ type: 'approval.resolved', sessionId: session?.id, detail: 'Denied', severity: 'warning' });
    resolveApproval(false);
  }, [addTimelineEvent, session?.id]);

  const handleSudoApprove = useCallback(() => {
    if (pendingApproval && session?.id) {
      activateSudo(SUDO_DURATION_MS);
      grantSudoApproval(pendingApproval.toolName, session.id, SUDO_DURATION_MS);
      addTimelineEvent({ type: 'approval.resolved', sessionId: session.id, detail: `Sudo approved ${pendingApproval.toolName}` });
    }
    resolveApproval(true);
  }, [pendingApproval, session?.id, activateSudo, addTimelineEvent]);

  const handleSend = async (text: string) => {
    if (!session || isStreaming || pendingApproval) return;
    lastUserMessageRef.current = text;
    addUserMessage(text);
    setIsStreaming(true);
    addTimelineEvent({ type: 'model.started', sessionId: session.id, detail: session.model });
    try {
      await client.streamChat(session.id, text, {
        onToken: (token) => {
          appendToken(token);
          addTimelineEvent({ type: 'model.token', sessionId: session.id });
        },
        onDone: () => {
          finalizeAssistant();
          setIsStreaming(false);
          setSession((s) => (s ? { ...s, tokenCount, messageCount: s.messageCount + 2 } : s));
          addTimelineEvent({ type: 'model.completed', sessionId: session.id, detail: session.model });
        },
        onError: (err) => {
          setIsStreaming(false);
          addTimelineEvent({ type: 'runtime.error', sessionId: session.id, detail: err.message });
          injectSystemReply(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      });
    } catch (err) {
      setIsStreaming(false);
      addTimelineEvent({ type: 'runtime.error', sessionId: session.id, detail: err instanceof Error ? err.message : String(err) });
      injectSystemReply(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleNewSession = async () => {
    try {
      const created = await client.createSession();
      if (created) {
        setSession(created);
        clearDisplay();
        setOverlay('none');
        addTimelineEvent({ type: 'session.started', sessionId: created.id, detail: created.name });
        await registerInkApprovalBridge(created.id);
      }
    } catch {
      setOverlay('none');
    }
  };

  const injectSystemReply = useCallback((text: string) => {
    addAssistantMessage(text);
  }, [addAssistantMessage]);

  const handleSlashCommand = useCallback((command: string): boolean => {
    const lower = command.toLowerCase().trim();
    setLastCommand(command);
    if (lower === '/help' || lower === '/commands') {
      injectSystemReply([
        'Interactive commands:',
        '/help, /new, /reset, /retry, /clear, /model, /session, /timeline, /skin, /scout status, /quit',
        'CLI-style: /workspace list, /session resume, ... (run in shell as carina ...)',
        'Scout overlay: Ctrl+Shift+S',
      ].join('\n'));
      return true;
    }
    if (lower === '/new' || lower === '/reset') {
      void handleNewSession();
      return true;
    }
    if (lower === '/clear') {
      clearDisplay();
      return true;
    }
    if (lower === '/model') {
      setOverlay('model');
      return true;
    }
    if (lower === '/session') {
      void loadSessions();
      setOverlay('session');
      return true;
    }
    if (lower === '/sessions' || lower === '/resume') {
      void loadSessions();
      const next = cycleSessionNode(buildSessionMap(sessions, session?.id), session?.id, -1);
      if (next) {
        setSession(next);
        clearDisplay();
        addTimelineEvent({ type: 'session.switched', sessionId: next.id, detail: next.name });
      } else {
        setOverlay('session');
      }
      return true;
    }
    if (lower === '/fork') {
      if (!session) {
        injectSystemReply('No active session to fork.');
        return true;
      }
      const forked = forkSessionFallback(session, `fork:${Date.now()}`);
      setSession(forked);
      clearDisplay();
      addTimelineEvent({ type: 'session.started', sessionId: forked.id, detail: `Forked from ${session.id}` });
      return true;
    }
    if (lower === '/timeline' || lower === '/events') {
      setOverlay('timeline');
      return true;
    }
    if (lower === '/debug') {
      setOverlay('debug');
      return true;
    }
    if (lower === '/review' || lower === '/search') {
      setOverlay('review');
      return true;
    }
    if (lower === '/copy') {
      const text = lastAssistantReply(transcriptBlocks(messages));
      if (!text) {
        injectSystemReply('No assistant reply to copy yet.');
        return true;
      }
      void copyText(text, 'carina-last-reply').then((result) => injectSystemReply(result.detail));
      return true;
    }
    if (lower === '/export' || lower === '/export markdown') {
      const markdown = exportTranscriptMarkdown(transcriptBlocks(messages));
      void copyText(markdown, 'carina-transcript').then((result) => injectSystemReply(result.detail));
      return true;
    }
    if (lower === '/export json') {
      const json = exportRuntimeSummaryJson(transcriptBlocks(messages));
      void copyText(json, 'carina-runtime-summary').then((result) => injectSystemReply(result.detail));
      return true;
    }
    if (lower === '/details') {
      const prefs = getDetailsPreferences();
      injectSystemReply([
        'Details:',
        `thinking ${prefs.thinking}`,
        `tools ${prefs.tools}`,
        `agents ${prefs.agents}`,
        `activity ${prefs.activity}`,
        `approvals ${prefs.approvals}`,
      ].join('\n'));
      return true;
    }
    if (lower.startsWith('/details ')) {
      const parsed = parseDetailsPreference(command.trim().slice('/details '.length));
      if (!parsed) {
        injectSystemReply('Usage: /details <thinking|tools|agents|activity|approvals> <hidden|collapsed|expanded>');
        return true;
      }
      setDetailsPreference(parsed.section, parsed.mode);
      injectSystemReply(`Details ${parsed.section} set to ${parsed.mode}`);
      return true;
    }
    if (lower === '/quit' || lower === '/exit') {
      exit();
      return true;
    }
    if (lower === '/retry') {
      const last = lastUserMessageRef.current.trim();
      if (last) void handleSend(last);
      return true;
    }
    if (lower === '/scout' || lower === '/scout status') {
      setShowAgentOverlay(false);
      setShowScoutOverlay(true);
      return true;
    }
    if (lower === '/skin' || lower === '/skin list') {
      injectSystemReply(`${formatSkinList()}\n\nActive: ${getActiveSkin().label}`);
      return true;
    }
    if (lower.startsWith('/skin ')) {
      const skinName = command.trim().slice(5).trim();
      try {
        setActiveSkin(skinName);
        setSkinRevision((r) => r + 1);
        const active = getActiveSkin();
        injectSystemReply(`Skin set to "${active.name}" (${active.label})`);
      } catch (err) {
        injectSystemReply(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
      return true;
    }
    if (lower.startsWith('/')) {
      injectSystemReply(`Run in shell: carina ${command.slice(1)}`);
      return true;
    }
    return false;
  }, [addTimelineEvent, clearDisplay, exit, handleNewSession, handleSend, injectSystemReply, loadSessions, messages, session, sessions, setSession]);

  useInput((input, key) => {
    const composerEmpty = composerDraftRef.current.trim().length === 0;
    if (
      input === '?'
      && !modalApproval
      && !showAgentOverlay
      && !showScoutOverlay
      && (showHelp || composerEmpty)
    ) {
      setShowHelp((prev) => !prev);
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'e') {
      setShowAgentOverlay(false);
      setShowScoutOverlay(true);
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 's') {
      setShowAgentOverlay(false);
      setShowScoutOverlay((prev) => !prev);
      return;
    }
    if (key.ctrl && key.shift && input.toLowerCase() === 'k') {
      injectSystemReply('Kill active subagents from shell: carina agent kill <id>  |  carina doctor --fix');
      return;
    }
    if (key.ctrl && input === 'a') {
      setShowScoutOverlay(false);
      setShowAgentOverlay((prev) => !prev);
      return;
    }
    if (key.ctrl && input === 'x') {
      deactivateSudo();
      return;
    }
    if (showHelp) return;
    if (pendingApproval) return;
    if (showAgentOverlay) return;
    if (showScoutOverlay) return;
    if (overlay !== 'none') return;

    if (key.ctrl && input === 'n') {
      void handleNewSession();
      return;
    }
    if (key.ctrl && input === 'l') {
      clearDisplay();
      setShowBanner(false);
      return;
    }
    if (key.ctrl && input === 'r') {
      const last = lastUserMessageRef.current.trim();
      if (last) void handleSend(last);
      return;
    }
    if (key.ctrl && (input === 'p' || input === 'm')) {
      setOverlay((o) => (o === 'model' ? 'none' : 'model'));
      return;
    }
    if (key.ctrl && !key.shift && input === 's') {
      void loadSessions();
      setOverlay((o) => (o === 'session' ? 'none' : 'session'));
      return;
    }
    if (key.ctrl && input === 'k') {
      injectSystemReply('Type / for slash commands. Examples: /help, /model, /session, /scout status');
      return;
    }
    if (key.ctrl && input === 'd') {
      setOverlay((current) => (current === 'debug' ? 'none' : 'debug'));
      return;
    }
    if (key.ctrl && input === '[') {
      cycleSession(-1);
      return;
    }
    if (key.ctrl && input === ']') {
      cycleSession(1);
      return;
    }
    if (input === 'q' && !isStreaming && composerEmpty) exit();
    if (key.escape) {
      setOverlay('none');
      setShowHelp(false);
    }
  });

  const handleExternalEditor = useCallback(async (draft: string) => {
    try {
      const { openExternalEditor } = await import('../operator/external-editor.js');
      const edited = await openExternalEditor(draft);
      if (edited.trim()) void handleSend(edited.trim());
    } catch (err) {
      injectSystemReply(`Editor: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [handleSend, injectSystemReply]);

  return (
    <Box flexDirection="column" flexGrow={1} width={frame.columns} height={frame.rows} overflow="hidden">
      {showBanner && session && (
        <Banner
          version={version}
          model={session.model}
          sessionId={session.id}
          onDone={() => setShowBanner(false)}
        />
      )}
      {showHelp && (
        <HelpHint onClose={() => setShowHelp(false)} />
      )}

      {!showBanner && !modalApproval && !showAgentOverlay && !showScoutOverlay && !showHelp && overlay !== 'timeline' && overlay !== 'review' && overlay !== 'debug' && (
        <>
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            sessionId={session?.id}
            model={session?.model}
            connected={connectionStatus === 'ok'}
          />
          {inlineApproval && pendingApproval && (
            <InlineApproval
              toolName={pendingApproval.toolName}
              args={pendingApproval.args}
              riskLevel="medium"
              onApprove={handleApprove}
              onDeny={handleDeny}
              onSudo={handleSudoApprove}
            />
          )}
          {clarify && !isStreaming && (
            <ClarifyPrompt
              question={clarify.question}
              options={clarify.options}
              onAnswer={handleSend}
            />
          )}
        </>
      )}

      {showAgentOverlay && (
        <AgentOverlay onClose={() => setShowAgentOverlay(false)} />
      )}

      {showScoutOverlay && (
        <ScoutOverlay onClose={() => setShowScoutOverlay(false)} />
      )}

      {overlay === 'timeline' && !showAgentOverlay && !showScoutOverlay && !modalApproval && (
        <RuntimeTimeline events={timelineEvents} onClose={() => setOverlay('none')} />
      )}

      {overlay === 'review' && !showAgentOverlay && !showScoutOverlay && !modalApproval && (
        <ReviewMode messages={messages} onClose={() => setOverlay('none')} />
      )}

      {overlay === 'debug' && !showAgentOverlay && !showScoutOverlay && !modalApproval && (
        <DebugOverlay
          sessionId={session?.id}
          model={session?.model}
          overlay={overlay}
          transportMode={client.mode}
          connected={connectionStatus === 'ok'}
          terminalColumns={columns}
          terminalRows={rows}
          messageCount={messages.length}
          tokenCount={tokenCount}
          lastCommand={lastCommand}
          events={timelineEvents}
          onClose={() => setOverlay('none')}
        />
      )}

      {modalApproval && pendingApproval && (
        <ModalApproval
          toolName={pendingApproval.toolName}
          args={pendingApproval.args}
          riskLevel={pendingApproval.riskLevel as 'high' | 'critical'}
          riskReason={pendingApproval.reason}
          onApprove={handleApprove}
          onDeny={handleDeny}
        />
      )}

      {!modalApproval && !showAgentOverlay && !showScoutOverlay && !showBanner && !showHelp && (
        <InputBar
          onSubmit={handleSend}
          onClear={clearDisplay}
          onSlashCommand={handleSlashCommand}
          onExternalEditor={handleExternalEditor}
          onDraftChange={(draft) => {
            composerDraftRef.current = draft;
          }}
          disabled={blockInput}
        />
      )}

      {isSudoActive() && remainingMs > 0 && (
        <SudoIndicator remainingMs={remainingMs} />
      )}

      <StatusLine
        sessionId={session?.id ?? 'pending'}
        model={session?.model ?? 'unknown'}
        tokenCount={tokenCount}
        connected={connectionStatus === 'ok'}
        connectionStatus={connectionStatus}
        streaming={isStreaming}
        activeAgents={activeAgents.length}
        scoutTrust={scoutSnapshot.trustScore}
        scoutLinked
        pendingApprovals={pendingApproval ? 1 : 0}
        mode={modalApproval ? 'approval' : overlay === 'model' ? 'model' : overlay === 'session' ? 'session' : overlay === 'review' ? 'review' : overlay === 'timeline' || overlay === 'debug' ? 'debug' : showAgentOverlay ? 'agent' : showScoutOverlay ? 'scout' : showHelp ? 'help' : 'chat'}
      />

      {overlay === 'model' && !showAgentOverlay && !modalApproval && (
        <ModelPicker
          client={client}
          currentModel={session?.model}
          onSelect={(provider) => {
            void switchProvider(provider);
            setOverlay('none');
          }}
          onClose={() => setOverlay('none')}
        />
      )}
      {overlay === 'session' && !showAgentOverlay && !modalApproval && (
        <SessionSwitcher
          sessions={sessions}
          currentSessionId={session?.id}
          onSelect={(s) => {
            setSession(s);
            clearDisplay();
            setOverlay('none');
            void registerInkApprovalBridge(s.id);
          }}
          onCreate={() => void handleNewSession()}
          onClose={() => setOverlay('none')}
        />
      )}
    </Box>
  );
}
