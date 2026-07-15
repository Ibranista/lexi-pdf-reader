import type { ReactNode } from 'react';
import type {
  PressableProps,
  StyleProp,
  ViewProps,
  ViewStyle,
} from 'react-native';

import { useMemo } from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme/types/theme';

import styled from '../styled';
import { Text } from '../Text';

type BoxAlign = 'center' | 'end' | 'start' | 'stretch';
type BoxDirection = 'column' | 'row';
type BoxJustify = 'around' | 'between' | 'center' | 'end' | 'evenly' | 'start';
type BoxProps = {
  readonly align?: BoxAlign;
  readonly bg?: ColorValue;
  readonly borderColor?: ColorValue;
  readonly borderWidth?: number;
  readonly columnGap?: number;
  readonly direction?: BoxDirection;
  readonly flex?: number;
  readonly fullHeight?: boolean;
  readonly fullWidth?: boolean;
  readonly gap?: number;
  readonly height?: number;
  readonly justify?: BoxJustify;
  readonly margin?: number;
  readonly marginBottom?: number;
  readonly marginLeft?: number;
  readonly marginRight?: number;
  readonly marginTop?: number;
  readonly marginX?: number;
  readonly marginY?: number;
  readonly maxHeight?: number;
  readonly maxWidth?: number;
  readonly minHeight?: number;
  readonly minWidth?: number;

  readonly padding?: number;
  readonly paddingBottom?: number;
  readonly paddingLeft?: number;
  readonly paddingRight?: number;
  readonly paddingTop?: number;
  readonly paddingX?: number;
  readonly paddingY?: number;

  readonly [key: string]: unknown;
  readonly rounded?: number;
  readonly roundedBottomLeft?: number;
  readonly roundedBottomRight?: number;
  readonly roundedTopLeft?: number;
  readonly roundedTopRight?: number;
  readonly rowGap?: number;
  readonly width?: number;
  readonly wrap?: BoxWrap;
} & ViewProps;

type BoxWrap = 'nowrap' | 'wrap';

type ColorValue = ({} & string) | LegacyColorToken | ScaleToken | ShadesToken;

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
type QuickActionCardProps = {
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly description: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly width?: ViewStyle['width'];
} & Omit<PressableProps, 'style'>;
type RoundedBoxProps = {
  readonly backgroundColor?: ColorValue;
  readonly borderColor?: ColorValue;
  readonly borderWidth?: number;
  readonly children?: ReactNode;
  readonly height?: number;
  readonly padding?: number;
  readonly width?: number;
} & ViewProps;
type ScaleToken =
  `${Exclude<keyof Theme['colors'], 'shades'>}.${keyof Theme['colors']['neutral']}`;
type ShadesToken = `shades.${keyof Theme['colors']['shades']}`;

type StyledProps = {
  $align?: ViewStyle['alignItems'];
  $bg?: string;
  $borderColor?: string;
  $borderWidth?: number;
  $columnGap?: number;
  $direction?: ViewStyle['flexDirection'];
  $flex?: number;
  $fullHeight?: boolean;
  $fullWidth?: boolean;
  $gap?: number;
  $height?: number;
  $justify?: ViewStyle['justifyContent'];
  $margin?: number;
  $marginBottom?: number;
  $marginLeft?: number;
  $marginRight?: number;
  $marginTop?: number;
  $marginX?: number;
  $marginY?: number;
  $maxHeight?: number;
  $maxWidth?: number;
  $minHeight?: number;
  $minWidth?: number;

  $padding?: number;
  $paddingBottom?: number;
  $paddingLeft?: number;
  $paddingRight?: number;
  $paddingTop?: number;
  $paddingX?: number;
  $paddingY?: number;

  $rounded?: number;
  $roundedBottomLeft?: number;
  $roundedBottomRight?: number;
  $roundedTopLeft?: number;
  $roundedTopRight?: number;
  $rowGap?: number;
  $width?: number;
  $wrap?: ViewStyle['flexWrap'];
};

