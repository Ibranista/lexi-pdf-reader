import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import "@/i18n";
import { ensureSession } from "@/services/device-session";
import { queryClient } from "@/services/query-client";
import { syncOnboarding, useOnboardingStore } from "@/stores/onboarding-store";
import { ThemeProvider as AppThemeProvider } from "@/theme";
import { fontAssets } from "@/theme/app-fonts";
import { useThemeModeStore } from "@/theme/proto";
import { storage } from "@/utils/storage";
import { useFonts } from "expo-font";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts(fontAssets);

  const colorScheme = useColorScheme();
  const mode = useThemeModeStore((s) => s.mode);
  const hasCompletedOnboarding = useOnboardingStore(
    (s) => s.hasCompletedOnboarding,
  );

  const dark = mode === "dark" || (mode === "auto" && colorScheme === "dark");

  useEffect(() => {
    void (async () => {
      try {
        await ensureSession();
      } catch {}
      await syncOnboarding();
    })();
  }, []);

  if (!loaded) return null;

  const onRootLayout = () => {
    void SplashScreen.hideAsync();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onRootLayout}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <AppThemeProvider storage={storage}>
            <ThemeProvider value={dark ? DarkTheme : (DefaultTheme as any)}>
              <BottomSheetModalProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Protected guard={hasCompletedOnboarding}>
                    <Stack.Screen name="(tabs)" />
                  </Stack.Protected>
                  <Stack.Protected guard={!hasCompletedOnboarding}>
                    <Stack.Screen name="onboarding" />
                  </Stack.Protected>
                  <Stack.Screen name="login" />
                </Stack>
              </BottomSheetModalProvider>
            </ThemeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
