import { create } from 'zustand';

import { useAppStore } from './app-store';

const BREAK_AT_SEC = 25 * 60;

interface FocusState {
  active: boolean;
  sessionSec: number;
  breakVisible: boolean;
  start: () => void;
  exit: () => void;
  dismissBreak: () => void;
}

let tick: ReturnType<typeof setInterval> | undefined;
let breakShown = false;

export const useFocusStore = create<FocusState>()((set, get) => ({
  active: false,
  sessionSec: 0,
  breakVisible: false,

  start: () => {
    if (get().active) return;
    breakShown = false;
    set({ active: true, sessionSec: 0, breakVisible: false });
    clearInterval(tick);
    tick = setInterval(() => {
      const app = useAppStore.getState();
      if (!app.fmTimer) return;
      const sessionSec = get().sessionSec + 1;
      if (!breakShown && sessionSec >= BREAK_AT_SEC && app.focusRem) {
        breakShown = true;
        set({ sessionSec, breakVisible: true });
      } else {
        set({ sessionSec });
      }
    }, 1000);
  },

  exit: () => {
    clearInterval(tick);
    tick = undefined;
    set({ active: false, sessionSec: 0, breakVisible: false });
  },

  dismissBreak: () => set({ breakVisible: false }),
}));
