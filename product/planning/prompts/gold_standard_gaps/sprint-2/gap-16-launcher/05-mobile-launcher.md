# Prompt 05: Mobile Launcher (Expo/React Native)

## Context

The Carina mobile app lives in `carinaMobile/` and uses Expo Router with React Native.
The mobile launcher is the root screen (`/`) shown when no active session exists.

Mobile constraints:
- Full-screen portrait layout (no window chrome)
- Touch targets minimum 44x44pt
- Haptic feedback on primary actions
- Safe area insets (notch, home indicator)
- The Carina logo at the top, then greeting, then project list, then CONTINUE WORK

The design follows the same color palette as the web launcher but is stacked vertically.

## What to Build

### 1. Screen file

Create `carinaMobile/app/index.tsx` (or replace if it exists with a placeholder):
```tsx
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useActiveSession } from '../hooks/useActiveSession';
import { MobileLauncher } from '../components/launcher/MobileLauncher';

export default function RootScreen() {
  const { session, loading } = useActiveSession();

  if (loading) return null;
  if (session) return <Redirect href="/chat" />;

  return (
    <SafeAreaView style={styles.root}>
      <MobileLauncher />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#060c18',
  },
});
```

### 2. MobileLauncher component

File: `carinaMobile/components/launcher/MobileLauncher.tsx`

```tsx
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileLogoBlock } from './MobileLogoBlock';
import { MobileGreeting } from './MobileGreeting';
import { MobileProjectList } from './MobileProjectList';
import { MobileContinueButton } from './MobileContinueButton';
import { MobileStatusBar } from './MobileStatusBar';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useRecentProjects } from '../../hooks/useRecentProjects';

export function MobileLauncher() {
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();
  const { recentProjects } = useRecentProjects(3);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <MobileLogoBlock />
        <MobileGreeting user={user} />
        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>PICK UP WHERE YOU LEFT OFF</Text>
        <MobileProjectList projects={recentProjects} />
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
```

### 3. Logo block

```tsx
// carinaMobile/components/launcher/MobileLogoBlock.tsx
import { Image, StyleSheet, Text, View } from 'react-native';

export function MobileLogoBlock() {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/logo/carina_logo_1.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Carina logo"
      />
      <Text style={styles.wordmark}>Carina</Text>
      <Text style={styles.tagline}>ONE MEMORY. ONE AGENT. EVERYWHERE.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingTop: 16 },
  logo: { width: 96, height: 96 },
  wordmark: {
    fontSize: 34,
    fontWeight: '700',
    color: '#e8f0f8',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4a6a8a',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
```

Copy `carina_logo_1.png` to `carinaMobile/assets/logo/carina_logo_1.png`.

### 4. Greeting

```tsx
// carinaMobile/components/launcher/MobileGreeting.tsx
import { StyleSheet, Text, View } from 'react-native';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function MobileGreeting({ user, projectCount }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.greeting}>{getGreeting()}, {user?.firstName ?? 'there'}.</Text>
      <Text style={styles.sub}>{projectCount ?? 0} active projects</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  greeting: { fontSize: 22, fontWeight: '600', color: '#e8f0f8' },
  sub: { fontSize: 14, color: '#6b8aaa' },
});
```

### 5. Project list (touch-friendly cards)

```tsx
// carinaMobile/components/launcher/MobileProjectList.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export function MobileProjectList({ projects }) {
  const open = async (id) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/project/${id}`);
  };

  return (
    <View style={styles.list}>
      {projects.map(p => (
        <TouchableOpacity
          key={p.id}
          style={styles.card}
          onPress={() => open(p.id)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Open project ${p.name}`}
        >
          <View style={[styles.icon, { backgroundColor: p.color }]} />
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
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '600', color: '#e8f0f8' },
  type: { fontSize: 12, color: '#6b8aaa' },
  time: { fontSize: 12, color: '#6b8aaa' },
  chevron: { fontSize: 18, color: '#4a6a8a' },
});
```

### 6. Continue Work button

```tsx
// carinaMobile/components/launcher/MobileContinueButton.tsx
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export function MobileContinueButton() {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/chat');
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Continue work"
    >
      <Text style={styles.label}>CONTINUE WORK  &gt;</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#00d4ff',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#060c18',
  },
});
```

### 7. Mobile status bar (bottom strip)

```tsx
// carinaMobile/components/launcher/MobileStatusBar.tsx
import { StyleSheet, Text, View } from 'react-native';
import { useSystemStatus } from '../../hooks/useSystemStatus';

export function MobileStatusBar() {
  const { scout, version } = useSystemStatus();
  return (
    <View style={styles.bar}>
      <View style={styles.item}>
        <View style={[styles.dot, { backgroundColor: scout.ok ? '#16c97e' : '#ef4444' }]} />
        <Text style={styles.label}>Scout {scout.ok ? 'Protected' : 'Offline'}</Text>
      </View>
      <Text style={styles.label}>Encrypted</Text>
      <Text style={[styles.label, styles.right]}>v{version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#060c18',
    borderTopWidth: 1,
    borderTopColor: '#1a2b45',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 11, color: '#6b8aaa' },
  right: { marginLeft: 'auto' },
});
```

### 8. Required Expo packages

Ensure these are in `carinaMobile/package.json`:
```json
"expo-haptics": "*",
"react-native-safe-area-context": "*",
"expo-router": "*"
```

Run:
```bash
cd carinaMobile
npx expo install expo-haptics react-native-safe-area-context
```

## Verification Checklist

- [ ] Logo, wordmark, and tagline centered and correctly sized (96pt logo)
- [ ] Greeting changes based on time of day
- [ ] Each project card is at least 64pt tall (44pt requirement met)
- [ ] Haptic feedback fires on card tap and CONTINUE WORK tap
- [ ] CONTINUE WORK navigates to `/chat`
- [ ] Status bar visible at bottom, does not overlap home indicator
- [ ] Safe area insets applied correctly on notch devices (iPhone 14+, Pixel)
- [ ] App renders in dark mode and light mode without white flash

## Files to Create or Modify

- MODIFY `carinaMobile/app/index.tsx` - show MobileLauncher when no session
- CREATE `carinaMobile/components/launcher/MobileLauncher.tsx`
- CREATE `carinaMobile/components/launcher/MobileLogoBlock.tsx`
- CREATE `carinaMobile/components/launcher/MobileGreeting.tsx`
- CREATE `carinaMobile/components/launcher/MobileProjectList.tsx`
- CREATE `carinaMobile/components/launcher/MobileContinueButton.tsx`
- CREATE `carinaMobile/components/launcher/MobileStatusBar.tsx`
- COPY `carina_logo_1.png` -> `carinaMobile/assets/logo/carina_logo_1.png`
