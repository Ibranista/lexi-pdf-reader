import type { ReactNode } from "react";
import type { GestureResponderEvent, StyleProp, ViewStyle } from "react-native";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Easing, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, Text } from "@/components/atoms";
import { useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

import { IconBack } from "./icons";

interface TapProps {
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly onLongPress?: (event: GestureResponderEvent) => void;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly scale?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function Tap({
  children,
  disabled,
  onLongPress,
  onPress,
  scale = 0.96,
  style,
}: TapProps) {
  return (
    <Pressable
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed ? { transform: [{ scale }] } : undefined,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SectionLabel({
  children,
  color,
  size = 12,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
}) {
  const t = useProtoTheme();
  return (
    <Text color={color ?? t.sub} ls={0.8} size={size} upper weight="600">
      {children}
    </Text>
  );
}

export function ProtoScreen({
  children,
  bg,
}: {
  children: ReactNode;
  bg?: string;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box bg={bg ?? t.bg} flex={1} style={{ paddingTop: insets.top }}>
      {children}
    </Box>
  );
}

export function HeaderButton({
  children,
  onPress,
  bg,
  noBorder,
}: {
  children: ReactNode;
  onPress?: () => void;
  bg?: string;
  noBorder?: boolean;
}) {
  const t = useProtoTheme();
  return (
    <Tap onPress={onPress} scale={0.94}>
      <Box
        align="center"
        bg={bg ?? t.card}
        borderColor={noBorder ? undefined : t.line}
        borderWidth={noBorder ? undefined : 1}
        height={40}
        justify="center"
        rounded={12}
        width={40}
      >
        {children}
      </Box>
    </Tap>
  );
}

export function ScreenHeader({
  onBack,
  right,
  subtitle,
  title,
  titleSize = 20,
}: {
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
  title: string;
  titleSize?: number;
}) {
  const t = useProtoTheme();
  return (
    <Box
      align="center"
      direction="row"
      gap={12}
      paddingLeft={20}
      paddingRight={20}
      paddingTop={8}
    >
      {onBack ? (
        <HeaderButton onPress={onBack}>
          <IconBack color={t.ink} size={18} />
        </HeaderButton>
      ) : null}
      <Box flex={1}>
        <Text serif size={titleSize} weight="600">
          {title}
        </Text>
        {subtitle ? (
          <Text color={t.sub} size={12}>
            {subtitle}
          </Text>
        ) : null}
      </Box>
      {right}
    </Box>
  );
}

export function Card({
  children,
  gap,
  padding = 16,
  rounded = 16,
  style,
}: {
  children: ReactNode;
  gap?: number;
  padding?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useProtoTheme();
  return (
    <Box
      bg={t.card}
      borderColor={t.line}
      borderWidth={1}
      gap={gap}
      padding={padding}
      rounded={rounded}
      style={style}
    >
      {children}
    </Box>
  );
}

export function Divider() {
  const t = useProtoTheme();
  return <Box bg={t.line} height={1} />;
}

export interface SegmentItem<K extends string = string> {
  key: K;
  label: string;
  serif?: boolean;
  font?: { active: string; inactive: string };
  flex?: number;
}

export function Segmented<K extends string>({
  items,
  onChange,
  size = 12,
  value,
}: {
  items: SegmentItem<K>[];
  onChange: (key: K) => void;
  size?: number;
  value: K | null;
}) {
  const t = useProtoTheme();
  const activeBg = t.dark ? "#2B2620" : "#FFFFFF";
  return (
    <Box bg={t.chip} direction="row" padding={3} rounded={12}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Tap
            key={item.key}
            onPress={() => onChange(item.key)}
            style={{ flex: item.flex ?? 1 }}
          >
            <Box
              align="center"
              bg={on ? activeBg : "transparent"}
              justify="center"
              paddingY={9}
              rounded={9}
              style={
                on
                  ? {
                      shadowColor: "#14100C",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.12,
                      shadowRadius: 2,
                      elevation: 2,
                    }
                  : undefined
              }
            >
              <Text
                color={on ? t.ink : t.sub}
                serif={item.serif}
                size={size}
                style={
                  item.font
                    ? { fontFamily: on ? item.font.active : item.font.inactive }
                    : undefined
                }
                weight={on ? "600" : "500"}
              >
                {item.label}
              </Text>
            </Box>
          </Tap>
        );
      })}
    </Box>
  );
}

export function Toggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  const t = useProtoTheme();
  const off = t.dark ? "rgba(241,235,226,.2)" : "rgba(32,27,21,.18)";
  return (
    <Pressable onPress={onToggle}>
      <Box bg={on ? t.accent : off} height={28} rounded={14} width={46}>
        <Box
          bg="#FFFFFF"
          height={24}
          rounded={12}
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            transform: [{ translateX: on ? 18 : 0 }],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.25,
            shadowRadius: 3,
            elevation: 2,
          }}
          width={24}
        />
      </Box>
    </Pressable>
  );
}

