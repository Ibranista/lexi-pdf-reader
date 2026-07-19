import { Stack } from "expo-router";
import { useEffect } from "react";
import { InteractionManager } from "react-native";

import { Box } from "@/components/atoms";
import { prewarmBrainAssets } from "@/components/brain/BrainCanvas";
import { Toast } from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

export default function TabLayout() {
  const t = useProtoTheme();

  // Build the 3D brain scene during app idle so the Brain Progress screen
  // opens instantly instead of constructing ~17k vertices on entry.
  useEffect(() => {
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        prewarmBrainAssets();
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
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
        <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      </Stack>
      <Toast />
    </Box>
  );
}
