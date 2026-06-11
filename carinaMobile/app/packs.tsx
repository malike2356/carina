import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PackCard } from '@/components/PackCard';
import { ScreenShell } from '@/components/ScreenShell';
import { usePacks } from '@/hooks/usePacks';
import { colors, spacing } from '@/theme/tokens';

export default function PacksScreen() {
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
    <ScreenShell
      title="Skill packs"
      subtitle="Optional domain packs from your Carina gateway. property-uk is reserved for Propreneur."
      scroll={false}
      showBack
    >
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  error: { color: colors.danger, fontSize: 13 },
  empty: { color: colors.silver, fontSize: 14 },
});
