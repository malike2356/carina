import { Tabs } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.inkMid,
          borderTopColor: colors.borderDim,
        },
        tabBarActiveTintColor: colors.tealLight,
        tabBarInactiveTintColor: colors.silverMid,
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      <Tabs.Screen name="chat/index" options={{ title: 'Chat' }} />
      <Tabs.Screen name="tasks/index" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="trust/index" options={{ title: 'Trust' }} />
      <Tabs.Screen name="more/index" options={{ title: 'More' }} />
    </Tabs>
  );
}
