import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { ScreenShell } from '@/components/ScreenShell';
import { colors, radii, spacing } from '@/theme/tokens';

const DESTINATIONS = [
  {
    href: '/(tabs)/inbox/approvals' as Href,
    title: 'Approvals',
    subtitle: 'Review and approve drafts waiting for you.',
  },
  {
    href: '/(tabs)/inbox/conversations' as Href,
    title: 'Conversations',
    subtitle: 'Browse recent threads across employees.',
  },
  {
    href: '/(tabs)/inbox/escalations' as Href,
    title: 'Escalations',
    subtitle: 'Open handoffs that need a human.',
  },
] as const;

export default function InboxHubScreen() {
  return (
    <ScreenShell title="Inbox" subtitle="Pick one queue. Each opens on its own page." scroll>
      <CloudFeatureGate feature="aiva">
        <View style={styles.block}>
          {DESTINATIONS.map((item) => (
            <Pressable
              key={item.title}
              style={styles.card}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.subtitle}</Text>
            </Pressable>
          ))}
        </View>
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  card: {
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.inkMid,
    minHeight: 72,
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '600',
  },
  meta: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 18,
  },
});
