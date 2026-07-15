import type {
  TextAlign,
  TextColor,
  TextProps,
  TextSize,
  TextWeight,
} from "../Text";
import type { ReactNode } from "react";
import type {
  PressableProps,
  PressableStateCallbackType,
  ViewStyle,
} from "react-native";

import { MaterialIcons } from "@react-native-vector-icons/material-icons";
import { ActivityIndicator } from "react-native";

import { useTheme } from "@/theme";
import type { Theme } from "@/theme/types/theme";

import styled from "../styled";
import { Text } from "../Text";

type ButtonProps = {
  readonly align?: ViewStyle["alignItems"];
  readonly alignSelf?: ViewStyle["alignSelf"];
  readonly backgroundColor?: TextColor;
  readonly borderColor?: TextColor;
  readonly borderWidth?: number;
  readonly children?: ReactNode;
  readonly flex?: ViewStyle["flex"];
  readonly flexBasis?: ViewStyle["flexBasis"];
  readonly flexGrow?: ViewStyle["flexGrow"];
  readonly flexShrink?: ViewStyle["flexShrink"];
  readonly gap?: number;
  readonly height?: number;
  readonly justify?: ViewStyle["justifyContent"];
  readonly leftAdornment?: ReactNode;
  readonly loading?: boolean;
  readonly maxHeight?: number;
  readonly maxWidth?: number;
  readonly minHeight?: number;
  readonly minWidth?: number;
  readonly px?: number;
  readonly py?: number;
  readonly rightAdornment?: ReactNode;
  readonly rounded?: ButtonRadius;
  readonly size?: ButtonSize;
  readonly textAlign?: TextAlign;
  readonly textColor?: TextColor;
  readonly textProps?: Omit<TextProps, "children">;
  readonly textSize?: TextSize;
  readonly textVariant?: TextProps["variant"];
  readonly textWeight?: TextWeight;
  readonly title?: string;
  readonly variant?: ButtonVariant;
  readonly width?: number;
} & PressableProps;
type ButtonRadius = ButtonRadiusSize | number;

type ButtonRadiusSize = "lg" | "md" | "sm" | "xl";

type ButtonSize = "lg" | "md" | "sm" | "xl";
type ButtonVariant = "danger" | "ghost" | "outline" | "primary" | "secondary";

type StyledProps = {
  $disabled?: boolean;
};

const ButtonContainer = styled.Pressable<StyledProps>`
  align-items: center;
  justify-content: center;
  flex-direction: row;
  opacity: ${({ $disabled }) => ($disabled ? DISABLED_OPACITY : 1)};
`;

const DISABLED_OPACITY = 0.6;
const PRESSED_OPACITY = 0.85;

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  lg: {
    height: 52,
    paddingHorizontal: 20,
  },
  md: {
    height: 44,
    paddingHorizontal: 16,
  },
  sm: {
    height: 36,
    paddingHorizontal: 12,
  },
  xl: {
    height: 60,
    paddingHorizontal: 24,
  },
};

const textSizeByButton: Record<ButtonSize, "md" | "sm" | "xs"> = {
  lg: "sm",
  md: "sm",
  sm: "xs",
  xl: "md",
};

const radiusBySize: Record<ButtonRadiusSize, number> = {
  lg: 16,
  md: 12,
  sm: 8,
  xl: 100,
};

type Properties = {
  readonly checked: boolean;
  readonly color?: string;
  readonly colorVariant?: TextColor;
  readonly size?: number;
  readonly uncheckedColor?: string;
  readonly uncheckedColorVariant?: TextColor;
};

