import type { StyleProp, ViewStyle } from "react-native";

import { Pressable, StyleSheet } from "react-native";

import { Box, Text } from "@/components/atoms";
import type { TextColor } from "@/components/atoms";

type InfoCardProps = {
  readonly title: string;
  readonly description: string;
  readonly titleColor?: TextColor;
  readonly descriptionColor?: TextColor;
  readonly onPressDescription?: () => void;
  readonly style?: StyleProp<ViewStyle>;
};

function InfoCard({
  title,
  description,
  titleColor = "dark.60",
  descriptionColor = "dark.100",
  onPressDescription,
  style,
}: InfoCardProps) {
  return (
    <Box style={[styles.card, style]}>
      <Text size="xs" color={titleColor}>
        {title}
      </Text>

      {onPressDescription ? (
        <Pressable onPress={onPressDescription}>
          <Text
            size="xs"
            weight="semibold"
            color={descriptionColor}
            style={styles.description}
          >
            {description}
          </Text>
        </Pressable>
      ) : (
        <Text
          size="xs"
          weight="semibold"
          color={descriptionColor}
          style={styles.description}
        >
          {description}
        </Text>
      )}
    </Box>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderColor: "#ECECEC",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  description: {
    marginTop: 6,
  },
});

export type { InfoCardProps };
export default InfoCard;
