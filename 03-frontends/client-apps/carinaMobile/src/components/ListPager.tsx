import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

export const DEFAULT_PAGE_SIZE = 20;

export function totalPagesFor(total: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function slicePage<T>(
  items: T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): T[] {
  const safePage = Math.min(Math.max(1, page), totalPagesFor(items.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

interface ListPagerProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  onChangePage: (page: number) => void;
  disabled?: boolean;
}

/** Previous / Page X of Y / Next; matches Memory screen controls. */
export function ListPager({
  page,
  totalPages,
  totalItems,
  onChangePage,
  disabled = false,
}: ListPagerProps) {
  if (totalPages <= 1) return null;

  const atStart = page <= 1 || disabled;
  const atEnd = page >= totalPages || disabled;

  return (
    <View style={styles.pager}>
      <Pressable
        disabled={atStart}
        onPress={() => onChangePage(page - 1)}
        style={atStart ? styles.pagerDisabled : undefined}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <Text style={styles.pagerText}>Previous</Text>
      </Pressable>
      <Text style={styles.pagerMeta}>
        Page {page} of {totalPages}
        {typeof totalItems === 'number' ? ` · ${totalItems}` : ''}
      </Text>
      <Pressable
        disabled={atEnd}
        onPress={() => onChangePage(page + 1)}
        style={atEnd ? styles.pagerDisabled : undefined}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Text style={styles.pagerText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pagerDisabled: { opacity: 0.4 },
  pagerText: { color: colors.tealLight, fontSize: 13, fontWeight: '600' },
  pagerMeta: { color: colors.silver, fontSize: 12, flexShrink: 1, textAlign: 'center' },
});
