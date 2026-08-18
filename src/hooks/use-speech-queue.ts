/**
 * Plays a live reply's clips back to back, in the order they were *spoken*
 * rather than the order they arrived.
 *
 * The server voices each sentence as it is written and doesn't wait for one
 * clip before starting the next, so a repeated sentence — a cache hit — can
 * come back before an earlier, fresh one. Playing on arrival would reorder the
 * answer, so clips are held by `seq` and released in sequence.
 *
 * Playback is `expo-audio`'s own player rather than the off-screen WebView the
 * chat bubbles use for their speaker button. That trick exists to avoid a
 * native module; here the module is already in the build for the recorder, and
 * a queue needs something the WebView can't give — a reliable "this clip
 * finished" to hand the next one off on.
 *
 * The queue is scoped to one turn: `reset` opens it, `enqueue` fills it, `seal`
 * says no more are coming, and `stop` abandons whatever is left.
 */
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SpeechClip } from "@/services/lexi-ai";

/**
 * How long past a clip's own length to wait before giving up on its "finished"
 * event and moving on anyway.
 *
 * `didJustFinish` is the normal signal. This is the net under it: one clip
 * whose event never arrives would otherwise end the conversation, with the
 * reader looking at a panel that says it is speaking and hearing nothing.
 */
const FINISH_GRACE_MS = 700;

/**
 * A clip is never considered finished within this long of being started.
 *
 * `replace` swaps the source under a player that may still have an unread
 * status update queued from the clip before it. Honouring that update would
 * skip a sentence of the answer; ignoring the first moments costs nothing,
 * because the watchdog still covers a clip shorter than this.
 */
const SETTLE_MS = 250;

export interface SpeechQueue {
  /** True from the first clip until the last one has finished playing. */
  speaking: boolean;
  /** The sentence being spoken right now, for the panel to show. */
  current: string;
  /** Open the queue for a new turn, dropping anything left from the last one. */
  reset: () => void;
  /** Hand over a clip. Held until every earlier one has played. */
  enqueue: (clip: SpeechClip) => void;
  /**
   * No more clips are coming. Returns whether the queue will keep talking — a
   * turn whose clips all failed to render answers false, and the caller has to
   * take the turn back itself rather than waiting for an end that never comes.
   */
  seal: () => boolean;
  /** Stop now and abandon the turn, including clips still to arrive. */
  stop: () => void;
}

export function useSpeechQueue(): SpeechQueue {
  const [speaking, setSpeaking] = useState(false);
  const [current, setCurrent] = useState("");

  const playerRef = useRef<AudioPlayer | null>(null);
  // Clips that have arrived but whose turn has not come, by seq.
  const held = useRef(new Map<number, SpeechClip>());
  const nextSeq = useRef(0);
  const playing = useRef(false);
  const sealed = useRef(false);
  // Set by `stop`: this turn is over and its remaining clips are not wanted,
  // including ones still in flight from the server.
  const abandoned = useRef(true);
  const startedAt = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reads the latest `pump` from inside the player's status listener, which is
  // attached once and would otherwise hold the first render's copy forever.
  const pumpRef = useRef<() => void>(() => {});

  const clearWatchdog = () => {
    if (watchdog.current === null) return;
    clearTimeout(watchdog.current);
    watchdog.current = null;
  };

  const player = useCallback(() => {
    if (!playerRef.current) {
      const created = createAudioPlayer(null);
      created.addListener("playbackStatusUpdate", (status) => {
        if (!playing.current || Date.now() - startedAt.current < SETTLE_MS) {
          return;
        }
        if (status.didJustFinish) {
          clearWatchdog();
          playing.current = false;
          pumpRef.current();
          return;
        }
        // Arm the net once the clip's length is known: its remaining time plus
        // a little, refreshed on every update so it tracks buffering.
        if (!status.isLoaded || !status.duration) return;
        clearWatchdog();
        const remaining = Math.max(0, status.duration - status.currentTime);
        watchdog.current = setTimeout(
          () => {
            watchdog.current = null;
            if (!playing.current) return;
            playing.current = false;
            pumpRef.current();
          },
          remaining * 1000 + FINISH_GRACE_MS,
        );
      });
      playerRef.current = created;
    }
    return playerRef.current;
  }, []);

  /** Start the next clip if one is due, or end the turn if none is coming. */
  const pump = useCallback(() => {
    if (playing.current || abandoned.current) return;
    const clip = held.current.get(nextSeq.current);
    if (!clip) {
      // Sealed with nothing left to wait for: the reply has finished speaking.
      if (sealed.current && held.current.size === 0) {
        setSpeaking(false);
        setCurrent("");
      }
      return;
    }
    held.current.delete(nextSeq.current);
    nextSeq.current += 1;
    playing.current = true;
    startedAt.current = Date.now();
    setSpeaking(true);
    setCurrent(clip.text);
    const active = player();
    active.replace({ uri: clip.url });
    active.play();
  }, [player]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const reset = useCallback(() => {
    clearWatchdog();
    held.current.clear();
    nextSeq.current = 0;
    playing.current = false;
    sealed.current = false;
    abandoned.current = false;
  }, []);

  const enqueue = useCallback(
    (clip: SpeechClip) => {
      if (abandoned.current) return;
      held.current.set(clip.seq, clip);
      // The recorder leaves the route in call mode — quiet, and on iOS out of
      // the earpiece — so a reply played straight after listening would sound
      // broken. Claim it back before the first clip of the turn.
      if (!playing.current) {
        setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        }).catch(() => {});
      }
      pump();
    },
    [pump],
  );

  const seal = useCallback(() => {
    if (abandoned.current) return false;
    sealed.current = true;
    // A turn whose clips have all played already — or one that produced none at
    // all, because every render failed — ends here rather than hanging.
    pump();
    return playing.current || held.current.size > 0;
  }, [pump]);

  const stop = useCallback(() => {
    clearWatchdog();
    abandoned.current = true;
    held.current.clear();
    nextSeq.current = 0;
    playing.current = false;
    sealed.current = false;
    setSpeaking(false);
    setCurrent("");
    playerRef.current?.pause();
  }, []);

  // Leaving mid-sentence must not leave a voice playing to an empty panel.
  useEffect(
    () => () => {
      clearWatchdog();
      playerRef.current?.remove();
      playerRef.current = null;
    },
    [],
  );

  return { current, enqueue, reset, seal, speaking, stop };
}
