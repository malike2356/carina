import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  listAivaWorkerConversations,
  listAivaWorkerOutbound,
  type AivaConversationSummaryRow,
  type AivaOutboundMessage,
  type AivaWorkerDetail,
} from '@/api/aiva-client';
import {
  DEFAULT_PAGE_SIZE,
  ListPager,
  slicePage,
  totalPagesFor,
} from '@/components/ListPager';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { colors, radii, spacing } from '@/theme/tokens';

type Props = {
  worker: AivaWorkerDetail;
  baseUrl: string;
  auth: GatewayAuthOptions | null;
};

export function AivaOversightPanel({ worker, baseUrl, auth }: Props) {
  const [conversations, setConversations] = useState<AivaConversationSummaryRow[]>([]);
  const [outbound, setOutbound] = useState<AivaOutboundMessage[]>([]);
  const [convPage, setConvPage] = useState(1);
  const [outPage, setOutPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!auth?.apiKey) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [conv, out] = await Promise.all([
          listAivaWorkerConversations(baseUrl, worker.id, auth).catch(() => []),
          listAivaWorkerOutbound(baseUrl, worker.id, auth).catch(() => []),
        ]);
        if (cancelled) return;
        setConversations(conv);
        setOutbound(out);
        setConvPage(1);
        setOutPage(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [auth, baseUrl, worker.id]);

  const convPages = totalPagesFor(conversations.length, DEFAULT_PAGE_SIZE);
  const outPages = totalPagesFor(outbound.length, DEFAULT_PAGE_SIZE);
  const convSlice = useMemo(
    () => slicePage(conversations, convPage, DEFAULT_PAGE_SIZE),
    [conversations, convPage],
  );
  const outSlice = useMemo(
    () => slicePage(outbound, outPage, DEFAULT_PAGE_SIZE),
    [outbound, outPage],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.tealLight} />
        <Text style={styles.meta}>Loading oversight...</Text>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.card}>
        <Text style={styles.title}>External conversations</Text>
        <Text style={styles.subtitle}>
          Threads {worker.name} is handling across email, WhatsApp, and other channels.
        </Text>
        {conversations.length === 0 ? (
          <Text style={styles.empty}>No external threads yet.</Text>
        ) : (
          <>
            {convSlice.map((row) => (
              <View key={row.id} style={styles.row}>
                <Text style={styles.rowTitle}>
                  {row.channel} · {row.contactId || 'Contact'}
                </Text>
                <Text style={styles.meta}>
                  {row.messageCount} message{row.messageCount === 1 ? '' : 's'}
                  {row.lastMessageAt
                    ? ` · ${new Date(row.lastMessageAt).toLocaleString()}`
                    : ''}
                </Text>
              </View>
            ))}
            <ListPager
              page={convPage}
              totalPages={convPages}
              totalItems={conversations.length}
              onChangePage={setConvPage}
            />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Outbound messages</Text>
        <Text style={styles.subtitle}>
          Welcome emails, WhatsApp pings, and other messages {worker.name} has sent.
        </Text>
        {outbound.length === 0 ? (
          <Text style={styles.empty}>No outbound messages logged yet.</Text>
        ) : (
          <>
            {outSlice.map((item) => (
              <View key={item.id} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{item.contactId || 'Recipient'}</Text>
                  <Text style={styles.badge}>Delivered</Text>
                </View>
                {item.subject ? <Text style={styles.subject}>{item.subject}</Text> : null}
                <Text style={styles.preview}>{item.preview}</Text>
                <Text style={styles.meta}>
                  {item.channel} · {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            ))}
            <ListPager
              page={outPage}
              totalPages={outPages}
              totalItems={outbound.length}
              onChangePage={setOutPage}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  loading: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: colors.inkMid,
    gap: spacing.sm,
  },
  title: { color: colors.white, fontSize: 16, fontWeight: '600' },
  subtitle: { color: colors.silverMid, fontSize: 13, lineHeight: 18, marginBottom: spacing.xs },
  empty: { color: colors.silver, fontSize: 13, paddingVertical: spacing.sm },
  row: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
    backgroundColor: colors.ink,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: { color: colors.white, fontSize: 14, fontWeight: '600', flex: 1 },
  badge: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  subject: { color: colors.silver, fontSize: 12, fontWeight: '600' },
  preview: { color: colors.silver, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.silverMid, fontSize: 12 },
});
