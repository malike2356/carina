import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useCloudSessionGuard } from '@/hooks/useCloudSessionGuard';
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
      initialRouteName="chat/index"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: keyboardOpen ? TAB_BAR_HIDDEN : TAB_BAR_VISIBLE,
        tabBarActiveTintColor: colors.tealLight,
        tabBarInactiveTintColor: colors.silverMid,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen
        name="chat/index"
        options={{ title: 'Chat', tabBarIcon: tabIcon('chatbubble-ellipses-outline') }}
      />
      <Tabs.Screen
        name="tasks/index"
        options={{ title: 'Tasks', tabBarIcon: tabIcon('checkmark-done-outline') }}
      />
      <Tabs.Screen
        name="trust/index"
        options={{ title: 'Trust', tabBarIcon: tabIcon('shield-checkmark-outline') }}
      />
      <Tabs.Screen
        name="more/index"
        options={{ title: 'More', tabBarIcon: tabIcon('settings-outline') }}
      />
    </Tabs>
  );
}
