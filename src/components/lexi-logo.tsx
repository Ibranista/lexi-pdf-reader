import { palette } from "@/constants/colors";
import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

export const LogoColors = {
  ink: palette.ink[800],
  paper: palette.paper.bright,
  accent: palette.accent[400],
};

const GRID = 44;
const TILE_DRAW = 176 / 280;

type LexiLogoProps = {
  size?: number;
  speed?: number;
  animated?: boolean;
  variant?: "tile" | "onLight" | "onDark";
  style?: StyleProp<ViewStyle>;
};

export function LexiLogo({
  size = 178,
  speed = 6,
  animated = true,
  variant = "tile",
  style,
}: LexiLogoProps) {
  const draw = variant === "tile" ? size * TILE_DRAW : size;
  const u = draw / GRID;
  const stemColor = variant === "onLight" ? LogoColors.ink : LogoColors.paper;
  const behindColor =
    variant === "tile"
      ? LogoColors.ink
      : variant === "onLight"
        ? palette.white
        : palette.black;

  const intro = useSharedValue(animated ? 0 : 1);
  const morph = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    const introMs = speed * 0.35 * 1000;
    const morphMs = speed * 0.65 * 1000;
    intro.value = 0;
    intro.value = withTiming(1, { duration: introMs, easing: Easing.linear });
    morph.value = 0;
    morph.value = withDelay(
      introMs,
      withRepeat(
        withTiming(1, { duration: morphMs, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [animated, speed, intro, morph]);

  const contentsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.15], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          intro.value,
          [0, 0.15],
          [0.92, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const stemStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0, 0.22], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          intro.value,
          [0, 0.22],
          [-5 * u, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const footStyle = useAnimatedStyle(() => {
    const deg = interpolate(
      intro.value,
      [0.25, 0.45, 0.58],
      [-90, 8, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: -7.5 * u },
        { rotate: `${deg}deg` },
        { translateX: 7.5 * u },
      ],
    };
  });

  const dotStyle = useAnimatedStyle(() => {
    const i = intro.value;
    const m = morph.value;
    const steps = [0.52, 0.55, 0.6, 0.65, 0.75, 0.83, 0.9];
    const loop = [0, 0.08, 0.18, 0.68, 0.78, 1];
    return {
      opacity: interpolate(i, [0.52, 0.55], [0, 1], Extrapolation.CLAMP),
      left: interpolate(m, loop, [29, 29, 27.5, 27.5, 29, 29]) * u,
      top: interpolate(m, loop, [8, 8, 5.5, 5.5, 8, 8]) * u,
      width: interpolate(m, loop, [8, 8, 11, 11, 8, 8]) * u,
      height: interpolate(m, loop, [8, 8, 13, 13, 8, 8]) * u,
      borderRadius: interpolate(m, loop, [4, 4, 1.8, 1.8, 4, 4]) * u,
      transform: [
        {
          translateX:
            interpolate(
              i,
              steps,
              [-18.5, -18.5, -13, -8, 0.9, -0.2, 0],
              Extrapolation.CLAMP,
            ) * u,
        },
        {
          translateY:
            interpolate(
              i,
              steps,
              [21.5, 21.5, 16, 9, -1.8, 0.4, 0],
              Extrapolation.CLAMP,
            ) * u,
        },
        {
          scaleX: interpolate(
            i,
            steps,
            [0.75, 0.8, 1.55, 0.55, 1.18, 0.94, 1],
            Extrapolation.CLAMP,
          ),
        },
        {
          scaleY: interpolate(
            i,
            steps,
            [0.75, 0.8, 0.32, 1.6, 0.82, 1.08, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const foldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      morph.value,
      [0, 0.14, 0.22, 0.62, 0.7, 1],
      [0, 0, 1, 1, 0, 0],
    ),
  }));

  const useDocLineStyle = (start: number, length: number) =>
    useAnimatedStyle(() => {
      const frames = [0, start, start + 0.08, 0.58, 0.65, 1];
      return {
        opacity: interpolate(morph.value, frames, [0, 0, 0.9, 0.9, 0, 0]),
        width:
          interpolate(morph.value, frames, [0, 0, length, length, 0, 0]) * u,
      };
    });
  const lineStyles = [
    useDocLineStyle(0.2, 4.5),
    useDocLineStyle(0.24, 6.5),
    useDocLineStyle(0.28, 3.5),
  ];
  const lineTops = [9.5, 12.5, 15.5];

  return (
    <View
      style={[
        variant === "tile" && [
          styles.tile,
          { width: size, height: size, borderRadius: size * (64 / 280) },
        ],
        styles.center,
        style,
      ]}
    >
      <Animated.View style={[{ width: draw, height: draw }, contentsStyle]}>
        <Animated.View
          style={[styles.abs, { backgroundColor: LogoColors.accent }, dotStyle]}
        />
        <Animated.View
          style={[
            styles.abs,
            {
              left: 10 * u,
              top: 6 * u,
              width: 9 * u,
              height: 30 * u,
              borderRadius: 2 * u,
              backgroundColor: stemColor,
            },
            stemStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.abs,
            {
              left: 10 * u,
              top: 29 * u,
              width: 24 * u,
              height: 9 * u,
              borderRadius: 2 * u,
              backgroundColor: LogoColors.accent,
            },
            footStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.abs,
            { left: 35.5 * u, top: 5.5 * u, width: 3 * u, height: 3 * u },
            foldStyle,
          ]}
        >
          <Svg width={3 * u} height={3 * u} viewBox="0 0 3 3">
            <Path d="M0 0 L3 0 L3 3 Z" fill={behindColor} />
            <Path
              d="M0 0 L3 3 L0 3 Z"
              fill={LogoColors.paper}
              fillOpacity={0.9}
            />
          </Svg>
        </Animated.View>
        {lineStyles.map((lineStyle, idx) => (
          <Animated.View
            key={lineTops[idx]}
            style={[
              styles.abs,
              {
                left: 30 * u,
                top: (lineTops[idx] - 0.7) * u,
                height: 1.4 * u,
                borderRadius: 0.7 * u,
                backgroundColor: LogoColors.paper,
              },
              lineStyle,
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: LogoColors.ink,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  abs: {
    position: "absolute",
  },
});
