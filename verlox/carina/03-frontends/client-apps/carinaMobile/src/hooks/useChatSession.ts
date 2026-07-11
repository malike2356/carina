import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat } from '@/api/chat-stream';
import { fetchChatHistory } from '@/api/chat-history-client';
import type { ChatMessage, InstanceConfig } from '@/api/types';
import { getLoadedLocalModelDisplayName } from '@/lib/local-inference';
import { isSlashCommand } from '@/config/commands';
import { isApiAuthError } from '@/lib/cloud-features';
import { mergeMessages } from '@/lib/history-merge';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { clearChatMessages, loadChatMessages, saveChatMessages } from '@/lib/chat-session';
import { deriveSessionMeta, removeSessionMeta, upsertSessionMeta } from '@/lib/session-registry';
import { extractToolNames, stripToolMarkers } from '@/lib/stream-parser';
import { enqueueOfflineMessage, isLikelyNetworkError } from '@/lib/offline-queue';
import { isLocalModelReady, localChatStream } from '@/lib/local-inference';
import { loadRemotePushEnabled } from '@/lib/notification-prefs';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { notifyTaskFinished } from '@/lib/notifications';
import { syncTaskWidgetFromStore } from '@/lib/widget-sync';
import { patchTask, upsertTask } from '@/lib/task-store';
import { useAuth } from '@/store/auth-store';
import { isLocalModelEnabled } from '@/store/local-model-store';
import { ensureSessionId, rotateSessionId, setSessionId } from '@/store/instance-store';

async function syncServerHistory(
  config: InstanceConfig,
  stored: ChatMessage[],
  auth?: GatewayAuthOptions,
): Promise<ChatMessage[]> {
  if (!config.baseUrl) return stored;
  try {
    const server = await fetchChatHistory(config.baseUrl, config.sessionId, {
      limit: 200,
      auth,
    });
    const merged = mergeMessages(stored, server.messages);
    const changed = merged.length !== stored.length
      || merged.some((message, index) => message.id !== stored[index]?.id);
    if (changed) {
      await saveChatMessages(config.sessionId, merged);
      return merged;
    }
  } catch {
    // Server unavailable; keep local messages.
  }
  return stored;
}

function createMessage(
  role: ChatMessage['role'],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    status: 'done',
    ...extra,
  };
}

function sameInstanceConfig(a: InstanceConfig | null | undefined, b: InstanceConfig): boolean {
  return Boolean(
    a &&
      a.sessionId === b.sessionId &&
      a.baseUrl === b.baseUrl &&
      a.mode === b.mode,
  );
}

