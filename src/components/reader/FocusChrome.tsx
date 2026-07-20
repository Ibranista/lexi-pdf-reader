/**
 * Focus-session chrome for the PDF reader: the status pill (with session
 * timer) and the break suggestion card, driven by the focus store.
 *
 * The pill doesn't sit on screen for the whole session — it fades in for a
 * few seconds at the session start and again at every interval mark, then
 * gets out of the way. The cadence is derived from `sessionSec`, so no extra
 * timers exist here. Kept as its own subscriber so the once-a-second tick
 * re-renders this leaf only — never the whole reader screen.
 */
import { useEffect, useState } from "react";
import { Animated } from "react-native";

import { useAppStore, useToastStore } from "@/stores/app-store";
import { useFocusStore } from "@/stores/focus-store";

import { BreakCard, FocusPill } from "./focus";

/** How often the pill checks in, and for how long it stays. */
const PILL_EVERY_SEC = 5 * 60;
const PILL_SHOW_SEC = 8;

export function FocusChrome({
  onExit,
  pillVisible,
}: {
  onExit: () => void;
  /** Hide the pill while the toolbar is out — its ◎ button shows the state. */
  pillVisible: boolean;
}) {
  const active = useFocusStore((s) => s.active);
  const sessionSec = useFocusStore((s) => s.sessionSec);
  const breakVisible = useFocusStore((s) => s.breakVisible);
  const dismissBreak = useFocusStore((s) => s.dismissBreak);
  const fmTimer = useAppStore((s) => s.fmTimer);
  const showToast = useToastStore((s) => s.showToast);

  const showPill =
    active && pillVisible && sessionSec % PILL_EVERY_SEC < PILL_SHOW_SEC;

  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, {
      toValue: showPill ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [showPill, fade]);

  if (!active) return null;

  return (
    <>
      {/* absolute fill so the pill's own absolute layout resolves against
          the screen; taps pass through everywhere but the pill itself */}
      <Animated.View
        pointerEvents={showPill ? "box-none" : "none"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 32,
          opacity: fade,
          transform: [
            {
              translateY: fade.interpolate({
                inputRange: [0, 1],
                outputRange: [-10, 0],
              }),
            },
          ],
        }}
      >
        <FocusPill onExit={onExit} sessionSec={sessionSec} timerOn={fmTimer} />
      </Animated.View>
      {breakVisible ? (
        <BreakCard
          onSkip={dismissBreak}
          onTake={() => {
            dismissBreak();
            showToast("Enjoy 3 minutes 🌿 I'll hold your place");
          }}
        />
      ) : null}
    </>
  );
}
