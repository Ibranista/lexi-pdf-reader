/**
 * Focus-session chrome for the PDF reader: the status pill (with session
 * timer) and the break suggestion card, driven by the focus store.
 *
 * Kept as its own subscriber so the once-a-second timer tick re-renders this
 * leaf only — never the whole reader screen.
 */
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useFocusStore } from "@/stores/focus-store";

import { BreakCard, FocusPill } from "./focus";

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

  if (!active) return null;

  return (
    <>
      {pillVisible ? (
        <FocusPill onExit={onExit} sessionSec={sessionSec} timerOn={fmTimer} />
      ) : null}
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
