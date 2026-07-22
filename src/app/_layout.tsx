import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import "@/i18n";
import { useOnboardingStore } from "@/stores/onboarding-store";
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

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppThemeProvider storage={storage}>
          <ThemeProvider value={dark ? DarkTheme : (DefaultTheme as any)}>
            <BottomSheetModalProvider>
              <AnimatedSplashOverlay />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Protected guard={hasCompletedOnboarding}>
                  <Stack.Screen name="(tabs)" />
                </Stack.Protected>
                <Stack.Protected guard={!hasCompletedOnboarding}>
                  <Stack.Screen name="onboarding" />
                </Stack.Protected>
              </Stack>
            </BottomSheetModalProvider>
          </ThemeProvider>
        </AppThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
