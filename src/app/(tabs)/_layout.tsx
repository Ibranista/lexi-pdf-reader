import { Stack } from 'expo-router';

import { Box } from '@/components/atoms';
import { Toast } from '@/components/proto';
import { useProtoTheme } from '@/theme/proto';

export default function TabLayout() {
  const t = useProtoTheme();
  return (
    <Box flex={1}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="today" />
        <Stack.Screen name="brain" />
        <Stack.Screen name="reader" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="review" />
        <Stack.Screen name="graph" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="reading-comfort" />
        <Stack.Screen name="ai-focus" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      </Stack>
      <Toast />
    </Box>
  );
}