const resolveColor = (colors: Theme["colors"], value?: TextColor) => {
  if (!value) {
    return undefined;
  }

  const legacyMap: Record<string, string> = {
    gray100: colors.neutral[200],
    gray200: colors.neutral[500],
    gray400: colors.neutral[700],
    gray50: colors.neutral[50],
    gray800: colors.neutral[900],
    purple100: colors.primary[100],
    purple50: colors.dark[900],
    purple500: colors.primary[500],
    red500: colors.error[500],
  };

  if (value in legacyMap) {
    return legacyMap[value as keyof typeof legacyMap];
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

function Button({
  align = "center",
  alignSelf = undefined,
  backgroundColor = undefined,
  borderColor = undefined,
  borderWidth = undefined,
  children = undefined,
  disabled = undefined,
  flex = undefined,
  flexBasis = undefined,
  flexGrow = undefined,
  flexShrink = undefined,
  gap = undefined,
  height = undefined,
  justify = "space-around",
  leftAdornment = undefined,
  loading = false,
  maxHeight = undefined,
  maxWidth = undefined,
  minHeight = undefined,
  minWidth = undefined,
  px = undefined,
  py = undefined,
  rightAdornment = undefined,
  rounded = undefined,
  size = undefined,
  style = undefined,
  textAlign = undefined,
  textColor = undefined,
  textProps = undefined,
  textSize = undefined,
  textVariant = undefined,
  textWeight = undefined,
  title = undefined,
  variant = "primary",
  width = undefined,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const content = children ?? title;
  if (!content) {
    return undefined;
  }

  const isDisabled = (disabled ?? false) ? true : loading;
  const resolvedSize =
    variant === "primary" && size === undefined ? "xl" : (size ?? "md");
  const resolvedHeight = height ?? sizeStyles[resolvedSize].height;
  const resolvedRadius =
    rounded === undefined
      ? variant === "primary"
        ? radiusBySize.xl
        : radiusBySize.sm
      : typeof rounded === "number"
        ? rounded
        : radiusBySize[rounded];
  const variantStyles = (() => {
    switch (variant) {
      case "danger": {
        return {
          backgroundColor: colors.error[500],
          borderColor: colors.error[500],
          textColor: colors.shades.white,
        };
      }
      case "ghost": {
        return {
          backgroundColor: "transparent",
          borderColor: "transparent",
          textColor: colors.neutral[900],
        };
      }
      case "outline": {
        return {
          backgroundColor: "transparent",
          borderColor: colors.primary[500],
          textColor: colors.primary[500],
        };
      }
      case "secondary": {
        return {
          backgroundColor: colors.neutral[100],
          borderColor: colors.neutral[200],
          textColor: colors.neutral[900],
        };
      }
      default: {
        return {
          backgroundColor: colors.primary[500],
          borderColor: colors.primary[500],
          textColor: colors.shades.white,
        };
      }
    }
  })();

  const resolvedBackgroundColor =
    resolveColor(colors, backgroundColor) ?? variantStyles.backgroundColor;
  const resolvedBorderColor =
    resolveColor(colors, borderColor) ?? variantStyles.borderColor;

  const resolveStyle = ({ pressed }: PressableStateCallbackType) => {
    const pressedStyle =
      pressed && !isDisabled ? { opacity: PRESSED_OPACITY } : undefined;
    const userStyle = typeof style === "function" ? style({ pressed }) : style;

    return [
      sizeStyles[resolvedSize],
      {
        alignItems: align,
        alignSelf,
        backgroundColor: resolvedBackgroundColor,
        borderColor: resolvedBorderColor,
        borderRadius: resolvedRadius,
        borderWidth: borderWidth ?? (variant === "outline" ? 1 : 0),
        flex,
        flexBasis,
        flexGrow,
        flexShrink,
        gap,
        height: resolvedHeight,
        justifyContent: justify,
        maxHeight,
        maxWidth,
        minHeight,
        minWidth,
        paddingHorizontal: px ?? sizeStyles[resolvedSize].paddingHorizontal,
        paddingVertical: py,
        width,
      },
      pressedStyle,
      userStyle,
    ];
  };

  return (
    <ButtonContainer
      $disabled={isDisabled}
      disabled={isDisabled}
      style={resolveStyle}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.textColor} />
      ) : (
        <>
          {leftAdornment}
          <Text
            {...textProps}
            align={textAlign ?? (textProps?.align as TextAlign | undefined)}
            color={
              textColor ??
              (textProps?.color as TextColor | undefined) ??
              variantStyles.textColor
            }
            size={
              textSize ??
              (textProps?.size as TextSize | undefined) ??
              textSizeByButton[resolvedSize]
            }
            variant={
              textVariant ??
              (textProps?.variant as TextProps["variant"] | undefined)
            }
            weight={textWeight ?? (textProps?.weight as TextWeight | undefined)}
          >
            {content}
          </Text>
          {rightAdornment}
        </>
      )}
    </ButtonContainer>
  );
}

function CheckboxIcon({
  checked,
  color = "#22C55E",
  colorVariant = undefined,
  size = 20,
  uncheckedColor = "#9CA3AF",
  uncheckedColorVariant = undefined,
}: Properties) {
  const { colors } = useTheme();
  const resolvedChecked = resolveColor(colors, colorVariant) ?? color;
  const resolvedUnchecked =
    resolveColor(colors, uncheckedColorVariant) ?? uncheckedColor;

  return (
    <MaterialIcons
      color={checked ? resolvedChecked : resolvedUnchecked}
      name={checked ? "check-box" : "check-box-outline-blank"}
      size={size}
    />
  );
}

export type { ButtonProps, ButtonSize, ButtonVariant };
export { Button, CheckboxIcon };
export default Button;
