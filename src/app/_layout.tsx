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
import { startSync } from "@/services/sync";
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

  // Register this install and get it a session (anonymous until someone signs
  // in), so the first word looked up isn't the request that has to wait for it.
  // The axios interceptor does this too — this only moves the cost off the
  // reader's first tap. Failures are ignored: it retries on the next request.
  //
  // Then reconcile onboarding with the server, which is what decides the guard
  // below. The guard itself reads the local mirror, so this never blocks the
  // first paint — offline it simply doesn't land, and the store retries.
  useEffect(() => {
    void (async () => {
      try {
        await ensureSession();
      } catch {
        // Offline on first launch; syncOnboarding retries the session too.
      }
      await syncOnboarding();
    })();
  }, []);

  // Highlights and notes are written locally and rendered from there; this only
  // carries them to the server and folds back what other devices did. It starts
  // here rather than at module load so the persisted stores are already read.
  useEffect(() => startSync(), []);

  if (!loaded) return null;

  // Hides the native splash (the static logo from app.json) only once this
  // root view has actually been laid out on screen — hiding it any earlier
  // (e.g. from an effect keyed on `loaded`) can win a race against the GPU
  // paint and flash the window's default white background for a frame.
  const onRootLayout = () => {
    void SplashScreen.hideAsync();
  };

  return (
    // gesture root + modal provider are required by @gorhom/bottom-sheet;
    // KeyboardProvider backs react-native-keyboard-controller, which is how
    // anything anchored above the keyboard tracks it — Android runs
    // edge-to-edge, so the window no longer resizes and RN's own
    // KeyboardAvoidingView has nothing to react to.
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onRootLayout}>
      {/* Every network call goes through react-query over the axios instance,
          so caching and retries are decided in one place and the interceptors
          keep owning tokens. */}
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
                  {/* Outside both guards: signing in is reachable from
                      Settings, from the AI wall, and from the axios
                      interceptor when a token refresh finally fails. */}
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
