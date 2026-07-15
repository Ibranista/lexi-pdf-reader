import type {
  TextInputProps as RNTextInputProps,
  TextStyle,
} from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/types/theme';
import type { TypographyVariant } from '@/theme/typography';

import styled from '../styled';

type LegacyColorToken =
  | 'gray100'
  | 'gray200'
  | 'gray400'
  | 'gray50'
  | 'gray800'
  | 'purple100'
  | 'purple50'
  | 'purple500'
  | 'red500';
type ScaleToken =
  `${Exclude<keyof Theme['colors'], 'shades'>}.${keyof Theme['colors']['neutral']}`;

type ShadesToken = `shades.${keyof Theme['colors']['shades']}`;

type StyledProps = {
  $disabled?: boolean;
};

type TextColor = ({} & string) | LegacyColorToken | ScaleToken | ShadesToken;

type TextInputProps = {
  readonly backgroundColor?: TextColor;
  readonly borderColor?: TextColor;
  readonly borderWidth?: number;
  readonly fontSize?: number;
  readonly height?: number;
  readonly maxHeight?: number;
  readonly maxWidth?: number;
  readonly minHeight?: number;
  readonly minWidth?: number;
  readonly p?: number;
  readonly pb?: number;
  readonly pl?: number;
  readonly placeholderTextColor?: TextColor;
  readonly pr?: number;
  readonly pt?: number;
  readonly px?: number;
  readonly py?: number;
  readonly [key: string]: unknown;
  readonly rounded?: TextInputRadius;
  readonly roundedBottomLeft?: number;
  readonly roundedBottomRight?: number;
  readonly roundedTopLeft?: number;
  readonly roundedTopRight?: number;
  readonly size?: TextInputSize;
  readonly textColor?: TextColor;
  readonly textVariant?: TypographyVariant;
  readonly variant?: TextInputVariant;
  readonly width?: number;
} & RNTextInputProps;

type TextInputRadius = number | TextInputRadiusSize;
type TextInputRadiusSize = 'full' | 'lg' | 'md' | 'sm' | 'xl';
type TextInputSize = 'lg' | 'md' | 'sm';
type TextInputVariant = 'default' | 'error' | 'filled' | 'outlined';

const BaseInput = styled.TextInput<StyledProps>`
  border-width: 1px;
  opacity: ${({ $disabled }) => ($disabled ? DISABLED_OPACITY : 1)};
`;

const DISABLED_OPACITY = 0.6;

const sizeStyles: Record<TextInputSize, TextStyle> = {
  lg: {
    fontSize: 18,
    height: 56,
    paddingHorizontal: 12,
  },
  md: {
    fontSize: 16,
    height: 48,
    paddingHorizontal: 12,
  },
  sm: {
    fontSize: 14,
    height: 40,
    paddingHorizontal: 12,
  },
};

const radiusBySize: Record<TextInputRadiusSize, number> = {
  full: 9999,
  lg: 12,
  md: 8,
  sm: 6,
  xl: 16,
};

const resolveColor = (colors: Theme['colors'], value?: TextColor) => {
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
    purple50: colors.dark[900],
    purple500: colors.primary[500],
    red500: colors.error[500],
  };

  if (value in legacyMap) {
    return legacyMap[value as LegacyColorToken];
  }

  const [group, shade] = value.split('.', 2);
  if (group && shade) {
    if (group === 'shades') {
      return colors.shades[shade as keyof Theme['colors']['shades']];
    }

    const scale = colors[group as Exclude<keyof Theme['colors'], 'shades'>];
    if (typeof scale === 'object' && shade in scale) {
      return (scale as Record<string, string>)[shade];
    }
  }

  return value;
};

function TextInput({
  backgroundColor = undefined,
  borderColor = undefined,
  borderWidth = undefined,
  editable = true,
  fontSize = undefined,
  height = undefined,
  maxHeight = undefined,
  maxWidth = undefined,
  minHeight = undefined,
  minWidth = undefined,
  p = undefined,
  pb = undefined,
  pl = 16,
  placeholderTextColor = undefined,
  pr = undefined,
  pt = undefined,
  px = undefined,
  py = 12,
  rounded = undefined,
  roundedBottomLeft = undefined,
  roundedBottomRight = undefined,
  roundedTopLeft = undefined,
  roundedTopRight = undefined,
  size = 'md',
  style = undefined,
  textColor = undefined,
  textVariant = undefined,
  variant = 'default',
  width = undefined,
  ...props
}: TextInputProps) {
  const { colors, typography } = useTheme();

  const resolvedRadius =
    rounded === undefined
      ? radiusBySize.md
      : typeof rounded === 'number'
        ? rounded
        : radiusBySize[rounded];

  const variantStyles = (() => {
    switch (variant) {
      case 'error': {
        return {
          backgroundColor: colors.neutral[50],
          borderColor: colors.error[500],
          color: colors.neutral[900],
          placeholderTextColor: colors.error[500],
        };
      }
      case 'filled': {
        return {
          backgroundColor: colors.neutral[50],
          borderColor: colors.neutral[50],
          color: colors.neutral[900],
          placeholderTextColor: colors.neutral[500],
        };
      }
      case 'outlined': {
        return {
          backgroundColor: 'transparent',
          borderColor: colors.neutral[200],
          color: colors.neutral[900],
          placeholderTextColor: colors.neutral[500],
        };
      }
      default: {
        return {
          backgroundColor: 'transparent',
          borderColor: colors.neutral[200],
          color: colors.neutral[900],
          placeholderTextColor: colors.neutral[500],
        };
      }
    }
  })();

  const resolvedBackgroundColor =
    resolveColor(colors, backgroundColor) ?? variantStyles.backgroundColor;
  const resolvedBorderColor =
    resolveColor(colors, borderColor) ?? variantStyles.borderColor;
  const resolvedTextColor =
    resolveColor(colors, textColor) ?? variantStyles.color;
  const resolvedPlaceholderTextColor =
    resolveColor(colors, placeholderTextColor) ??
    variantStyles.placeholderTextColor;

  const resolvedPaddingHorizontal =
    px ?? p ?? sizeStyles[size].paddingHorizontal;
  const resolvedPaddingVertical = py;

  return (
    <BaseInput
      $disabled={!editable}
      editable={editable}
      placeholderTextColor={resolvedPlaceholderTextColor}
      style={[
        sizeStyles[size],
        textVariant ? typography[textVariant] : undefined,
        {
          backgroundColor: resolvedBackgroundColor,
          borderBottomLeftRadius: roundedBottomLeft,
          borderBottomRightRadius: roundedBottomRight,
          borderColor: resolvedBorderColor,
          borderRadius: resolvedRadius,
          borderTopLeftRadius: roundedTopLeft,
          borderTopRightRadius: roundedTopRight,
          borderWidth,
          color: resolvedTextColor,
          fontSize,
          height,
          maxHeight,
          maxWidth,
          minHeight,
          minWidth,
          paddingBottom: pb,
          paddingHorizontal: resolvedPaddingHorizontal,
          paddingLeft: pl,
          paddingRight: pr,
          paddingTop: pt,
          paddingVertical: resolvedPaddingVertical,
          width,
        },
        style,
      ]}
      {...props}
    />
  );
}

export type { TextInputProps, TextInputSize, TextInputVariant };
export { TextInput };
export default TextInput;
