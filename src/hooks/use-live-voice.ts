import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeechQueue } from "@/hooks/use-speech-queue";
import { useVoiceInput, type VoiceInput } from "@/hooks/use-voice-input";
import type { SpeechClip } from "@/services/lexi-ai";

const PAUSE_MS = 1100;

export type LivePhase = "off" | "listening" | "thinking" | "speaking";

export type AskLive = (
  text: string,
  handlers: { onSpeech: (clip: SpeechClip) => void },
) => Promise<void>;

export interface LiveVoice {
  phase: LivePhase;
  on: boolean;
  level: number;
  saying: string;
  mic: VoiceInput;
  start: () => void;
  stop: () => void;
  canInterrupt: boolean;
  interrupt: () => void;
}

export function useLiveVoice({
  ask,
  onDraft,
  onError,
}: {
  ask: AskLive;
  onDraft: (text: string) => void;
  onError: (message: string) => void;
}): LiveVoice {
  const [on, setOn] = useState(false);
  const [turning, setTurning] = useState(false);
  const queue = useSpeechQueue();

  const liveRef = useRef(false);
  const spoke = useRef(false);
  const discard = useRef(false);

  const runTurnRef = useRef<(text: string) => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  const mic = useVoiceInput(onError, {
    onTranscript: (text) => {
      if (discard.current) {
        discard.current = false;
        return;
      }
      if (!liveRef.current) {
        onDraft(text);
        return;
      }
      runTurnRef.current(text);
    },
    onTranscriptError: () => {
      stopRef.current();
    },
    silenceMs: on ? PAUSE_MS : undefined,
  });

  const stop = useCallback(() => {
    liveRef.current = false;
    spoke.current = false;
    discard.current = mic.phase === "transcribing";
    setOn(false);
    queue.stop();
    void mic.cancel();
  }, [mic, queue]);

  const runTurn = useCallback(
    async (text: string) => {
      setTurning(true);
      try {
        queue.reset();
        await ask(text, { onSpeech: queue.enqueue });
        if (!queue.seal()) {
          spoke.current = false;
          void mic.start();
        }
      } catch {
        stopRef.current();
      } finally {
        setTurning(false);
      }
    },
    [ask, mic, queue],
  );

  useEffect(() => {
    stopRef.current = stop;
    runTurnRef.current = (text: string) => void runTurn(text);
  }, [runTurn, stop]);

  const start = useCallback(() => {
    liveRef.current = true;
    spoke.current = false;
    setOn(true);
    void mic.start();
  }, [mic]);

  const canInterrupt = on && queue.speaking && !turning;

  const interrupt = useCallback(() => {
    if (!liveRef.current) return;
    spoke.current = false;
    queue.stop();
    void mic.start();
  }, [mic, queue]);

  useEffect(() => {
    if (!on) return;
    if (queue.speaking) {
      spoke.current = true;
      return;
    }
    if (!spoke.current) return;
    spoke.current = false;
    void mic.start();
  }, [mic, on, queue.speaking]);

  useEffect(() => () => stopRef.current(), []);

  const phase: LivePhase = !on
    ? "off"
    : queue.speaking
      ? "speaking"
      : mic.phase === "recording"
        ? "listening"
        : "thinking";

  return {
    canInterrupt,
    interrupt,
    level: mic.level,
    mic,
    on,
    phase,
    saying: queue.current,
    start,
    stop,
  };
}
