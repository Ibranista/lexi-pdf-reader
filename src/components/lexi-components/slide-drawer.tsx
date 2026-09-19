import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Box } from "@/components/atoms";

export const DRAWER_EDGE = 52;

const SPRING = {
  damping: 28,
  mass: 0.55,
  overshootClamping: true,
  restDisplacementThreshold: 0.002,
  restSpeedThreshold: 0.02,
  stiffness: 450,
} as const;
const ACTIVATE_X = 12;
const FAIL_Y = 26;
const FLING_VELOCITY = 450;
const COMMIT_TRAVEL = 0.25;
const SCRIM_OPACITY = 0.45;

export function SlideDrawer({
  children,
  edgeWidth = DRAWER_EDGE,
  onClose,
  onOpen,
  open,
  renderPanel,
}: {
  readonly children: ReactNode;
  readonly edgeWidth?: number;
  readonly onClose: () => void;
  readonly onOpen: () => void;
  readonly open: boolean;
  readonly renderPanel: () => ReactNode;
}) {
  const { width: windowWidth } = useWindowDimensions();

  const progress = useSharedValue(open ? 1 : 0);
  const start = useSharedValue(open ? 1 : 0);
  const active = useSharedValue(false);
  const width = useSharedValue(windowWidth);

  const target = useRef(open);

  const [arrived, setArrived] = useState(open);

  const syncRef = useRef<(next: boolean) => void>(() => undefined);
  useEffect(() => {
    syncRef.current = (next: boolean) => {
      target.current = next;
      if (next) {
        onOpen();
      } else {
        onClose();
      }
    };
  }, [onClose, onOpen]);
  const syncJS = useCallback((next: boolean) => {
    syncRef.current(next);
  }, []);
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);
  const reportArrived = useCallback((next: boolean) => {
    setArrived(next);
  }, []);

  /* The gesture callbacks below reach `syncRef` when a finger lifts, not
     while this renders — which is the only thing the rule is guarding.
     eslint-disable-next-line is no use here: it flags each builder call. */
  /* eslint-disable react-hooks/refs */
  const pan = useMemo(() => {
    const settle = (next: boolean, velocity: number) => {
      "worklet";
      progress.value = withSpring(
        next ? 1 : 0,
        { ...SPRING, velocity },
        (finished) => {
          if (finished) runOnJS(reportArrived)(next);
        },
      );
      runOnJS(syncJS)(next);
    };

    return (
      Gesture.Pan()
        .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onTouchesDown((event, manager) => {
          const touch = event.allTouches[0];
          if (!touch || (progress.value < 0.5 && touch.absoluteX > edgeWidth)) {
            manager.fail();
          }
        })
        .onBegin(() => {
          start.value = progress.value;
        })
        .onStart(() => {
          active.value = true;
          runOnJS(dismissKeyboard)();
        })
        .onUpdate((event) => {
          const next = start.value + event.translationX / (width.value || 1);
          progress.value = next < 0 ? 0 : next > 1 ? 1 : next;
        })
        .onEnd((event) => {
          const travelled = progress.value - start.value;
          const next =
            Math.abs(event.velocityX) > FLING_VELOCITY
              ? event.velocityX > 0
              : Math.abs(travelled) > COMMIT_TRAVEL
                ? travelled > 0
                : start.value > 0.5;
          settle(next, event.velocityX / (width.value || 1));
        })
        .onFinalize((_event, success) => {
          if (active.value && !success) settle(start.value > 0.5, 0);
          active.value = false;
        })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissKeyboard, edgeWidth, reportArrived, syncJS]);
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    if (target.current === open) return;
    target.current = open;
    progress.value = withSpring(open ? 1 : 0, SPRING, (finished) => {
      if (finished) runOnJS(reportArrived)(open);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) width.value = next;
  };

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.value * SCRIM_OPACITY,
    transform: [{ translateX: progress.value * width.value }],
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * width.value }],
    zIndex: progress.value === 0 ? 0 : 2,
  }));

  return (
    <Box flex={1} onLayout={onLayout} style={styles.clip}>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={styles.fill}>
          <Box aria-hidden={arrived} flex={1}>
            {children}
          </Box>
          <Reanimated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
          />
          <Reanimated.View
            pointerEvents={arrived ? "auto" : "none"}
            style={[StyleSheet.absoluteFill, panelStyle]}
          >
            {renderPanel()}
          </Reanimated.View>
        </Reanimated.View>
      </GestureDetector>
    </Box>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  fill: { flex: 1 },
  scrim: { backgroundColor: "#000", zIndex: 1 },
});
