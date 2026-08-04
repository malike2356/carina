import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useCloudSessionGuard } from '@/hooks/useCloudSessionGuard';
import { useAuth } from '@/store/auth-store';
import { colors } from '@/theme/tokens';

type TabIconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: TabIconName) {
  return function TabIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

const TAB_BAR_VISIBLE = {
  backgroundColor: colors.inkMid,
  borderTopColor: colors.borderDim,
};

const TAB_BAR_HIDDEN = {
  display: 'none' as const,
  height: 0,
  overflow: 'hidden' as const,
};

export default function TabsLayout() {
  useCloudSessionGuard();
  const { instance } = useAuth();
  const isCloud = instance?.mode === 'cloud';
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Tabs
      initialRouteName={isCloud ? 'employees/index' : 'chat/index'}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: keyboardOpen ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE,
        tabBarActiveTintColor: colors.tealLight,
        tabBarInactiveTintColor: colors.silverMid,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      {/* Aiva cloud primary tabs */}
      <Tabs.Screen
        name="employees/index"
        options={{
          title: 'Workers',
          href: isCloud ? undefined : null,
          tabBarIcon: tabIcon('people-outline'),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: isCloud ? undefined : null,
          tabBarIcon: tabIcon('mail-outline'),
        }}
      />
      <Tabs.Screen
        name="hire/index"
        options={{
          title: 'Hire',
          href: isCloud ? undefined : null,
          tabBarIcon: tabIcon('person-add-outline'),
        }}
      />

      {/* Carina companion primary tabs (self-hosted) */}
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Chat',
          href: isCloud ? null : undefined,
          tabBarIcon: tabIcon('chatbubble-ellipses-outline'),
        }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{
          title: 'Tasks',
          href: isCloud ? null : undefined,
          tabBarIcon: tabIcon('checkmark-done-outline'),
        }}
      />
      <Tabs.Screen
        name="trust/index"
        options={{
          title: 'Trust',
          href: isCloud ? null : undefined,
          tabBarIcon: tabIcon('shield-checkmark-outline'),
        }}
      />

      <Tabs.Screen
        name="more/index"
        options={{
          title: isCloud ? 'Settings' : 'More',
          tabBarIcon: tabIcon('settings-outline'),
        }}
      />

      {/* Reachable but not in the tab bar */}
      <Tabs.Screen name="home/index" options={{ href: null }} />
    </Tabs>
  );
}
