import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EpisodicMemory } from '@/api/types';
import { MemoryCard } from '@/components/MemoryCard';
import { MemoryEditModal } from '@/components/MemoryEditModal';
import { ScreenShell } from '@/components/ScreenShell';
import { useMemories } from '@/hooks/useMemories';
import { colors, radii, spacing } from '@/theme/tokens';

export default function MemoryScreen() {
  const { entries, loading, saving, error, page, totalPages, query, refresh, remove, search, update } =
    useMemories();
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<EpisodicMemory | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh(1, query);
    }, [query, refresh]),
  );

  async function handleSave(id: string, content: string) {
    const ok = await update(id, content);
    if (ok) setEditing(null);
  }

  return (
    <ScreenShell
      title="Memory"
      subtitle="Episodic memories Carina recalls across sessions."
      scroll={false}
      showBack
    >
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search memories..."
          placeholderTextColor={colors.silverMid}
          onSubmitEditing={() => void search(searchText)}
        />
        <Pressable style={styles.searchBtn} onPress={() => void search(searchText)}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh(page, query)}
            tintColor={colors.tealLight}
          />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && entries.length === 0 ? (
          <ActivityIndicator color={colors.tealLight} />
        ) : entries.length === 0 ? (
          <Text style={styles.empty}>No memories yet. Carina stores episodic recall as you chat.</Text>
        ) : (
          entries.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={setEditing}
              onDelete={(id) => void remove(id)}
            />
          ))
        )}

        {totalPages > 1 ? (
          <View style={styles.pager}>
            <Pressable
              disabled={page <= 1}
              onPress={() => void refresh(page - 1, query)}
              style={page <= 1 && styles.pagerDisabled}
            >
              <Text style={styles.pagerText}>Previous</Text>
            </Pressable>
            <Text style={styles.pagerMeta}>
              Page {page} of {totalPages}
            </Text>
            <Pressable
              disabled={page >= totalPages}
              onPress={() => void refresh(page + 1, query)}
              style={page >= totalPages && styles.pagerDisabled}
            >
              <Text style={styles.pagerText}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <MemoryEditModal
        visible={editing !== null}
        memory={editing}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={(id, content) => void handleSave(id, content)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  scroll: { flex: 1 },
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  error: { color: colors.danger, fontSize: 13 },
  empty: { color: colors.silver, fontSize: 14, lineHeight: 20 },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  pagerDisabled: { opacity: 0.4 },
  pagerText: { color: colors.tealLight, fontSize: 13, fontWeight: '600' },
  pagerMeta: { color: colors.silver, fontSize: 12 },
});
