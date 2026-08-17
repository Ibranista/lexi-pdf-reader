import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SpeechClip } from "@/services/lexi-ai";

const FINISH_GRACE_MS = 700;

const SETTLE_MS = 250;

export interface SpeechQueue {
  speaking: boolean;
  current: string;
  reset: () => void;
  enqueue: (clip: SpeechClip) => void;
  seal: () => boolean;
  stop: () => void;
}

export function useSpeechQueue(): SpeechQueue {
  const [speaking, setSpeaking] = useState(false);
  const [current, setCurrent] = useState("");

  const playerRef = useRef<AudioPlayer | null>(null);
  const held = useRef(new Map<number, SpeechClip>());
  const nextSeq = useRef(0);
  const playing = useRef(false);
  const sealed = useRef(false);
  const abandoned = useRef(true);
  const startedAt = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const pump = useCallback(() => {
    if (playing.current || abandoned.current) return;
    const clip = held.current.get(nextSeq.current);
    if (!clip) {
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
