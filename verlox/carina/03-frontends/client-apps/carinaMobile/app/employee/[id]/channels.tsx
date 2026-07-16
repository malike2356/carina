import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  buildConnectChannelPayload,
  catalogChannelsForConnect,
  connectAivaChannel,
  connectedChannels,
  disconnectAivaChannel,
  fetchEmailOAuthAuthUrl,
  listAivaWorkerChannels,
  MOBILE_CHANNEL_FIELDS,
  setAivaChannelActive,
  validateConnectChannelValues,
  type AivaChannelCard,
  type AivaChannelsListResponse,
} from '@/api/aiva-channels';
import { AivaApiError } from '@/api/aiva-client';
import { AivaEmployeeSectionNav } from '@/components/AivaEmployeeSectionNav';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { LoadingPanel } from '@/components/LoadingPanel';
import { ScreenShell } from '@/components/ScreenShell';
import { isApiAuthError } from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';
import { colors, radii, spacing } from '@/theme/tokens';

type ConnectStep =
  | { kind: 'pick' }
  | { kind: 'form'; channel: AivaChannelCard }
  | { kind: 'email-choice'; channel: AivaChannelCard };

function statusLabel(channel: AivaChannelCard): string {
  if (channel.connectionStatus === 'token_expired') return 'Token expired';
  if (channel.connectionStatus === 'oauth_pending') return 'Setup incomplete';
  if (channel.connected && channel.active) return 'Active';
  if (channel.connected && !channel.active) return 'Paused';
  return 'Not connected';
}

