import { useAppStore, useToastStore } from "@/stores/app-store";
import { useFocusStore } from "@/stores/focus-store";

import { BreakCard, FocusPill } from "./focus";

export function FocusChrome({
  onExit,
  pillVisible,
}: {
  onExit: () => void;
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
