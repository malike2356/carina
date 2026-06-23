import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileLogoBlock } from './MobileLogoBlock';
import { MobileGreeting } from './MobileGreeting';
import { MobileProjectList } from './MobileProjectList';
import { MobileContinueButton } from './MobileContinueButton';
import { MobileStatusBar } from './MobileStatusBar';
import { useLauncherUser } from '../../hooks/useLauncherUser';
import { useLauncherProjects } from '../../hooks/useLauncherProjects';

export function MobileLauncher() {
  const insets = useSafeAreaInsets();
  const { user } = useLauncherUser();
  const { projects } = useLauncherProjects(3);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <MobileLogoBlock />
        <MobileGreeting user={user} projectCount={projects.length} />
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>PICK UP WHERE YOU LEFT OFF</Text>
        <MobileProjectList projects={projects} />
        <MobileContinueButton />
      </ScrollView>
      <MobileStatusBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060c18' },
  scroll: { paddingHorizontal: 24, paddingTop: 48, gap: 20, paddingBottom: 16 },
  divider: { height: 1, backgroundColor: '#1a2b45', marginVertical: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#4a6a8a',
    textTransform: 'uppercase',
  },
});
