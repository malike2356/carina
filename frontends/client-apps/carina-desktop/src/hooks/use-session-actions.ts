import { useCallback, useEffect } from 'react';
import { formatMessageWithAttachments, type Attachment } from '../lib/composer-types.js';
import { useStore } from '@nanostores/react';
import { createSession, isGatewayOnline, listSessions } from '../lib/gateway-client.js';
import { loadLocalMessages, saveLocalMessages } from '../lib/session-store.js';
import { noteOfflineMessage, noteOfflineSession } from '../lib/offline/sync-service.js';
import { $gatewayStatus } from '../store/connection.js';
import {
  $currentSessionId,
  $sessions,
  $sessionLoading,
} from '../store/session.js';
import {
  $messages,
  $streamRequest,
  $isStreaming,
  $currentTurnId,
  $streamingMessageId,
  type ChatMessage,
} from '../store/chat.js';

function makeTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useSessionActions() {
  const currentSessionId = useStore($currentSessionId);

  const refreshSessions = useCallback(async () => {
    $sessionLoading.set(true);
    try {
      const sessions = await listSessions();
      $sessions.set(sessions);
    } finally {
      $sessionLoading.set(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    void refreshSessions();
  }, [currentSessionId, refreshSessions]);

  const selectSession = useCallback((sessionId: string) => {
    $streamRequest.set(null);
    $isStreaming.set(false);
    $streamingMessageId.set(null);
    $currentTurnId.set(null);
    $currentSessionId.set(sessionId);
    $messages.set(loadLocalMessages(sessionId));
  }, []);

  const createNewSession = useCallback(async () => {
    const gatewayStatus = $gatewayStatus.get();
    const session = await createSession();
    const existing = $sessions.get();
    $sessions.set([session, ...existing.filter((s) => s.sessionId !== session.sessionId)]);
    if (!isGatewayOnline(gatewayStatus)) {
      noteOfflineSession(session);
    }
    selectSession(session.sessionId);
  }, [selectSession]);

  const submitMessage = useCallback((content: string, attachments: Attachment[] = []) => {
    const sessionId = $currentSessionId.get();
    const formatted = formatMessageWithAttachments(content, attachments);
    if (!sessionId || !formatted.trim()) return;

    const turnId = makeTurnId();
    const userMsg: ChatMessage = {
      id: `msg-${turnId}-user`,
      role: 'user',
      content: formatted.trim(),
      timestamp: Date.now(),
    };
    const nextMessages = [...$messages.get(), userMsg];
    $messages.set(nextMessages);
    saveLocalMessages(sessionId, nextMessages);

    $currentTurnId.set(turnId);
    const online = isGatewayOnline($gatewayStatus.get());
    if (!online) {
      noteOfflineMessage(sessionId, formatted.trim(), turnId);
      return;
    }
    $streamRequest.set({
      sessionId,
      message: formatted.trim(),
      turnId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }, []);

  const editUserMessage = useCallback((messageId: string, newContent: string) => {
    const sessionId = $currentSessionId.get();
    if (!sessionId || !newContent.trim()) return;

    const trimmed = newContent.trim();
    const nextMessages = $messages.get().map((m) =>
      m.id === messageId ? { ...m, content: trimmed } : m,
    );
    $messages.set(nextMessages);
    saveLocalMessages(sessionId, nextMessages);
    submitMessage(trimmed);
  }, [submitMessage]);

  return {
    refreshSessions,
    selectSession,
    createNewSession,
    submitMessage,
    editUserMessage,
  };
}
