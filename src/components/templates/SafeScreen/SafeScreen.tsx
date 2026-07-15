import type { PropsWithChildren } from "react";
import type { SafeAreaViewProps } from "react-native-safe-area-context";

import { StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme";

import { DefaultError } from "@/components/molecules";
import { ErrorBoundary } from "@/components/organisms";
import { colors } from "@/theme/colors";

type Properties = PropsWithChildren<
  {
    readonly isError?: boolean;
    readonly onResetError?: () => void;
  } & Omit<SafeAreaViewProps, "mode">
>;

function SafeScreen({
  children = undefined,
  isError = false,
  onResetError = undefined,
  style,
  ...props
}: Properties) {
  const { layout, navigationTheme, variant } = useTheme();

  return (
    <SafeAreaView
      {...props}
      edges={["top", "left", "right", "bottom"]}
      mode="padding"
      style={[{ backgroundColor: colors.neutral[250] }, layout.flex_1, style]}
    >
      <StatusBar
        backgroundColor={navigationTheme.colors.background}
        barStyle={variant === "dark" ? "light-content" : "dark-content"}
      />
      <ErrorBoundary onReset={onResetError} fallback={() => <></>}>
        {isError ? <DefaultError onReset={onResetError} /> : children}
      </ErrorBoundary>
    </SafeAreaView>
  );
}

export default SafeScreen;