function ChannelsBody({ workerId }: { workerId: string }) {
  const { instance, gatewayAuth } = useAuth();
  const [data, setData] = useState<AivaChannelsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<ConnectStep>({ kind: 'pick' });
  const [values, setValues] = useState<Record<string, string>>({});

  const refresh = useCallback(
    async (mode: 'full' | 'soft' = 'full') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey) {
        setError('Sign in to Carina Cloud to manage channels.');
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      if (mode === 'full') setLoading(true);
      else setRefreshing(true);
      setError(null);
      setSessionExpired(false);
      try {
        const next = await listAivaWorkerChannels(instance.baseUrl, workerId, gatewayAuth);
        setData(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = err instanceof AivaApiError ? err.status : 0;
        setError(message);
        setSessionExpired(isApiAuthError(message) || status === 401);
        if (mode === 'full') setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gatewayAuth, instance?.baseUrl, workerId],
  );

  useFocusEffect(
    useCallback(() => {
      void refresh('full');
    }, [refresh]),
  );

  const linked = useMemo(() => (data ? connectedChannels(data.channels) : []), [data]);
  const available = useMemo(
    () => (data ? catalogChannelsForConnect(data.channels) : []),
    [data],
  );

  const startConnect = useCallback((channel: AivaChannelCard) => {
    setActionError(null);
    setValues({});
    if (channel.type === 'email') {
      setStep({ kind: 'email-choice', channel });
      return;
    }
    setStep({ kind: 'form', channel });
  }, []);

  const cancelConnect = useCallback(() => {
    setStep({ kind: 'pick' });
    setValues({});
    setActionError(null);
  }, []);

  const submitConnect = useCallback(async () => {
    if (step.kind !== 'form' && step.kind !== 'email-choice') return;
    if (!instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
    const channelType = step.channel.type;
    const validation = validateConnectChannelValues(channelType, values);
    if (validation) {
      setActionError(validation);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const payload = buildConnectChannelPayload(workerId, channelType, values);
      await connectAivaChannel(instance.baseUrl, payload, gatewayAuth);
      setStep({ kind: 'pick' });
      setValues({});
      await refresh('soft');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, gatewayAuth, instance?.baseUrl, refresh, step, values, workerId]);

  const startEmailOAuth = useCallback(
    async (provider: 'gmail' | 'outlook') => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
      setBusy(true);
      setActionError(null);
      try {
        const authUrl = await fetchEmailOAuthAuthUrl(
          instance.baseUrl,
          provider,
          workerId,
          gatewayAuth,
        );
        await WebBrowser.openBrowserAsync(authUrl);
        setStep({ kind: 'pick' });
        await refresh('soft');
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, gatewayAuth, instance?.baseUrl, refresh, workerId],
  );

  const confirmDisconnect = useCallback(
    (channel: AivaChannelCard) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
      Alert.alert(
        `Disconnect ${channel.label}?`,
        channel.identifier
          ? `Removes ${channel.identifier} from this employee.`
          : 'Removes this channel from the employee.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setBusy(true);
                setActionError(null);
                try {
                  await disconnectAivaChannel(
                    instance.baseUrl,
                    workerId,
                    channel.id,
                    gatewayAuth,
                  );
                  await refresh('soft');
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            },
          },
        ],
      );
    },
    [busy, gatewayAuth, instance?.baseUrl, refresh, workerId],
  );

  const toggleActive = useCallback(
    async (channel: AivaChannelCard) => {
      if (!instance?.baseUrl || !gatewayAuth?.apiKey || busy) return;
      setBusy(true);
      setActionError(null);
      try {
        await setAivaChannelActive(
          instance.baseUrl,
          workerId,
          channel.id,
          !channel.active,
          gatewayAuth,
        );
        await refresh('soft');
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, gatewayAuth, instance?.baseUrl, refresh, workerId],
  );

  if (loading && !data) {
    return <LoadingPanel label="Loading channels" />;
  }

  if (error && !data) {
    return (
      <ErrorRetryCard
        message={
          sessionExpired
            ? 'Your Carina Cloud session expired. Sign in again to continue.'
            : error
        }
        onRetry={() => {
          if (sessionExpired) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { router } = require('expo-router');
            router.replace({ pathname: '/(auth)/login', params: { expired: '1' } });
            return;
          }
          void refresh('full');
        }}
        retryLabel={sessionExpired ? 'Sign in again' : 'Retry'}
      />
    );
  }

  if (step.kind === 'email-choice') {
    return (
      <View style={styles.block}>
        <Text style={styles.stepTitle}>Connect Email</Text>
        <Text style={styles.meta}>
          Choose OAuth for Gmail/Outlook, or inbound forwarding for other providers.
        </Text>
        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void startEmailOAuth('gmail')}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? 'Opening browser...' : 'Connect Gmail'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryBtn, busy && styles.btnDisabled]}
          onPress={() => void startEmailOAuth('outlook')}
          disabled={busy}
        >
          <Text style={styles.secondaryBtnText}>Connect Outlook</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setStep({ kind: 'form', channel: step.channel })}
          disabled={busy}
        >
          <Text style={styles.secondaryBtnText}>Inbound forwarding</Text>
        </Pressable>
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        <Pressable style={styles.linkRow} onPress={cancelConnect} disabled={busy}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
        <Text style={styles.hint}>
          After Gmail/Outlook, the browser may open the web workspace briefly. Return to this
          app and pull to refresh. Deep link: carina://employee/{workerId}/channels
        </Text>
      </View>
    );
  }

  if (step.kind === 'form') {
    const fields = MOBILE_CHANNEL_FIELDS[step.channel.type] ?? [];
    return (
      <View style={styles.block}>
        <Text style={styles.stepTitle}>Connect {step.channel.label}</Text>
        {step.channel.type === 'web' ? (
          <Text style={styles.meta}>
            Web chat uses the embed widget. No credentials required.
          </Text>
        ) : step.channel.type === 'email' ? (
          <Text style={styles.meta}>
            Optional inbound address. Leave blank to auto-generate a forwarding address.
          </Text>
        ) : (
          <Text style={styles.meta}>Credentials are encrypted before storage.</Text>
        )}
        {fields.map((field) => (
          <View key={field.key} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={styles.input}
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
              placeholder={field.placeholder}
              placeholderTextColor={colors.silverMid}
              secureTextEntry={Boolean(field.secret)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          </View>
        ))}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        <Pressable
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          onPress={() => void submitConnect()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Connect</Text>
          )}
        </Pressable>
        <Pressable style={styles.linkRow} onPress={cancelConnect} disabled={busy}>
          <Text style={styles.linkText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh('soft')}
          tintColor={colors.tealLight}
        />
      }
    >
      {data ? (
        <Text style={styles.meta}>
          {data.connectedCount} connected
          {data.channelLimit != null ? ` · limit ${data.channelLimit}` : ''}
          {data.planTier ? ` · ${data.planTier}` : ''}
        </Text>
      ) : null}

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <Text style={styles.section}>Connected</Text>
      {linked.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No channels yet</Text>
          <Text style={styles.meta}>
            Connect Telegram, Email, Slack, or Web so this employee can work.
          </Text>
        </View>
      ) : (
        linked.map((channel) => (
          <View key={channel.id} style={styles.card}>
            <Text style={styles.cardTitle}>{channel.label}</Text>
            <Text style={styles.meta}>
              {statusLabel(channel)}
              {channel.identifier ? ` · ${channel.identifier}` : ''}
            </Text>
            <View style={styles.rowActions}>
              {channel.connected ? (
                <Pressable
                  style={styles.smallBtn}
                  onPress={() => void toggleActive(channel)}
                  disabled={busy}
                >
                  <Text style={styles.smallBtnText}>
                    {channel.active ? 'Disable' : 'Enable'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.smallDanger}
                onPress={() => confirmDisconnect(channel)}
                disabled={busy}
              >
                <Text style={styles.smallDangerText}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Text style={styles.section}>Connect</Text>
      {available.length === 0 ? (
        <Text style={styles.meta}>
          All mobile-supported channels are connected, or none are available on this plan.
        </Text>
      ) : (
        available.map((channel) => (
          <Pressable
            key={channel.id}
            style={styles.connectRow}
            onPress={() => startConnect(channel)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Connect ${channel.label}`}
          >
            <Text style={styles.connectTitle}>{channel.label}</Text>
            <Text style={styles.linkText}>Connect</Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

export default function EmployeeChannelsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workerId = typeof params.id === 'string' ? params.id : '';

  return (
    <ScreenShell title="Channels" subtitle="Connect messaging channels." showBack scroll={false}>
      <CloudFeatureGate feature="aiva">
        {workerId ? (
          <View style={styles.screenBody}>
            <AivaEmployeeSectionNav workerId={workerId} active="channels" />
            <ChannelsBody workerId={workerId} />
          </View>
        ) : (
          <ErrorRetryCard message="Missing employee id." onRetry={() => undefined} />
        )}
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  screenBody: { flex: 1, minHeight: 0, gap: spacing.sm },
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  block: { gap: spacing.sm, paddingBottom: spacing.xl },
  section: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: spacing.md,
  },
  stepTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: colors.silverMid,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
  },
  cardTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  smallBtn: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  smallBtnText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 13,
  },
  smallDanger: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    justifyContent: 'center',
  },
  smallDangerText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  connectRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.inkMid,
  },
  connectTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  field: { gap: 4 },
  label: {
    color: colors.amber,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.white,
    backgroundColor: colors.inkMid,
    fontSize: 15,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.tealLight,
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.7 },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  linkRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    color: colors.tealLight,
    fontWeight: '600',
    fontSize: 14,
  },
});