const BaseBox = styled.View<StyledProps>`
  flex-direction: ${({ $direction }) => $direction ?? 'column'};
  align-items: ${({ $align }) => $align ?? 'stretch'};
  justify-content: ${({ $justify }) => $justify ?? 'flex-start'};
  flex-wrap: ${({ $wrap }) => $wrap ?? 'nowrap'};

  ${({ $flex }) => ($flex === undefined ? '' : `flex: ${$flex};`)}
  ${({ $fullWidth }) => ($fullWidth ? 'width: 100%;' : '')}
  ${({ $fullHeight }) => ($fullHeight ? 'height: 100%;' : '')}
  ${({ $width }) => ($width === undefined ? '' : `width: ${$width}px;`)}
  ${({ $height }) => ($height === undefined ? '' : `height: ${$height}px;`)}
  ${({ $minWidth }) =>
    $minWidth === undefined ? '' : `min-width: ${$minWidth}px;`}
  ${({ $minHeight }) =>
    $minHeight === undefined ? '' : `min-height: ${$minHeight}px;`}
  ${({ $maxWidth }) =>
    $maxWidth === undefined ? '' : `max-width: ${$maxWidth}px;`}
  ${({ $maxHeight }) =>
    $maxHeight === undefined ? '' : `max-height: ${$maxHeight}px;`}

  ${({ $gap }) => ($gap === undefined ? '' : `gap: ${$gap}px;`)}
  ${({ $columnGap }) =>
    $columnGap === undefined ? '' : `column-gap: ${$columnGap}px;`}
  ${({ $rowGap }) => ($rowGap === undefined ? '' : `row-gap: ${$rowGap}px;`)}
  
  /* ✅ Correct padding precedence */

  ${({ $padding }) => ($padding === undefined ? '' : `padding: ${$padding}px;`)}

  ${({ $paddingX }) =>
    $paddingX === undefined
      ? ''
      : `padding-left: ${$paddingX}px; padding-right: ${$paddingX}px;`}

  ${({ $paddingY }) =>
    $paddingY === undefined
      ? ''
      : `padding-top: ${$paddingY}px; padding-bottom: ${$paddingY}px;`}

  ${({ $paddingTop }) =>
    $paddingTop === undefined ? '' : `padding-top: ${$paddingTop}px;`}

  ${({ $paddingBottom }) =>
    $paddingBottom === undefined ? '' : `padding-bottom: ${$paddingBottom}px;`}

  ${({ $paddingLeft }) =>
    $paddingLeft === undefined ? '' : `padding-left: ${$paddingLeft}px;`}

  ${({ $paddingRight }) =>
    $paddingRight === undefined ? '' : `padding-right: ${$paddingRight}px;`}

  ${({ $margin }) => ($margin === undefined ? '' : `margin: ${$margin}px;`)}

  ${({ $marginX }) =>
    $marginX === undefined
      ? ''
      : `margin-left: ${$marginX}px; margin-right: ${$marginX}px;`}

  ${({ $marginY }) =>
    $marginY === undefined
      ? ''
      : `margin-top: ${$marginY}px; margin-bottom: ${$marginY}px;`}

  ${({ $marginTop }) =>
    $marginTop === undefined ? '' : `margin-top: ${$marginTop}px;`}

  ${({ $marginBottom }) =>
    $marginBottom === undefined ? '' : `margin-bottom: ${$marginBottom}px;`}

  ${({ $marginLeft }) =>
    $marginLeft === undefined ? '' : `margin-left: ${$marginLeft}px;`}

  ${({ $marginRight }) =>
    $marginRight === undefined ? '' : `margin-right: ${$marginRight}px;`}

  ${({ $rounded }) =>
    $rounded === undefined ? '' : `border-radius: ${$rounded}px;`}
  ${({ $roundedBottomLeft }) =>
    $roundedBottomLeft === undefined
      ? ''
      : `border-bottom-left-radius: ${$roundedBottomLeft}px;`}
  ${({ $roundedBottomRight }) =>
    $roundedBottomRight === undefined
      ? ''
      : `border-bottom-right-radius: ${$roundedBottomRight}px;`}
  ${({ $roundedTopLeft }) =>
    $roundedTopLeft === undefined
      ? ''
      : `border-top-left-radius: ${$roundedTopLeft}px;`}
  ${({ $roundedTopRight }) =>
    $roundedTopRight === undefined
      ? ''
      : `border-top-right-radius: ${$roundedTopRight}px;`}

  ${({ $bg }) => ($bg ? `background-color: ${$bg};` : '')}
  ${({ $borderColor }) =>
    $borderColor ? `border-color: ${$borderColor};` : ''}
  ${({ $borderWidth }) =>
    $borderWidth === undefined ? '' : `border-width: ${$borderWidth}px;`}
`;

const alignMap: Record<BoxAlign, ViewStyle['alignItems']> = {
  center: 'center',
  end: 'flex-end',
  start: 'flex-start',
  stretch: 'stretch',
};

const justifyMap: Record<BoxJustify, ViewStyle['justifyContent']> = {
  around: 'space-around',
  between: 'space-between',
  center: 'center',
  end: 'flex-end',
  evenly: 'space-evenly',
  start: 'flex-start',
};

const directionMap: Record<BoxDirection, ViewStyle['flexDirection']> = {
  column: 'column',
  row: 'row',
};

