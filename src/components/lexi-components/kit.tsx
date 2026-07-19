/**
 * Shared building blocks for the prototype screens — all built on the custom
 * `Box` / `Text` atoms (no raw `View`).
 */
import type { ReactNode } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box, Text } from '@/components/atoms';
import { useToastStore } from '@/stores/app-store';
import { useProtoTheme } from '@/theme/proto';

import { IconBack } from './icons';

/* =========================
   Tap — pressable with press-scale feedback
========================= */

interface TapProps {
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly onPress?: (event: GestureResponderEvent) => void;
  readonly scale?: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function Tap({ children, disabled, onPress, scale = 0.96, style }: TapProps) {
  return (
    <Pressable
      disabled={disabled}
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

/** Uppercase section label ("EARLIER THIS WEEK", "APPEARANCE", …). */
export function SectionLabel({ children, color, size = 12 }: { children: ReactNode; color?: string; size?: number }) {
  const t = useProtoTheme();
  return (
    <Text color={color ?? t.sub} ls={0.8} size={size} upper weight="600">
      {children}
    </Text>
  );
}

/* =========================
   Screen scaffolding
========================= */

export function ProtoScreen({ children, bg }: { children: ReactNode; bg?: string }) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box bg={bg ?? t.bg} flex={1} style={{ paddingTop: insets.top }}>
      {children}
    </Box>
  );
}

/** 40×40 rounded icon button on a card surface. */
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

/** Standard sub-screen header: back button + serif title (+ optional subtitle / right slot). */
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
    <Box align="center" direction="row" gap={12} paddingLeft={20} paddingRight={20} paddingTop={8}>
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

/** Card surface used across the prototype (rounded 16, hairline border). */
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
    <Box bg={t.card} borderColor={t.line} borderWidth={1} gap={gap} padding={padding} rounded={rounded} style={style}>
      {children}
    </Box>
  );
}

export function Divider() {
  const t = useProtoTheme();
  return <Box bg={t.line} height={1} />;
}

/* =========================
   Segmented control
========================= */

export interface SegmentItem<K extends string = string> {
  key: K;
  label: string;
  serif?: boolean;
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
  const activeBg = t.dark ? '#2B2620' : '#FFFFFF';
  return (
    <Box bg={t.chip} direction="row" padding={3} rounded={12}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Tap key={item.key} onPress={() => onChange(item.key)} style={{ flex: item.flex ?? 1 }}>
            <Box
              align="center"
              bg={on ? activeBg : 'transparent'}
              justify="center"
              paddingY={9}
              rounded={9}
              style={
                on
                  ? {
                      shadowColor: '#14100C',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.12,
                      shadowRadius: 2,
                      elevation: 2,
                    }
                  : undefined
              }
            >
              <Text color={on ? t.ink : t.sub} serif={item.serif} size={size} weight={on ? '600' : '500'}>
                {item.label}
              </Text>
            </Box>
          </Tap>
        );
      })}
    </Box>
  );
}

/* =========================
   Toggle switch (46×28)
========================= */

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const t = useProtoTheme();
  const off = t.dark ? 'rgba(241,235,226,.2)' : 'rgba(32,27,21,.18)';
  return (
    <Pressable onPress={onToggle}>
      <Box bg={on ? t.accent : off} height={28} rounded={14} width={46}>
        <Box
          bg="#FFFFFF"
          height={24}
          rounded={12}
          style={{
            position: 'absolute',
            top: 2,
            left: 2,
            transform: [{ translateX: on ? 18 : 0 }],
            shadowColor: '#000',
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

/* =========================
   Cover placeholder (diagonal-striped)
========================= */

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
          position: 'absolute',
          left: x,
          top: -height,
          width: stripeW,
          height: span * 2,
          transform: [{ rotate: '45deg' }],
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
      style={{ overflow: 'hidden' }}
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

/* =========================
   Progress bar
========================= */

export function ProgressBar({ pct }: { pct: number }) {
  const t = useProtoTheme();
  return (
    <Box bg={t.chip} height={4} rounded={2}>
      <Box bg={t.accent} height={4} rounded={2} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </Box>
  );
}

/**
 * Continuously animating bar for work of unknown length (e.g. scanning the
 * device for documents — we can't know the total up front).
 */
export function IndeterminateBar() {
  const t = useProtoTheme();
  const x = useRef(new Animated.Value(0)).current;

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
    <Box bg={t.chip} height={4} rounded={2} style={{ overflow: 'hidden' }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '35%',
          borderRadius: 2,
          backgroundColor: t.accent,
          left: x.interpolate({
            inputRange: [0, 1],
            outputRange: ['-35%', '100%'],
          }),
        }}
      />
    </Box>
  );
}

/* =========================
   Slider
========================= */

export function ProtoSlider({
  max,
  min,
  onChange,
  step = 1,
  value,
}: {
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const t = useProtoTheme();
  const [width, setWidth] = useState(0);

  const applyX = (x: number) => {
    if (width <= 0) return;
    const raw = min + (Math.min(Math.max(x, 0), width) / width) * (max - min);
    const stepped = Math.round(raw / step) * step;
    onChange(Math.min(max, Math.max(min, stepped)));
  };

  const pct = width > 0 ? (value - min) / (max - min) : 0;

  return (
    <Box
      height={28}
      justify="center"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => applyX(e.nativeEvent.locationX)}
      onResponderMove={(e) => applyX(e.nativeEvent.locationX)}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={() => true}
    >
      <Box bg={t.chip} height={4} rounded={2}>
        <Box bg={t.accent} height={4} rounded={2} style={{ width: `${pct * 100}%` }} />
      </Box>
      <Box
        bg="#FFFFFF"
        height={18}
        rounded={9}
        style={{
          position: 'absolute',
          left: Math.max(0, pct * width - 9),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 3,
        }}
        width={18}
      />
    </Box>
  );
}

/* =========================
   Toast
========================= */

export function Toast() {
  const toast = useToastStore((s) => s.toast);
  if (!toast) return null;
  return (
    <Box
      align="center"
      pointerEvents="none"
      style={{ position: 'absolute', bottom: 104, left: 0, right: 0, zIndex: 80 }}
    >
      <Box bg="rgba(24,20,15,.92)" paddingX={20} paddingY={11} rounded={22}>
        <Text color="#F6F3EE" size={13} weight="500">
          {toast}
        </Text>
      </Box>
    </Box>
  );
}

/* =========================
   Overlay primitives (backdrop + bottom sheet)
========================= */

export function Backdrop({ onPress, opacity = 0.35 }: { onPress?: () => void; opacity?: number }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
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
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 39,
        paddingLeft: paddingX,
        paddingRight: paddingX,
        paddingBottom: 24 + insets.bottom,
        shadowColor: '#14100C',
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.3,
        shadowRadius: 44,
        elevation: 24,
      }}
    >
      <Pressable onPress={onHandle} style={{ paddingTop: 10, paddingBottom: 6 }}>
        <Box bg={t.line} height={4} rounded={2} style={{ alignSelf: 'center' }} width={40} />
      </Pressable>
      {children}
    </Box>
  );
}
