import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChatMessage } from '@/api/types';
import { CarinaLogo } from '@/components/CarinaLogo';
import { ConnectionStatusChip } from '@/components/ConnectionStatusChip';
import { ChatComposer } from '@/components/ChatComposer';
import { ChatMessageBubble } from '@/components/ChatMessageBubble';
import { CommandPalette } from '@/components/CommandPalette';
import { ProviderBadge } from '@/components/ProviderBadge';
import { ProviderPicker } from '@/components/ProviderPicker';
import { ScoutStatusChip } from '@/components/ScoutStatusChip';
import { SuggestedPrompts } from '@/components/SuggestedPrompts';
import { ToolActivityStrip } from '@/components/ToolActivityStrip';
import { filterSlashCommands } from '@/config/commands';
import { useCarinaConfig } from '@/hooks/useCarinaConfig';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner';
import { SessionDrawer } from '@/components/SessionDrawer';
import { useChatSession } from '@/hooks/useChatSession';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useSessionActions } from '@/hooks/useSessionActions';
import { useSessionIndex } from '@/hooks/useSessionIndex';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { loadChatMessages } from '@/lib/chat-session';
import { hapticLight } from '@/lib/haptics';
import { deriveSessionMeta } from '@/lib/session-registry';
import { shareSession } from '@/lib/share-session';
import { useAuth } from '@/store/auth-store';
import { colors, spacing } from '@/theme/tokens';

export default function ChatScreen() {
  const { sessionId: linkedSessionId, pendingVoice } = useLocalSearchParams<{
    sessionId?: string;
    pendingVoice?: string;
  }>();
  const { user, instance, gatewayAuth } = useAuth();
  const { providers, loading: providerLoading, reload: reloadProviders } = useCarinaConfig();
  const {
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
  } = useChatSession();
  const { sessions, loading: sessionsLoading, reload: reloadSessions } = useSessionIndex();
  const { renameSession, togglePin } = useSessionActions(reloadSessions);
  const { status: connectionStatus } = useConnectionStatus(instance?.baseUrl, gatewayAuth ?? undefined);

  const [composerText, setComposerText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scoutStatus = user?.scoutActive ? 'active' : user ? 'inactive' : 'unknown';
  const providerLabel = providerLoading
    ? 'Loading'
    : providers?.active ?? 'Offline';

  const commandMatches = filterSlashCommands(composerText);
  const { queue, flushing, flush } = useOfflineQueue(
    useCallback(async (text: string) => sendMessage(text, { fromQueue: true }), [sendMessage]),
  );

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setComposerText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  }, []);
  const {
    available: voiceAvailable,
    listening: voiceListening,
    error: voiceError,
    toggle: toggleVoice,
  } = useVoiceInput(handleVoiceTranscript);

  const handleSend = useCallback(
    async (text: string) => {
      setComposerText('');
      void hapticLight();
      await sendMessage(text);
      scrollToEnd();
    },
    [sendMessage, scrollToEnd],
  );

  const handleSelectCommand = useCallback(
    (command: string) => {
      setComposerText(command);
    },
    [],
  );

  useEffect(() => {
    if (linkedSessionId && typeof linkedSessionId === 'string' && ready) {
      void switchSession(linkedSessionId);
    }
  }, [linkedSessionId, ready, switchSession]);

  useEffect(() => {
    if (!ready || !pendingVoice || typeof pendingVoice !== 'string') return;
    const text = pendingVoice.trim();
    if (!text) return;
    void sendMessage(text);
    scrollToEnd();
  }, [pendingVoice, ready, scrollToEnd, sendMessage]);

  const handleNewChat = useCallback(async () => {
    await startNewChat();
    setDrawerOpen(false);
    await reloadSessions();
  }, [reloadSessions, startNewChat]);

  const handleSelectSession = useCallback(
    async (id: string) => {
      await switchSession(id);
      setDrawerOpen(false);
      scrollToEnd();
    },
    [scrollToEnd, switchSession],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      await reloadSessions();
    },
    [deleteSession, reloadSessions],
  );

  const handleShareSession = useCallback(
    async (id: string) => {
      void hapticLight();
      const stored = await loadChatMessages(id);
      const meta = sessions.find((item) => item.id === id) ?? deriveSessionMeta(id, stored);
      await shareSession(meta, stored);
    },
    [sessions],
  );

  const handleProviderSelect = useCallback(
    async (provider: string) => {
      setSwitchingProvider(true);
      try {
        await runCommand(`/provider ${provider}`);
        await reloadProviders();
        setPickerOpen(false);
        scrollToEnd();
      } catch {
        // runCommand surfaces errors in chat
      } finally {
        setSwitchingProvider(false);
      }
    },
    [reloadProviders, runCommand, scrollToEnd],
  );

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.tealLight} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.sessionsBtn}
            onPress={() => {
              void reloadSessions();
              setDrawerOpen(true);
            }}
          >
            <Text style={styles.sessionsText}>Sessions</Text>
          </Pressable>
          <View style={styles.headerRight}>
            <ConnectionStatusChip
              status={connectionStatus}
              onPress={() => router.push('/instance')}
            />
            <ScoutStatusChip status={scoutStatus} />
            <ProviderBadge
              label={providerLabel}
              loading={providerLoading}
              onPress={() => setPickerOpen(true)}
            />
            <Pressable style={styles.newChatBtn} onPress={() => void handleNewChat()}>
              <Text style={styles.newChatText}>New</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessageBubble message={item} />}
          contentContainerStyle={messages.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <SuggestedPrompts
              onSelect={(prompt) => void handleSend(prompt)}
              disabled={streaming}
            />
          }
          onContentSizeChange={scrollToEnd}
        />

        {streamError ? <Text style={styles.error}>{streamError}</Text> : null}
        {voiceError ? <Text style={styles.error}>{voiceError}</Text> : null}

        <ToolActivityStrip tools={activeTools} />
        <OfflineQueueBanner
          count={queue.length}
          flushing={flushing}
          onFlush={() => void flush()}
        />
        <CommandPalette commands={commandMatches} onSelect={handleSelectCommand} />
        <ChatComposer
          text={composerText}
          onChangeText={setComposerText}
          onSend={(text) => void handleSend(text)}
          onStop={cancel}
          streaming={streaming}
          voiceAvailable={voiceAvailable}
          voiceListening={voiceListening}
          onVoicePress={() => void toggleVoice()}
        />
      </KeyboardAvoidingView>

      <ProviderPicker
        visible={pickerOpen}
        providers={providers?.providers ?? []}
        active={providers?.active ?? ''}
        loading={providerLoading}
        switching={switchingProvider}
        onClose={() => setPickerOpen(false)}
        onSelect={(name) => void handleProviderSelect(name)}
      />

      <SessionDrawer
        visible={drawerOpen}
        sessions={sessions}
        activeSessionId={sessionId}
        loading={sessionsLoading}
        onClose={() => setDrawerOpen(false)}
        onSelect={(id) => void handleSelectSession(id)}
        onNewChat={() => void handleNewChat()}
        onDelete={(id) => void handleDeleteSession(id)}
        onRename={(id, title) => void renameSession(id, title)}
        onTogglePin={(id, pinned) => void togglePin(id, pinned)}
        onShare={(id) => void handleShareSession(id)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDim,
    gap: spacing.sm,
  },
  sessionsBtn: {
    paddingVertical: 6,
    paddingRight: spacing.sm,
  },
  sessionsText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  newChatBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  newChatText: {
    color: colors.tealLight,
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  emptyList: {
    flexGrow: 1,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
});
