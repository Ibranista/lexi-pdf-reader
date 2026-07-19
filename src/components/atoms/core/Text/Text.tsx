import type { TextProps as RNTextProps } from 'react-native';

import { useMemo } from 'react';
import { Text as RNText } from 'react-native';

import type { FontWeight } from '@/theme/app-fonts';
import type { Theme } from '@/theme/types/theme';
import type { TypographyVariant } from '@/theme/typography';

import {
  monoFamily,
  sansFamily,
  serifFamily,
  serifItalicFamily,
} from '@/theme/app-fonts';
import { useTheme } from '@/theme';
import { useProtoTheme } from '@/theme/proto';
import { typography } from '@/theme/typography';

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

type TextAlign = 'center' | 'justify' | 'left' | 'right';
type TextColor = ({} & string) | LegacyColorToken | ScaleToken;
type TextSize =
  | number
  | '14'
  | '18'
  | '37'
  | 'lg'
  | 'md'
  | 'mdXl'
  | 'sm'
  | 'xl'
  | 'xs';
type TextType = 'body' | 'title';
type TextWeight =
  | FontWeight
  | 'bold'
  | 'extraBold'
  | 'light'
  | 'medium'
  | 'regular'
  | 'semibold';

type TextProps = {
  readonly align?: TextAlign;
  /** Token ("neutral.900") or raw color value; defaults to the theme ink. */
  readonly color?: TextColor;
  readonly italic?: boolean;
  /** lineHeight */
  readonly lh?: number;
  /** letterSpacing */
  readonly ls?: number;
  readonly margin?: number;
  readonly marginBottom?: number;
  readonly marginLeft?: number;
  readonly marginRight?: number;
  readonly marginTop?: number;
  readonly marginX?: number;
  readonly marginY?: number;
  readonly mono?: boolean;
  readonly serif?: boolean;
  readonly size?: TextSize;
  /** `title` renders in the display serif (Literata); `body` in Manrope. */
  readonly type?: TextType;
  readonly upper?: boolean;
  readonly variant?: TypographyVariant;
  readonly weight?: TextWeight;
} & RNTextProps;

const sizeMap: Record<Exclude<TextSize, number>, number> = {
  '14': 14,
  '18': 18,
  '37': 37,
  lg: 32,
  md: 24,
  mdXl: 44,
  sm: 16,
  xl: 40,
  xs: 12,
};

const namedWeightMap: Record<string, FontWeight> = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extraBold: '800',
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
    purple50: colors.dark[100],
    purple500: colors.primary[200],
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

function Text({
  align = undefined,
  color = undefined,
  italic = undefined,
  lh = undefined,
  ls = undefined,
  margin = undefined,
  marginBottom = undefined,
  marginLeft = undefined,
  marginRight = undefined,
  marginTop = undefined,
  marginX = undefined,
  marginY = undefined,
  mono = undefined,
  serif = undefined,
  size = 14,
  style = undefined,
  type = 'body',
  upper = undefined,
  variant = undefined,
  weight = '400',
  ...props
}: TextProps) {
  const t = useProtoTheme();
  const { colors } = useTheme();

  const resolvedColor = useMemo(
    () => resolveColor(colors, color),
    [colors, color],
  );

  const typographyStyle = variant ? typography[variant] : undefined;
  const fontWeight: FontWeight = variant
    ? ((typographyStyle?.fontWeight as FontWeight | undefined) ?? '400')
    : (namedWeightMap[weight] ?? (weight as FontWeight));

  const isSerif = serif ?? type === 'title';
  const fontFamily = isSerif
    ? italic
      ? serifItalicFamily
      : serifFamily
    : mono
      ? monoFamily
      : sansFamily[fontWeight];

  return (
    <RNText
      style={[
        variant
          ? typographyStyle
          : { fontSize: typeof size === 'number' ? size : sizeMap[size] },
        {
          color: resolvedColor ?? t.ink,
          fontFamily,
          // Manrope bakes the weight into the per-weight family; the Literata
          // variable font needs fontWeight for platforms that synthesize it.
          ...(isSerif || mono ? { fontWeight } : {}),
          ...(italic && !isSerif ? { fontStyle: 'italic' as const } : {}),
          ...(lh === undefined ? {} : { lineHeight: lh }),
          ...(ls === undefined ? {} : { letterSpacing: ls }),
          ...(align ? { textAlign: align } : {}),
          ...(upper ? { textTransform: 'uppercase' as const } : {}),
          ...(margin === undefined ? {} : { margin }),
          ...(marginX === undefined
            ? {}
            : { marginLeft: marginX, marginRight: marginX }),
          ...(marginY === undefined
            ? {}
            : { marginBottom: marginY, marginTop: marginY }),
          ...(marginTop === undefined ? {} : { marginTop }),
          ...(marginRight === undefined ? {} : { marginRight }),
          ...(marginBottom === undefined ? {} : { marginBottom }),
          ...(marginLeft === undefined ? {} : { marginLeft }),
        },
        style,
      ]}
      {...props}
    />
  );
}

export type {
  TextAlign,
  TextColor,
  TextProps,
  TextSize,
  TextType,
  TextWeight,
};
export { Text };
export default Text;
