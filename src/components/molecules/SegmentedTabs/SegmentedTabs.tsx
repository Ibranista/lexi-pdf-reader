import type { StyleProp, ViewStyle } from "react-native";

import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme";

import { Box, Text } from "@/components/atoms";

type SegmentedTabsProps = {
  readonly activeBg?: string;
  readonly activeTextColor?: string;
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly onChange: (id: string) => void;
  readonly options: SegmentOption[];
  readonly tabStyle?: StyleProp<ViewStyle>;
  readonly value: string;
};

type SegmentOption = {
  readonly id: string;
  readonly label: string;
};

const TAB_HEIGHT = 40;

function SegmentedTabs({
  activeBg,
  activeTextColor,
  containerStyle,
  onChange,
  options,
  tabStyle,
  value,
}: SegmentedTabsProps) {
  const { colors } = useTheme();

  return (
    <Box
      style={[
        styles.container,
        { backgroundColor: colors.neutral[50] },
        containerStyle,
      ]}
    >
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              onChange(option.id);
            }}
            style={[
              styles.tab,
              tabStyle,
              {
                backgroundColor: isActive
                  ? (activeBg ?? colors.shades.white)
                  : "transparent",
                borderColor: isActive
                  ? (activeBg ?? colors.neutral[200])
                  : "transparent",
              },
            ]}
          >
            <Text
              color={
                isActive ? (activeTextColor ?? "neutral.900") : "neutral.500"
              }
              variant="label-medium/600"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  tab: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: TAB_HEIGHT,
    justifyContent: "center",
  },
});

export type { SegmentedTabsProps, SegmentOption };
export default SegmentedTabs;
