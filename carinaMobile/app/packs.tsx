import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CloudFeatureGate } from '@/components/CloudFeatureGate';
import { PackCard } from '@/components/PackCard';
import { ScreenShell } from '@/components/ScreenShell';
import { usePacks } from '@/hooks/usePacks';
import { colors, radii, spacing } from '@/theme/tokens';

function PacksScreenBody() {
  const {
    available,
    loading,
    error,
    busyPack,
    refresh,
    install,
    uninstall,
    isInstalled,
  } = usePacks();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.tealLight}
        />
      }
    >
      {error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void refresh()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      {loading && available.length === 0 ? (
        <ActivityIndicator color={colors.tealLight} />
      ) : available.length === 0 ? (
        <Text style={styles.empty}>No packs available on this instance.</Text>
      ) : (
        available.map((pack) => (
          <PackCard
            key={pack.name}
            pack={pack}
            installed={isInstalled(pack.name)}
            busy={busyPack === pack.name}
            onInstall={() => void install(pack.name)}
            onUninstall={() => void uninstall(pack.name)}
          />
        ))
      )}
    </ScrollView>
  );
}

export default function PacksScreen() {
  return (
    <ScreenShell
      title="Skill packs"
      subtitle="Optional domain packs from your Carina gateway. property-uk is reserved for Propreneur."
      scroll={false}
      showBack
    >
      <CloudFeatureGate feature="packs">
        <PacksScreenBody />
      </CloudFeatureGate>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  errorBlock: { gap: spacing.sm },
  error: { color: colors.danger, fontSize: 13 },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  retryText: { color: colors.tealLight, fontWeight: '600', fontSize: 13 },
  empty: { color: colors.silver, fontSize: 14 },
});
