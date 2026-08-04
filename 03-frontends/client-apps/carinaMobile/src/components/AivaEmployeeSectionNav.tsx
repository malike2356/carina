import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '@/theme/tokens';

export type AivaEmployeeSection =
  | 'overview'
  | 'chat'
  | 'tasks'
  | 'channels'
  | 'training'
  | 'automations'
  | 'settings';

const SECTIONS: Array<{ id: AivaEmployeeSection; label: string; path: string }> = [
  { id: 'overview', label: 'Overview', path: '' },
  { id: 'chat', label: 'Chat', path: '/chat' },
  { id: 'tasks', label: 'Tasks', path: '/tasks' },
  { id: 'channels', label: 'Channels', path: '/channels' },
  { id: 'training', label: 'Training', path: '/training' },
  { id: 'automations', label: 'Automations', path: '/automations' },
  { id: 'settings', label: 'Settings', path: '/settings' },
];

export function AivaEmployeeSectionNav({
  workerId,
  active,
}: {
  workerId: string;
  active: AivaEmployeeSection;
}) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        accessibilityRole="tablist"
      >
        {SECTIONS.map((section) => {
          const selected = section.id === active;
          return (
            <Pressable
              key={section.id}
              style={[styles.tab, selected && styles.tabActive]}
              onPress={() => {
                if (!selected) {
                  router.replace(`/employee/${workerId}${section.path}` as Href);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.label, selected && styles.labelActive]}>
                {section.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
    height: 40,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  tab: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDim,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 4,
    backgroundColor: colors.inkMid,
  },
  tabActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  label: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  labelActive: {
    color: colors.white,
  },
});
