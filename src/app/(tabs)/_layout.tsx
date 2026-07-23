import { Stack } from "expo-router";

import { Box } from "@/components/atoms";
import { Toast } from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

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
        {/* The library screen shows Settings as a left drawer; this route is
            the deep-link fallback, so it still enters from the left to match. */}
        <Stack.Screen
          name="settings"
          options={{ animation: "ios_from_left" }}
        />
        <Stack.Screen name="today" />
        <Stack.Screen name="reader" />
        <Stack.Screen name="pdf" />
        <Stack.Screen name="text" />
        <Stack.Screen name="notes" />
        <Stack.Screen name="review" />
        <Stack.Screen name="graph" />
        <Stack.Screen name="plan" />
        <Stack.Screen name="reading-comfort" />
        <Stack.Screen name="ai-focus" />
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      </Stack>
      <Toast />
    </Box>
  );
}
