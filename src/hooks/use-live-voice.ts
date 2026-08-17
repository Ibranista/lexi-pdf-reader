/**
 * Live voice: talking with Liqrai instead of typing at it.
 *
 * The loop is listen → think → speak → listen. The reader talks, stops talking,
 * and is answered out loud; the mic reopens on its own when the answer ends, so
 * a conversation is a conversation rather than a series of button presses. The
 * text keeps arriving in the transcript throughout — this is a second channel
 * onto the same chat, never a separate mode with its own history.
 *
 * Deliberately half duplex. Listening while the reply plays would feed Liqrai's
 * own voice back into the microphone, and echo cancellation is not something
 * `expo-audio` can do for us, so a reader who wants to interrupt taps once.
 *
 * This hook owns the only recorder in the panel — press-to-talk uses the same
 * one through `mic`. Two `useAudioRecorder`s in one screen would contend for
 * the audio session, and the composer's mic and this one are never both wanted
 * at once anyway.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeechQueue } from "@/hooks/use-speech-queue";
import { useVoiceInput, type VoiceInput } from "@/hooks/use-voice-input";
import type { SpeechClip } from "@/services/lexi-ai";

/**
 * How long a pause has to run before the turn is handed over.
 *
 * Short enough that the reply doesn't feel like it is waiting the reader out,
 * long enough to survive thinking mid-sentence. Under about 700ms an ordinary
 * clause break ends the turn; much over 1.5s and every exchange drags.
 */
const PAUSE_MS = 1100;

export type LivePhase = "off" | "listening" | "thinking" | "speaking";

/** Runs one turn: hands the reader's words over, resolves when the reply ends. */
export type AskLive = (
  text: string,
  handlers: { onSpeech: (clip: SpeechClip) => void },
) => Promise<void>;

export interface LiveVoice {
  phase: LivePhase;
  /** True while live mode is on, whatever it is currently doing. */
  on: boolean;
  /** Live 0..1 loudness while listening, for the wave. */
  level: number;
  /** The sentence being spoken, so the panel can show what is being said. */
  saying: string;
  /** The shared recorder, for the composer's press-to-talk button. */
  mic: VoiceInput;
  start: () => void;
  stop: () => void;
  /**
   * Whether {@link interrupt} would do anything. False while the reply is still
   * being written — cutting in then would abandon a half-streamed answer, and
   * offering a control that quietly does nothing is worse than not offering it.
   */
  canInterrupt: boolean;
  /** Cut the reply short and take the turn back — the reader wants to talk. */
  interrupt: () => void;
}

export function useLiveVoice({
  ask,
  onDraft,
  onError,
}: {
  ask: AskLive;
  /** A press-to-talk transcript that ended itself, for the composer to hold. */
  onDraft: (text: string) => void;
  onError: (message: string) => void;
}): LiveVoice {
  const [on, setOn] = useState(false);
  // A turn is in flight — the reply is still being written. Audio for it may
  // already be playing, which is why this is tracked apart from `speaking`.
  const [turning, setTurning] = useState(false);
  const queue = useSpeechQueue();

  // Read inside callbacks that outlive the render they were made in: a turn
  // still transcribing when the reader hangs up must not start a reply.
  const liveRef = useRef(false);
  // Set while a reply is playing, so the mic reopens when that reply ends and
  // not on every other trip through idle.
  const spoke = useRef(false);
  // A recording already being transcribed when the reader hung up. Its words
  // were meant for a conversation that is over, so they go nowhere.
  const discard = useRef(false);

  // `stop` needs the microphone and the microphone's callbacks need `stop`, so
  // the two are tied together through refs rather than declaration order.
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
      // The quota wall — or any failure the hook can't act on — ends the
      // conversation rather than looping the mic back open behind an error.
      stopRef.current();
    },
    silenceMs: on ? PAUSE_MS : undefined,
  });

  const stop = useCallback(() => {
    liveRef.current = false;
    spoke.current = false;
    // `cancel` can't reach a clip that is already uploading; this is what keeps
    // its transcript from landing in the composer after the reader hung up.
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
        // Nothing to play — every clip failed to render, or the reply was
        // empty. There is no "finished speaking" coming to hand the turn back
        // on, so take it back here instead of leaving the reader in silence.
        if (!queue.seal()) {
          spoke.current = false;
          void mic.start();
        }
      } catch {
        // The panel surfaces what went wrong — it owns the transcript. Ending
        // live mode here is what stops a failing turn from reopening the mic
        // and failing again, on a loop, until the reader forces it closed.
        stopRef.current();
      } finally {
        setTurning(false);
      }
    },
    [ask, mic, queue],
  );

  // Kept current through effects rather than assigned mid-render: both are read
  // only from callbacks that fire long after the commit that set them.
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

  /**
   * Cut the reply off and listen instead. The turn is already saved server-side
   * and its text is already on screen, so what's dropped is the rest of the
   * audio — nothing the reader would have to ask for again.
   */
  const canInterrupt = on && queue.speaking && !turning;

  const interrupt = useCallback(() => {
    if (!liveRef.current) return;
    spoke.current = false;
    queue.stop();
    void mic.start();
  }, [mic, queue]);

  // Hand the turn back when the reply finishes speaking. This is the loop:
  // without it the reader reaches for the mic after every answer, which is the
  // thing live mode exists not to make them do.
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

  // Closing the panel mid-conversation must not leave a mic open or a voice
  // talking to nobody.
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
