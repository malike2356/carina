import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { MobileProject } from '../../hooks/useLauncherProjects';

interface Props {
  projects: MobileProject[];
}

export function MobileProjectList({ projects }: Props) {
  const open = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(tabs)/chat`);
    void id;
  };

  if (projects.length === 0) {
    return <Text style={styles.empty}>No projects yet. Start one from the dashboard.</Text>;
  }

  return (
    <View style={styles.list}>
      {projects.map(p => (
        <TouchableOpacity
          key={p.id}
          style={styles.card}
          onPress={() => void open(p.id)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open project ${p.name}`}
        >
          <View style={[styles.icon, { backgroundColor: p.color }]}>
            <Text style={styles.iconLetter}>{p.name[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.type}>{p.workspaceType}</Text>
          </View>
          <Text style={styles.time}>{p.lastActivityAgo}</Text>
          <Text style={styles.chevron}>{'>'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { fontSize: 13, color: '#4a6a8a', textAlign: 'center', paddingVertical: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#0d1829',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a2b45',
    minHeight: 64,
  },
  icon: {
    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  iconLetter: { color: '#fff', fontWeight: '700', fontSize: 16 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '600', color: '#e8f0f8' },
  type: { fontSize: 12, color: '#6b8aaa' },
  time: { fontSize: 12, color: '#6b8aaa' },
  chevron: { fontSize: 18, color: '#4a6a8a' },
});
