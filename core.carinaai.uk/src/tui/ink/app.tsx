import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, useApp, useInput } from 'ink';
import { MessageList } from './components/MessageList.js';
import { InputBar } from './components/InputBar.js';
import { StatusLine } from './components/StatusLine.js';
import { Banner } from './components/Banner.js';
import { ModelPicker } from './components/ModelPicker.js';
import { SessionSwitcher } from './components/SessionSwitcher.js';
import { InlineApproval } from './components/approval/InlineApproval.js';
import { ModalApproval } from './components/approval/ModalApproval.js';
import { ClarifyPrompt } from './components/approval/ClarifyPrompt.js';
import { SudoIndicator } from './components/approval/SudoIndicator.js';
import { AgentOverlay } from './components/agents/AgentOverlay.js';
import { ScoutOverlay } from './components/scout/ScoutOverlay.js';
import { HelpHint } from './components/HelpHint.js';
import { GatewayClient, type SessionInfo } from './transport/json-rpc.js';
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

interface AppProps {
  gatewayUrl?: string;
  sessionId?: string;
  version?: string;
}

const SUDO_DURATION_MS = 5 * 60 * 1000;

export function App({ gatewayUrl = 'local', sessionId, version = '0.0.0' }: AppProps) {
  const { exit } = useApp();
  const client = useMemo(() => new GatewayClient(gatewayUrl), [gatewayUrl]);
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
  const [showBanner, setShowBanner] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [, setSkinRevision] = useState(0);

  const pendingApproval = usePendingApproval();
  const { isSudoActive, activateSudo, deactivateSudo, remainingMs } = useSudoSession();
  const clarify = useClarifyPrompt(session?.id, !pendingApproval);

  const [overlay, setOverlay] = useState<'none' | 'model' | 'session'>('none');
  const [showAgentOverlay, setShowAgentOverlay] = useState(false);
  const [showScoutOverlay, setShowScoutOverlay] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ok' | 'error'>('connecting');

  useEffect(() => {
    if (session?.id) {
      void registerInkApprovalBridge(session.id);
    }
  }, [session?.id]);

  useEffect(() => {
    void client.healthCheck().then((ok) => {
      setConnectionStatus(ok ? 'ok' : 'error');
    });
  }, [client]);

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
    void registerInkApprovalBridge(target.id);
  }, [sessions, session?.id, setSession, clearDisplay]);

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
    resolveApproval(true);
  }, []);

  const handleDeny = useCallback(() => {
    resolveApproval(false);
  }, []);

  const handleSudoApprove = useCallback(() => {
    if (pendingApproval && session?.id) {
      activateSudo(SUDO_DURATION_MS);
      grantSudoApproval(pendingApproval.toolName, session.id, SUDO_DURATION_MS);
    }
    resolveApproval(true);
  }, [pendingApproval, session?.id, activateSudo]);

  const handleSend = async (text: string) => {
    if (!session || isStreaming || pendingApproval) return;
    lastUserMessageRef.current = text;
    addUserMessage(text);
    setIsStreaming(true);
    try {
      await client.streamChat(
        session.id,
        text,
        (token) => appendToken(token),
        () => {
          finalizeAssistant();
          setIsStreaming(false);
          setSession((s) => (s ? { ...s, tokenCount, messageCount: s.messageCount + 2 } : s));
        },
        () => {
          setIsStreaming(false);
        },
      );
    } catch {
      setIsStreaming(false);
    }
  };

  const handleNewSession = async () => {
    try {
      const created = await client.call<SessionInfo>('session.create');
      if (created) {
        setSession(created);
        clearDisplay();
        setOverlay('none');
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
    if (lower === '/help' || lower === '/commands') {
      injectSystemReply([
        'Interactive commands:',
        '/help, /new, /reset, /retry, /clear, /model, /session, /skin, /scout status, /quit',
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
  }, [clearDisplay, exit, handleNewSession, handleSend, injectSystemReply, loadSessions]);

  useInput((input, key) => {
    if (input === '?' && !modalApproval && !showAgentOverlay && !showScoutOverlay) {
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
    if (key.ctrl && input === '[') {
      cycleSession(-1);
      return;
    }
    if (key.ctrl && input === ']') {
      cycleSession(1);
      return;
    }
    if (input === 'q' && !isStreaming) exit();
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
    <Box flexDirection="column" flexGrow={1}>
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

      {!showBanner && !modalApproval && !showAgentOverlay && !showScoutOverlay && !showHelp && (
        <>
          <MessageList messages={messages} isStreaming={isStreaming} />
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
        streaming={isStreaming}
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