export function Cover({
  height,
  label,
  rounded = 6,
  width,
}: {
  height: number;
  label?: string;
  rounded?: number;
  width: number;
}) {
  const t = useProtoTheme();
  const stripes: ReactNode[] = [];
  const stripeW = 6;
  const span = width + height;
  for (let x = -height, i = 0; x < span; x += stripeW * 2, i++) {
    stripes.push(
      <Box
        bg={t.coverB}
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: -height,
          width: stripeW,
          height: span * 2,
          transform: [{ rotate: "45deg" }],
        }}
      />,
    );
  }
  return (
    <Box
      align="center"
      bg={t.coverA}
      height={height}
      justify="center"
      rounded={rounded}
      style={{ overflow: "hidden" }}
      width={width}
    >
      {stripes}
      {label ? (
        <Text color={t.sub} mono size={8}>
          {label}
        </Text>
      ) : null}
    </Box>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const t = useProtoTheme();
  return (
    <Box bg={t.chip} height={4} rounded={2}>
      <Box
        bg={t.accent}
        height={4}
        rounded={2}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </Box>
  );
}

export function IndeterminateBar() {
  const t = useProtoTheme();
  const [x] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <Box bg={t.chip} height={4} rounded={2} style={{ overflow: "hidden" }}>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "35%",
          borderRadius: 2,
          backgroundColor: t.accent,
          left: x.interpolate({
            inputRange: [0, 1],
            outputRange: ["-35%", "100%"],
          }),
        }}
      />
    </Box>
  );
}

const SLIDER_H = 28;
const THUMB = 18;
const TICK_H = 11;
const TICK_SNAP = 0.03;

