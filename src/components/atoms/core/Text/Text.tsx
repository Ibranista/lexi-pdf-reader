import type { TextProps as RNTextProps, TextStyle } from "react-native";

import { useMemo } from "react";

import { useTheme } from "@/theme";
import type { Theme } from "@/theme/types/theme";
import type { TypographyVariant } from "@/theme/typography";

import styled from "../styled";

type LegacyColorToken =
  | "gray100"
  | "gray200"
  | "gray400"
  | "gray50"
  | "gray800"
  | "purple100"
  | "purple50"
  | "purple500"
  | "red500";
type ScaleToken =
  `${Exclude<keyof Theme["colors"], "shades">}.${keyof Theme["colors"]["neutral"]}`;

type TextAlign = "center" | "justify" | "left" | "right";
type TextColor = ({} & string) | LegacyColorToken | ScaleToken;
type TextType = "body" | "title";
type TextProps = {
  readonly align?: TextAlign;
  readonly color?: TextColor;
  readonly margin?: number;
  readonly marginBottom?: number;
  readonly marginLeft?: number;
  readonly marginRight?: number;
  readonly marginTop?: number;
  readonly marginX?: number;
  readonly marginY?: number;
  readonly [key: string]: unknown;
  readonly size?: TextSize;
  readonly type?: TextType;
  readonly variant?: TypographyVariant;
  readonly weight?: TextWeight;
} & RNTextProps;
type TextSize = "14" | "18" | "37" | "lg" | "md" | "sm" | "xl" | "mdXl" | "xs";
type TextWeight = "bold" | "medium" | "regular" | "semibold" | "extraBold";

const BaseText = styled.Text``;

const sizeMap = {
  "14": "size_14",
  "37": "size_37",
  "18": "size_18",
  lg: "size_32",
  md: "size_24",
  sm: "size_16",
  xl: "size_40",
  mdXl: "size_44",
  xs: "size_12",
} as const;

const weightMap: Record<TextWeight, TextStyle["fontWeight"]> = {
  bold: "700",
  medium: "500",
  regular: "400",
  semibold: "600",
  extraBold: "800",
};

const bodyFontMap: Record<string, string> = {
  "400": "Manrope-Regular",
  "500": "Manrope-Medium",
  "600": "Manrope-SemiBold",
  "700": "Manrope-Bold",
  "800": "Manrope-ExtraBold",
  bold: "Manrope-Bold",
  normal: "Manrope-Regular",
};

const titleFontMap: Record<string, string> = {
  "400": "NeueHaasDisplayRoman",
  "500": "NeueHaasDisplayMedium",
  "600": "NeueHaasDisplayBold",
  "700": "NeueHaasDisplayBold",
  "800": "NeueHaasDisplayBlack",
  bold: "NeueHaasDisplayBold",
  normal: "NeueHaasDisplayRoman",
};

const resolveFontFamily = (
  type: TextType,
  fontWeight?: TextStyle["fontWeight"],
) => {
  if (!fontWeight) {
    return type === "title" ? titleFontMap["400"] : bodyFontMap["400"];
  }

  const fontMap = type === "title" ? titleFontMap : bodyFontMap;
  return fontMap[String(fontWeight)] ?? fontMap["400"];
};

const resolveColor = (colors: Theme["colors"], value?: TextColor) => {
  if (!value) {
    return undefined;
  }

  const legacyMap: Record<LegacyColorToken, string> = {
    gray100: colors.neutral[200],
    gray200: colors.neutral[500],
    gray400: colors.neutral[700],
    gray50: colors.neutral[50],
    gray800: colors.neutral[900],
    purple100: colors.primary[100],
    purple50: colors.dark[100],
    purple500: colors.primary[200],
    red500: colors.error[500],
  };

  if (value in legacyMap) {
    return legacyMap[value as LegacyColorToken];
  }

  const [group, shade] = value.split(".", 2);
  if (group && shade) {
    if (group === "shades") {
      return colors.shades[shade as keyof Theme["colors"]["shades"]];
    }

    const scale = colors[group as Exclude<keyof Theme["colors"], "shades">];
    if (typeof scale === "object" && shade in scale) {
      return (scale as Record<string, string>)[shade];
    }
  }

  return value;
};

function Text({
  align = undefined,
  color = "neutral.900",
  margin = undefined,
  marginBottom = undefined,
  marginLeft = undefined,
  marginRight = undefined,
  marginTop = undefined,
  marginX = undefined,
  marginY = undefined,
  size = "md",
  style = undefined,
  type = "body",
  variant = undefined,
  weight = "regular",
  ...props
}: TextProps) {
  const { colors, fonts, typography } = useTheme();

  const resolvedColor = useMemo(
    () => resolveColor(colors, color),
    [colors, color],
  );

  const sizeStyle = fonts[sizeMap[size] as keyof typeof fonts];
  const typographyStyle = variant ? typography[variant] : undefined;
  const resolvedFontWeight = variant
    ? typographyStyle?.fontWeight
    : weightMap[weight];
  const resolvedFontFamily = resolveFontFamily(type, resolvedFontWeight);

  return (
    <BaseText
      style={[
        variant ? typographyStyle : sizeStyle,
        resolvedColor ? { color: resolvedColor } : undefined,
        variant ? undefined : { fontWeight: weightMap[weight] },
        { fontFamily: resolvedFontFamily },
        align ? { textAlign: align } : undefined,
        margin === undefined ? undefined : { margin },
        marginX === undefined
          ? undefined
          : { marginLeft: marginX, marginRight: marginX },
        marginY === undefined
          ? undefined
          : { marginBottom: marginY, marginTop: marginY },
        marginTop === undefined ? undefined : { marginTop },
        marginRight === undefined ? undefined : { marginRight },
        marginBottom === undefined ? undefined : { marginBottom },
        marginLeft === undefined ? undefined : { marginLeft },
        style,
      ]}
      {...props}
    />
  );
}

export type { TextAlign, TextColor, TextProps, TextSize, TextWeight };
export { Text };
export default Text;
