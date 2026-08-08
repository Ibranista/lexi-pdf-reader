/**
 * Swipeable tabs — a segmented bar and the pager it drives, sharing one
 * `progress` shared value so the pill, the labels and the pages all track the
 * finger instead of snapping after the fact.
 *
 * The bar and the pager are separate components because screens put other
 * chrome between them; `useSwipeTabs` is the piece they share.
 */
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

/** Settle spring for a released page — quick, with no visible overshoot. */
const SPRING = { damping: 22, mass: 0.7, stiffness: 220 } as const;
/** Tapped tabs have no throw behind them, so they ease instead of spring. */
const TAP_TIMING = { duration: 240, easing: Easing.out(Easing.cubic) };
/** Horizontal travel before the pager takes the gesture off the scrollers. */
const ACTIVATE_X = 18;
/** Vertical travel that hands the gesture back to the list underneath. */
const FAIL_Y = 14;
/** How much of the drag survives past the first/last page. */
const EDGE_RESISTANCE = 0.32;
/** Fling speed (px/s) that carries to the next page short of the halfway mark. */
const FLING_VELOCITY = 420;
/** Left strip left alone, so the Settings drawer keeps its edge swipe. */
export const DRAWER_EDGE = 44;
/** Inner padding of the bar — the pill insets by the same amount. */
const BAR_PAD = 3;

export interface SwipeTabItem<K extends string = string> {
  /** Widen a segment whose label needs more room than an even share. */
  flex?: number;
  key: K;
  label: string;
}

export interface SwipeTabs<K extends string = string> {
  gesture: GestureType;
  /** Animates to a tab and commits it — what the bar's taps call. */
  goTo: (key: K) => void;
  index: number;
  keys: readonly K[];
  /** Whether a page has been visited, and so should stay mounted. */
  mounted: (index: number) => boolean;
  /** Continuous page position: 0…n-1, fractional mid-drag. */
  progress: SharedValue<number>;
  setWidth: (width: number) => void;
}

/**
 * Lets a row-level horizontal gesture (the swipe-to-file rows) claim the drag
 * before the pager does. Provided by the pager, consumed by whatever is
 * rendered inside it.
 */
const PagerGestureContext = createContext<GestureType | null>(null);

/** The pager's pan gesture, for children that need to outrank it. */
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
  /** Page the current drag started from, so one swipe moves one page. */
  const from = useSharedValue(index);

  // Pages mount on first visit and stay mounted, the way a tab view does it —
  // swiping back to a list you've already seen doesn't rebuild it.
  const [visited, setVisited] = useState<readonly number[]>(() => [index]);
  const visit = (...next: number[]) => {
    setVisited((prev) =>
      next.every((i) => prev.includes(i))
        ? prev
        : [...new Set([...prev, ...next])],
    );
  };

  /** Last page the tabs themselves moved to, vs. one set from outside. */
  const settled = useSharedValue(index);

  const commit = (target: number) => {
    settled.value = target;
    visit(target);
    onChange(keys[target]);
  };

  const goTo = (key: K) => {
    const target = keys.indexOf(key);
    if (target < 0 || target === index) return;
    // Mount everything the slide passes over, so a long jump isn't blank.
    const [lo, hi] = target > index ? [index, target] : [target, index];
    visit(...Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
    settled.value = target;
    progress.value = withTiming(target, TAP_TIMING);
    onChange(key);
  };

  // The gesture reaches `commit` through a ref so the pan can be built once:
  // a Gesture.Pan() rebuilt every render re-attaches to the GestureDetector
  // mid-animation, and the churn lands as a visible hitch.
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
          // The drawer owns the left edge; don't race it for the same drag.
          const touch = event.allTouches[0];
          if (touch && touch.absoluteX < DRAWER_EDGE) manager.fail();
        })
        .onBegin(() => {
          from.value = Math.round(progress.value);
        })
        .onUpdate((event) => {
          const raw = from.value - event.translationX / (width.value || 1);
          const last = count - 1;
          // Rubber-band past the ends rather than stopping dead.
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
          // One page per swipe, however fast or far the finger went.
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
          // Cancelled mid-drag (a child gesture won): fall back where we were.
          if (!success) progress.value = withSpring(from.value, SPRING);
        }),
    [commitJS, count, from, progress, width],
  );

  const setWidth = (next: number) => {
    width.value = next;
  };

  const mounted = (i: number) =>
    visited.includes(i) || Math.abs(i - index) <= 1;

  // A tab set from outside the strip — restored state, a deep link — still
  // slides across rather than teleporting.
  useEffect(() => {
    if (settled.value === index) return;
    settled.value = index;
    progress.value = withTiming(index, TAP_TIMING);
  }, [index, progress, settled]);

  return { gesture, goTo, index, keys, mounted, progress, setWidth };
}

/* =========================
   Bar
========================= */

/**
 * The segmented control, with a pill that slides *and* resizes between
 * segments as the pager moves, and labels that cross-fade with it.
 */
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

  // Segment geometry, measured once laid out — the pill interpolates across it
  // rather than assuming even widths, since a segment can ask for more room.
  // The ranges are built here on the JS thread and handed over ready to use:
  // the style worklet can't call back into a plain `map` callback.
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
    // Same keys either way — Reanimated needs the style's shape to hold still.
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
              {/* The active label rides on top and fades in as the page
                  arrives, so the weight change never nudges the layout. */}
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

/* =========================
   Pager
========================= */

/**
 * The pages themselves. Each sits a screen-width apart in a row that slides
 * under the finger; only visited pages (plus either neighbour) are rendered.
 */
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
  // Needed in JS as well as on the UI thread: it lays the pages out.
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
      {/* The row spans every page, not just the visible one: Android won't
          deliver touches to a child laid out beyond its parent's bounds, so a
          one-screen-wide row leaves every page but the first unscrollable and
          untappable. The container above clips it back to one screen. */}
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