export function ProtoSlider({
  curve = "linear",
  max,
  min,
  onChange,
  onChangeEnd,
  step = 1,
  ticks,
  value,
}: {
  readonly curve?: "linear" | "log";
  readonly max: number;
  readonly min: number;
  readonly onChange?: (value: number) => void;
  readonly onChangeEnd?: (value: number) => void;
  readonly step?: number;
  readonly ticks?: readonly number[];
  readonly value: number;
}) {
  const t = useProtoTheme();
  const [width, setWidth] = useState(0);

  const isLog = curve === "log" && min > 0;
  const lo = isLog ? Math.log(min) : min;
  const span = (isLog ? Math.log(max) : max) - lo;

  const posOf = useCallback(
    (v: number) =>
      span <= 0
        ? 0
        : Math.min(1, Math.max(0, ((isLog ? Math.log(v) : v) - lo) / span)),
    [isLog, lo, span],
  );

  const tickVals = useMemo(() => (ticks ? [...ticks] : []), [ticks]);
  const tickPos = useMemo(
    () => tickVals.map((v) => posOf(v)),
    [tickVals, posOf],
  );

  const sliderPos = useSharedValue(posOf(value));
  const lastSent = useSharedValue(value);

  const gesture = useMemo(() => {
    const commit = (x: number) => {
      "worklet";
      if (width <= 0 || span <= 0) return;
      const at = Math.min(1, Math.max(0, x / width));
      const raw = isLog ? Math.exp(lo + at * span) : lo + at * span;
      let next = Math.min(max, Math.max(min, Math.round(raw / step) * step));
      for (let i = 0; i < tickPos.length; i++) {
        if (Math.abs(tickPos[i] - at) < TICK_SNAP) {
          next = tickVals[i];
          break;
        }
      }
      sliderPos.value = Math.min(
        1,
        Math.max(0, ((isLog ? Math.log(next) : next) - lo) / span),
      );
      if (next !== lastSent.value) {
        lastSent.value = next;
        if (onChange) {
          runOnJS(onChange)(next);
        }
      }
    };

    const finish = () => {
      "worklet";
      if (onChangeEnd && lastSent.value !== value) {
        runOnJS(onChangeEnd)(lastSent.value);
      }
    };

    return Gesture.Exclusive(
      Gesture.Pan()
        .activeOffsetX([-6, 6])
        .failOffsetY([-14, 14])
        .onStart((e) => commit(e.x))
        .onUpdate((e) => commit(e.x))
        .onFinalize(finish),
      Gesture.Tap()
        .maxDuration(400)
        .onEnd((e) => commit(e.x))
        .onFinalize(finish),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLog,
    lo,
    max,
    min,
    onChange,
    onChangeEnd,
    span,
    step,
    tickPos,
    tickVals,
    width,
  ]);

  const fillStyle = useAnimatedStyle(() => {
    const p = sliderPos.value;
    return { width: `${p * 100}%` };
  });
  const thumbStyle = useAnimatedStyle(() => {
    const p = sliderPos.value;
    return { transform: [{ translateX: p * width - THUMB / 2 }] };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Box
        height={SLIDER_H}
        justify="center"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <Box bg={t.chip} height={4} rounded={2}>
          <Reanimated.View
            style={[
              { backgroundColor: t.accent, borderRadius: 2, height: 4 },
              fillStyle,
            ]}
          />
        </Box>

        {width > 0
          ? tickPos.map((p, i) => (
              <Box
                bg={t.sub}
                height={TICK_H}
                key={tickVals[i]}
                rounded={1}
                style={{
                  left: p * width - 1,
                  opacity: 0.4,
                  position: "absolute",
                  top: (SLIDER_H - TICK_H) / 2,
                }}
                width={2}
              />
            ))
          : null}

        <Reanimated.View
          style={[
            {
              backgroundColor: "#FFFFFF",
              borderRadius: THUMB / 2,
              elevation: 3,
              height: THUMB,
              position: "absolute",
              shadowColor: "#000",
              shadowOffset: { height: 1, width: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 3,
              top: (SLIDER_H - THUMB) / 2,
              width: THUMB,
            },
            thumbStyle,
          ]}
        />
      </Box>
    </GestureDetector>
  );
}

export function Toast() {
  const toast = useToastStore((s) => s.toast);
  if (!toast) return null;
  return (
    <Box
      align="center"
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 104,
        left: 0,
        right: 0,
        zIndex: 80,
      }}
    >
      <Box bg="rgba(24,20,15,.92)" paddingX={20} paddingY={11} rounded={22}>
        <Text color="#F6F3EE" size={13} weight="500">
          {toast}
        </Text>
      </Box>
    </Box>
  );
}

export function Backdrop({
  onPress,
  opacity = 0.35,
}: {
  onPress?: () => void;
  opacity?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: `rgba(20,16,12,${opacity})`,
        zIndex: 38,
      }}
    />
  );
}

export function BottomSheet({
  children,
  onHandle,
  paddingX = 22,
}: {
  children: ReactNode;
  onHandle?: () => void;
  paddingX?: number;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box
      bg={t.card}
      roundedTopLeft={24}
      roundedTopRight={24}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 39,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        paddingBottom: 24 + insets.bottom,
        shadowColor: "#14100C",
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.3,
        shadowRadius: 44,
        elevation: 24,
      }}
    >
      <Pressable
        onPress={onHandle}
        style={{ paddingTop: 10, paddingBottom: 6 }}
      >
        <Box
          bg={t.line}
          height={4}
          rounded={2}
          style={{ alignSelf: "center" }}
          width={40}
        />
      </Pressable>
      {children}
    </Box>
  );
}
