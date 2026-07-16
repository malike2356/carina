import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  getAivaWorker,
  listAivaEmployeeMessages,
  sendAivaEmployeeMessage,
  type AivaEmployeeMessage,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import { AivaEmployeeSectionNav } from '@/components/AivaEmployeeSectionNav';
import { AivaWorkerChatPanel } from '@/components/AivaWorkerChatPanel';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { useAuth } from '@/store/auth-store';
import { spacing } from '@/theme/tokens';

function EmployeeChat({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [worker, setWorker] = useState<AivaWorkerDetail | null>(null);
  const [messages, setMessages] = useState<AivaEmployeeMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
      setError('Sign in to Carina Cloud to chat with this employee.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, thread] = await Promise.all([
        getAivaWorker(instance.baseUrl, workerId, gatewayAuth),
        listAivaEmployeeMessages(instance.baseUrl, workerId, gatewayAuth),
      ]);
      setWorker(detail);
      setMessages(thread);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth, instance?.baseUrl, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(async () => {
    const content = message.trim();
    if (!content || !worker || !instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendAivaEmployeeMessage(instance.baseUrl, worker.id, content, gatewayAuth);
      setMessage('');
      setMessages(await listAivaEmployeeMessages(
        instance.baseUrl,
        worker.id,
        gatewayAuth,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, message, worker]);

  if (loading) return <LoadingPanel label="Loading chat" />;
  if (error && !worker) {
    return <ErrorRetryCard message={error} onRetry={() => void load()} />;
  }
  if (!worker) {
    return <ErrorRetryCard message="Employee not found." onRetry={() => router.back()} />;
  }

  return (
    <View style={styles.root}>
      <AivaEmployeeSectionNav workerId={worker.id} active="chat" />
      {error ? <ErrorRetryCard message={error} onRetry={() => setError(null)} retryLabel="Dismiss" /> : null}
      <AivaWorkerChatPanel
        worker={worker}
        messages={messages}
        message={message}
        onMessageChange={setMessage}
        onSend={() => void send()}
        busy={busy}
      />
    </View>
  );
}

export default function EmployeeChatScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';
  return (
    <ScreenShell title="Employee chat" subtitle="Direct conversation" showBack scroll={false}>
      <CloudFeatureGate feature="aiva">
        {workerId
          ? <EmployeeChat workerId={workerId} />
          : <ErrorRetryCard message="Missing employee id." onRetry={() => router.back()} />}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    gap: spacing.sm,
  },
});
