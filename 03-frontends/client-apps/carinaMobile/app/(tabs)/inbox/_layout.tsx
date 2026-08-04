import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function InboxStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
      }}
    />
  );
}