export function useChatSession() {
  const { instance, setInstance, client, gatewayAuth, refresh } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const gatewayAuthRef = useRef(gatewayAuth);
  const instanceRef = useRef(instance);
  gatewayAuthRef.current = gatewayAuth;
  instanceRef.current = instance;
  const sessionId = instance?.sessionId ?? '';

  const persist = useCallback(async (session: string, next: ChatMessage[]) => {
    if (!session) return;
    await saveChatMessages(session, next);
    if (next.length > 0) {
      await upsertSessionMeta(deriveSessionMeta(session, next));
    }
  }, []);

  // Do not depend on gatewayAuth here: setInstance rebuilds it and would re-bootstrap
  // in a tight loop, which makes the chat status chips flicker constantly.
  const bootstrap = useCallback(async () => {
    const config = await ensureSessionId();
    if (!sameInstanceConfig(instanceRef.current, config)) {
      setInstance(config);
    }
    const stored = await loadChatMessages(config.sessionId);
    setMessages(stored);

    const merged = await syncServerHistory(
      config,
      stored,
      gatewayAuthRef.current ?? undefined,
    );
    if (merged !== stored) {
      setMessages(merged);
    }

    setReady(true);
  }, [setInstance]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const startNewChat = useCallback(async () => {
    cancel();
    const config = await rotateSessionId();
    setInstance(config);
    setMessages([]);
    setActiveTools([]);
    setStreamError(null);
    await upsertSessionMeta({
      id: config.sessionId,
      title: 'New chat',
      preview: 'No messages yet',
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    });
  }, [cancel, setInstance]);

  const switchSession = useCallback(
    async (targetSessionId: string) => {
      if (!targetSessionId || targetSessionId === sessionId) return;
      cancel();
      const config = await setSessionId(targetSessionId);
      setInstance(config);
      const stored = await loadChatMessages(targetSessionId);
      const merged = await syncServerHistory(config, stored, gatewayAuth ?? undefined);
      setMessages(merged);
      setActiveTools([]);
      setStreamError(null);
    },
    [cancel, sessionId, setInstance, gatewayAuth],
  );

  const deleteSession = useCallback(
    async (targetSessionId: string) => {
      cancel();
      await clearChatMessages(targetSessionId);
      await removeSessionMeta(targetSessionId);

      if (targetSessionId !== sessionId) return;

      const config = await rotateSessionId();
      setInstance(config);
      setMessages([]);
      setActiveTools([]);
      setStreamError(null);
    },
    [cancel, sessionId, setInstance],
  );

  const runCommand = useCallback(
    async (command: string): Promise<string> => {
      if (!client || !instance) {
        throw new Error('No Carina instance configured');
      }

      let activeSessionId = instance.sessionId;
      if (!activeSessionId) {
        const next = await ensureSessionId();
        setInstance(next);
        activeSessionId = next.sessionId;
      }

      const response = await client.chat({
        message: command,
        sessionId: activeSessionId,
      });

      // Backend returns server-side webSession.sessionId; keep the client session id
      // so stream and /clear continue to map to the same hosted external id.

      const assistantMessage = createMessage('assistant', response.reply, {
        provider: response.provider,
      });

      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        void persist(activeSessionId, next);
        return next;
      });

      return response.reply;
    },
    [client, instance, persist, setInstance],
  );

  const sendMessage = useCallback(
    async (rawText: string, options?: { fromQueue?: boolean }) => {
      const text = rawText.trim();
      if (!text || streaming || !instance) return;

      if (isSlashCommand(text) && text !== '/clear') {
        const userMessage = createMessage('user', text);
        setMessages((prev) => [...prev, userMessage]);
        try {
          await runCommand(text);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setStreamError(msg);
          setMessages((prev) => [
            ...prev,
            createMessage('assistant', `Error: ${msg}`, { status: 'error' }),
          ]);
        }
        return;
      }

      if (text === '/clear') {
        if (client && sessionId) {
          try {
            await client.clearSession(sessionId);
          } catch {
            // local clear still applies
          }
        }
        setMessages([]);
        setActiveTools([]);
        await clearChatMessages(sessionId);
        await removeSessionMeta(sessionId);
        return;
      }

      if (!options?.fromQueue) {
        const network = await NetInfo.fetch();
        if (!network.isConnected) {
          const localEnabled = await isLocalModelEnabled();
          if (localEnabled && isLocalModelReady()) {
            cancel();
            const controller = new AbortController();
            abortRef.current = controller;

            const userMessage = createMessage('user', text);
            const assistantId = `assistant-${Date.now()}`;
            const assistantPlaceholder: ChatMessage = {
              id: assistantId,
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
              status: 'streaming',
              provider: getLoadedLocalModelDisplayName(),
              inferenceType: 'local',
            };

            setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
            setStreaming(true);
            setStreamError(null);
            setActiveTools([]);

            let streamBuffer = '';
            const history = [...messages, userMessage];

            try {
              for await (const token of localChatStream(history, controller.signal)) {
                streamBuffer += token;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: streamBuffer } : msg,
                  ),
                );
              }

              let finalMessages: ChatMessage[] = [];
              setMessages((prev) => {
                finalMessages = prev.map((msg) =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        content: streamBuffer,
                        status: 'done' as const,
                        provider: getLoadedLocalModelDisplayName(),
                        inferenceType: 'local' as const,
                      }
                    : msg,
                );
                return finalMessages;
              });
              await persist(sessionId || instance.sessionId, finalMessages);
              void hapticSuccess();
            } catch (err) {
              if (controller.signal.aborted) {
                setMessages((prev) => prev.filter((item) => item.id !== assistantId));
                return;
              }
              const msg = err instanceof Error ? err.message : String(err);
              setStreamError(msg);
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === assistantId
                    ? {
                        ...item,
                        content: `Local model error: ${msg}`,
                        status: 'error' as const,
                        inferenceType: 'local' as const,
                      }
                    : item,
                ),
              );
              void hapticError();
            } finally {
              setStreaming(false);
              abortRef.current = null;
            }
            return;
          }

          const userMessage = createMessage('user', text);
          setMessages((prev) => [...prev, userMessage]);
          await enqueueOfflineMessage(text);
          setStreamError('Offline; model not downloaded. Message queued.');
          return;
        }
      }

      cancel();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage = options?.fromQueue ? null : createMessage('user', text);
      const assistantId = `assistant-${Date.now()}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'streaming',
      };

      const taskId = `task-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        ...(userMessage ? [userMessage] : []),
        assistantPlaceholder,
      ]);
      setStreaming(true);
      setStreamError(null);
      setActiveTools([]);

      let streamBuffer = '';
      let providerName = '';
      let activeSessionId = instance.sessionId;

      if (!activeSessionId) {
        const next = await ensureSessionId();
        setInstance(next);
        activeSessionId = next.sessionId;
      }

      await upsertTask({
        id: taskId,
        sessionId: activeSessionId,
        prompt: text,
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      try {
        try {
          const providers = await client?.providers();
          providerName = providers?.active ?? '';
        } catch {
          providerName = '';
        }

        const remotePush =
          instance.mode === 'cloud' ? await loadRemotePushEnabled() : false;

        const full = await streamChat({
          baseUrl: instance.baseUrl,
          message: text,
          sessionId: activeSessionId,
          provider: providerName || undefined,
          credentials: gatewayAuth?.credentials ?? 'omit',
          apiKey: gatewayAuth?.apiKey ?? undefined,
          pushNotify: remotePush,
          signal: controller.signal,
          onSessionId: (serverSessionId) => {
            if (!serverSessionId || serverSessionId === activeSessionId) return;
            activeSessionId = serverSessionId;
            void setSessionId(serverSessionId).then((next) => setInstance(next));
          },
          onChunk: (chunk) => {
            if (!chunk.content) return;
            streamBuffer += chunk.content;
            const tools = extractToolNames(streamBuffer);
            setActiveTools(tools);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? { ...msg, content: stripToolMarkers(streamBuffer), toolsUsed: tools }
                  : msg,
              ),
            );
          },
        });

        const toolsUsed = extractToolNames(full);
        let finalMessages: ChatMessage[] = [];
        setMessages((prev) => {
          finalMessages = prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: stripToolMarkers(full) || full.trim(),
                  provider: providerName || undefined,
                  toolsUsed,
                  status: 'done' as const,
                }
              : msg,
          );
          return finalMessages;
        });
        await persist(activeSessionId, finalMessages);
        await patchTask(taskId, {
          sessionId: activeSessionId,
          status: 'completed',
          completedAt: new Date().toISOString(),
          toolsUsed,
          summary: stripToolMarkers(full).slice(0, 240) || full.trim().slice(0, 240),
        });
        void notifyTaskFinished(text, 'completed');
        void hapticSuccess();
        void syncTaskWidgetFromStore();
        setActiveTools([]);
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((prev) => prev.filter((item) => item.id !== assistantId));
          await patchTask(taskId, {
            sessionId: activeSessionId || sessionId,
            status: 'failed',
            completedAt: new Date().toISOString(),
            summary: 'Cancelled',
          });
          return;
        }

        const msg = err instanceof Error ? err.message : String(err);
        if (instance.mode === 'cloud' && isApiAuthError(msg)) {
          setStreamError('Session expired. Sign in again to continue.');
          void refresh();
          setMessages((prev) => prev.filter((item) => item.id !== assistantId));
          await patchTask(taskId, {
            sessionId: activeSessionId || sessionId,
            status: 'failed',
            completedAt: new Date().toISOString(),
            summary: msg,
          });
          return;
        }
        if (isLikelyNetworkError(msg)) {
          if (!options?.fromQueue) {
            await enqueueOfflineMessage(text);
            setStreamError('Connection lost. Message queued for send.');
          } else {
            setStreamError('Connection lost. Queued message not sent.');
          }
          setMessages((prev) => prev.filter((item) => item.id !== assistantId));
          await patchTask(taskId, {
            sessionId: activeSessionId || sessionId,
            status: 'failed',
            completedAt: new Date().toISOString(),
            summary: msg,
          });
          return;
        }
        setStreamError(msg);
        let finalMessages: ChatMessage[] = [];
        setMessages((prev) => {
          finalMessages = prev.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content: streamBuffer ? stripToolMarkers(streamBuffer) : `Error: ${msg}`,
                  status: 'error' as const,
                }
              : item,
          );
          return finalMessages;
        });
        await persist(activeSessionId || sessionId, finalMessages);
        await patchTask(taskId, {
          sessionId: activeSessionId || sessionId,
          status: 'failed',
          completedAt: new Date().toISOString(),
          summary: msg,
        });
        void notifyTaskFinished(text, 'failed');
        void hapticError();
        void syncTaskWidgetFromStore();
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [cancel, client, gatewayAuth, instance, messages, persist, refresh, runCommand, sessionId, setInstance, streaming],
  );

  return {
    ready,
    messages,
    streaming,
    streamError,
    activeTools,
    sendMessage,
    runCommand,
    cancel,
    startNewChat,
    switchSession,
    deleteSession,
    sessionId,
  };
}
