import type { ReactNode } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import type { GestureType } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Box, Text } from "@/components/atoms";
import { useProtoTheme } from "@/theme/proto";

const SPRING = { damping: 22, mass: 0.7, stiffness: 220 } as const;
const TAP_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) };
const ACTIVATE_X = 18;
const FAIL_Y = 14;
const EDGE_RESISTANCE = 0.32;
const FLING_VELOCITY = 420;
export const DRAWER_EDGE = 44;
const BAR_PAD = 3;

export interface SwipeTabItem<K extends string = string> {
  flex?: number;
  key: K;
  label: string;
}

export interface SwipeTabs<K extends string = string> {
  gesture: GestureType;
  goTo: (key: K) => void;
  index: number;
  keys: readonly K[];
  mounted: (index: number) => boolean;
  progress: SharedValue<number>;
  setWidth: (width: number) => void;
}

const PagerGestureContext = createContext<GestureType | null>(null);

export function usePagerGesture(): GestureType | null {
  return useContext(PagerGestureContext);
}

export function useSwipeTabs<K extends string>({
  keys,
  onChange,
  value,
}: {
  keys: readonly K[];
  onChange: (key: K) => void;
  value: K;
}): SwipeTabs<K> {
  const { width: windowWidth } = useWindowDimensions();
  const count = keys.length;
  const index = Math.max(0, keys.indexOf(value));

  const progress = useSharedValue(index);
  const width = useSharedValue(windowWidth);
  const from = useSharedValue(index);

  const [visited, setVisited] = useState<readonly number[]>(() => [index]);
  const visit = (...next: number[]) => {
    setVisited((prev) =>
      next.every((i) => prev.includes(i))
        ? prev
        : [...new Set([...prev, ...next])],
    );
  };

  const settled = useSharedValue(index);

  const commit = (target: number) => {
    settled.value = target;
    visit(target);
    onChange(keys[target]);
  };

  const goTo = (key: K) => {
    const target = keys.indexOf(key);
    if (target < 0 || target === index) return;
    const [lo, hi] = target > index ? [index, target] : [target, index];
    visit(...Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
    settled.value = target;
    progress.value = withTiming(target, TAP_TIMING);
    onChange(key);
  };

  const commitRef = useRef(commit);
  commitRef.current = commit;
  const commitJS = useCallback((target: number) => {
    commitRef.current(target);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onTouchesDown((event, manager) => {
          const touch = event.allTouches[0];
          if (touch && touch.absoluteX < DRAWER_EDGE) manager.fail();
        })
        .onBegin(() => {
          from.value = Math.round(progress.value);
        })
        .onUpdate((event) => {
          const raw = from.value - event.translationX / (width.value || 1);
          const last = count - 1;
          progress.value =
            raw < 0
              ? raw * EDGE_RESISTANCE
              : raw > last
                ? last + (raw - last) * EDGE_RESISTANCE
                : raw;
        })
        .onEnd((event) => {
          const flung = Math.abs(event.velocityX) > FLING_VELOCITY;
          const landed = flung
            ? event.velocityX < 0
              ? Math.ceil(progress.value)
              : Math.floor(progress.value)
            : Math.round(progress.value);
          const target = Math.min(
            count - 1,
            Math.max(
              0,
              Math.min(from.value + 1, Math.max(from.value - 1, landed)),
            ),
          );
          progress.value = withSpring(target, SPRING);
          if (target !== from.value) runOnJS(commitJS)(target);
        })
        .onFinalize((_event, success) => {
          if (!success) progress.value = withSpring(from.value, SPRING);
        }),
    [commitJS, count, from, progress, width],
  );

  const setWidth = (next: number) => {
    width.value = next;
  };

  const mounted = (i: number) =>
    visited.includes(i) || Math.abs(i - index) <= 1;

  useEffect(() => {
    if (settled.value === index) return;
    settled.value = index;
    progress.value = withTiming(index, TAP_TIMING);
  }, [index, progress, settled]);

  return { gesture, goTo, index, keys, mounted, progress, setWidth };
}

export function SwipeTabsBar<K extends string>({
  items,
  size = 12,
  tabs,
}: {
  items: SwipeTabItem<K>[];
  size?: number;
  tabs: SwipeTabs<K>;
}) {
  const t = useProtoTheme();
  const { progress } = tabs;
  const activeBg = t.dark ? "#2B2620" : "#FFFFFF";

  const slots = useSharedValue<{ pages: number[]; ws: number[]; xs: number[] }>(
    {
      pages: [],
      ws: [],
      xs: [],
    },
  );
  const measured = useRef<{ w: number; x: number }[]>([]);
  const onSlotLayout = (i: number) => (event: LayoutChangeEvent) => {
    const { width, x } = event.nativeEvent.layout;
    measured.current[i] = { w: width, x };
    const done = measured.current.filter(Boolean);
    if (done.length !== items.length) return;
    slots.value = {
      pages: done.map((_, page) => page),
      ws: done.map((slot) => slot.w),
      xs: done.map((slot) => slot.x),
    };
  };

  const pillStyle = useAnimatedStyle(() => {
    const { pages, ws, xs } = slots.value;
    if (pages.length < 2) {
      return { opacity: 0, transform: [{ translateX: 0 }], width: 0 };
    }
    return {
      opacity: 1,
      transform: [
        {
          translateX: interpolate(
            progress.value,
            pages,
            xs,
            Extrapolation.CLAMP,
          ),
        },
      ],
      width: interpolate(progress.value, pages, ws, Extrapolation.CLAMP),
    };
  });

  return (
    <Box
      bg={t.chip}
      padding={BAR_PAD}
      rounded={14}
      style={{ overflow: "hidden" }}
    >
      <Reanimated.View
        pointerEvents="none"
        style={[
          {
            backgroundColor: activeBg,
            borderRadius: 10,
            bottom: BAR_PAD,
            elevation: 2,
            left: 0,
            position: "absolute",
            shadowColor: "#14100C",
            shadowOffset: { height: 1, width: 0 },
            shadowOpacity: 0.12,
            shadowRadius: 2,
            top: BAR_PAD,
          },
          pillStyle,
        ]}
      />

      <Box direction="row">
        {items.map((item, i) => (
          <Pressable
            key={item.key}
            onLayout={onSlotLayout(i)}
            onPress={() => tabs.goTo(item.key)}
            style={{ flex: item.flex ?? 1 }}
          >
            <Box align="center" justify="center" paddingY={9}>
              <Text color={t.sub} size={size} weight="500">
                {item.label}
              </Text>
              <ActiveLabel index={i} progress={progress} size={size}>
                {item.label}
              </ActiveLabel>
            </Box>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

function ActiveLabel({
  children,
  index,
  progress,
  size,
}: {
  children: string;
  index: number;
  progress: SharedValue<number>;
  size: number;
}) {
  const t = useProtoTheme();
  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(progress.value - index)),
  }));

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        {
          alignItems: "center",
          bottom: 0,
          justifyContent: "center",
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        },
        style,
      ]}
    >
      <Text color={t.ink} size={size} weight="600">
        {children}
      </Text>
    </Reanimated.View>
  );
}

export function SwipeTabsPager<K extends string>({
  renderTab,
  style,
  tabs,
}: {
  renderTab: (key: K, index: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
  tabs: SwipeTabs<K>;
}) {
  const { gesture, keys, mounted, progress, setWidth } = tabs;
  const [width, setLayoutWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth(next);
    setLayoutWidth(next);
  };

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * width }],
  }));

  return (
    <Box flex={1} onLayout={onLayout} style={[{ overflow: "hidden" }, style]}>
      <GestureDetector gesture={gesture}>
        <Reanimated.View
          style={[{ flex: 1, width: width * keys.length }, rowStyle]}
        >
          <PagerGestureContext.Provider value={gesture}>
            {width > 0
              ? keys.map((key, i) =>
                  mounted(i) ? (
                    <Box
                      key={key}
                      style={{
                        bottom: 0,
                        left: i * width,
                        position: "absolute",
                        top: 0,
                        width,
                      }}
                    >
                      {renderTab(key, i)}
                    </Box>
                  ) : null,
                )
              : null}
          </PagerGestureContext.Provider>
        </Reanimated.View>
      </GestureDetector>
    </Box>
  );
}
