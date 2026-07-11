import { StyleSheet, Text, View } from 'react-native';
import type { MobileLauncherUser } from '../../hooks/useLauncherUser';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

interface Props {
  user: MobileLauncherUser | null;
  projectCount: number;
}

export function MobileGreeting({ user, projectCount }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>
        {getGreeting()}, {user?.firstName ?? 'there'}.
      </Text>
      <Text style={styles.sub}>{projectCount} active project{projectCount !== 1 ? 's' : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  greeting: { fontSize: 22, fontWeight: '600', color: '#e8f0f8' },
  sub: { fontSize: 14, color: '#6b8aaa' },
});