const wrapMap: Record<BoxWrap, ViewStyle['flexWrap']> = {
  nowrap: 'nowrap',
  wrap: 'wrap',
};

const resolveColor = (
  colors: Theme['colors'],
  value?: ColorValue,
): string | undefined => {
  if (!value) return;

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

function Box({
  align,
  bg,
  borderColor,
  borderWidth,
  columnGap,
  direction,
  flex,
  fullHeight,
  fullWidth,
  gap,
  height,
  justify,
  margin,
  marginBottom,
  marginLeft,
  marginRight,
  marginTop,
  marginX,
  marginY,
  maxHeight,
  maxWidth,
  minHeight,
  minWidth,
  padding,
  paddingBottom,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingX,
  paddingY,
  rounded,
  roundedBottomLeft,
  roundedBottomRight,
  roundedTopLeft,
  roundedTopRight,
  rowGap,
  style,
  width,
  wrap,
  ...props
}: BoxProps) {
  const { colors } = useTheme();

  const resolvedBg = useMemo(() => resolveColor(colors, bg), [colors, bg]);
  const resolvedBorder = useMemo(
    () => resolveColor(colors, borderColor),
    [colors, borderColor],
  );

  return (
    <BaseBox
      $align={align ? alignMap[align] : undefined}
      $bg={resolvedBg}
      $borderColor={resolvedBorder}
      $borderWidth={borderWidth}
      $columnGap={columnGap}
      $direction={direction ? directionMap[direction] : undefined}
      $flex={flex}
      $fullHeight={fullHeight}
      $fullWidth={fullWidth}
      $gap={gap}
      $height={height}
      $justify={justify ? justifyMap[justify] : undefined}
      $margin={margin}
      $marginBottom={marginBottom}
      $marginLeft={marginLeft}
      $marginRight={marginRight}
      $marginTop={marginTop}
      $marginX={marginX}
      $marginY={marginY}
      $maxHeight={maxHeight}
      $maxWidth={maxWidth}
      $minHeight={minHeight}
      $minWidth={minWidth}
      $padding={padding}
      $paddingBottom={paddingBottom}
      $paddingLeft={paddingLeft}
      $paddingRight={paddingRight}
      $paddingTop={paddingTop}
      $paddingX={paddingX}
      $paddingY={paddingY}
      $rounded={rounded}
      $roundedBottomLeft={roundedBottomLeft}
      $roundedBottomRight={roundedBottomRight}
      $roundedTopLeft={roundedTopLeft}
      $roundedTopRight={roundedTopRight}
      $rowGap={rowGap}
      $width={width}
      $wrap={wrap ? wrapMap[wrap] : undefined}
      style={style}
      {...props}
    />
  );
}

function CenterColumn(props: BoxProps = {}) {
  return <Box align="center" direction="column" justify="center" {...props} />;
}

function CenterRow(props: BoxProps = {}) {
  return <Box align="center" direction="row" justify="center" {...props} />;
}

function Container(props: BoxProps = {}) {
  return <Box fullWidth paddingX={16} paddingY={16} {...props} />;
}

function Flex(props: BoxProps = {}) {
  return <Box flex={1} {...props} />;
}

function QuickActionCard({
  containerStyle,
  description,
  icon,
  title,
  width = '48%',
  ...props
}: QuickActionCardProps) {
  return (
    <Pressable style={[{ width }, containerStyle]} {...props}>
      <Box
        bg="white"
        borderColor="neutral.100"
        borderWidth={1}
        padding={16}
        rounded={12}
      >
        <Box
          bg="primary.100"
          padding={10}
          rounded={999}
          style={{ alignSelf: 'flex-start' }}
        >
          {icon}
        </Box>
        <Text color="neutral.900" marginTop={12} variant="title-small/600">
          {title}
        </Text>
        <Text color="neutral.500" marginTop={4} variant="label-small/400">
          {description}
        </Text>
      </Box>
    </Pressable>
  );
}

function RoundedBox({
  backgroundColor = 'primary.100',
  borderColor,
  borderWidth,
  children,
  height,
   
  padding = 20,
  style,
  width,
  ...props
}: RoundedBoxProps) {
  return (
    <Box
      bg={backgroundColor}
      borderColor={borderColor}
      borderWidth={borderWidth}
      height={height}
      padding={padding}
      rounded={999}
      style={style}
      width={width}
      {...props}
    >
      {children}
    </Box>
  );
}

export type {
  BoxAlign,
  BoxDirection,
  BoxJustify,
  BoxProps,
  BoxWrap,
  QuickActionCardProps,
  RoundedBoxProps,
};
export {
  BaseBox,
  Box,
  CenterColumn,
  CenterRow,
  Container,
  Flex,
  QuickActionCard,
  RoundedBox,
};
export default Box;
