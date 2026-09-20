import {
  addExpoTwoWayAudioEventListener,
  initialize,
  playPCMData,
  requestMicrophonePermissionsAsync,
  tearDown,
  toggleRecording,
} from "@speechmatics/expo-two-way-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  acquireAudioSession,
  ownsAudioSession,
  releaseAudioSession,
} from "@/utils/audio-session";
import { useToastStore } from "@/stores/app-store";

import {
  liveAudioMessage,
  liveContextMessage,
  liveSetupMessage,
  liveSocketUrl,
  openRealtimeSession,
  type LiveServerMessage,
  type RealtimeContext,
} from "@/services/realtime";
import {
  base64ToBytes,
  bytesToBase64,
  createResampler,
  rateOf,
  utf8Decode,
} from "@/utils/pcm";

export type RealtimePhase =
  | "paused"
  | "off"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking";

export interface RealtimeVoiceHandlers {
  onAsk: (text: string, context: RealtimeContext | null) => void;
  onReplyProgress: (text: string) => void;
  onTurn: (turn: {
    message: string;
    reply: string;
    context: RealtimeContext | null;
  }) => void;
  onError: (message: string) => void;
  onTurnEnd?: () => void;
}

export interface RealtimeVoice {
  phase: RealtimePhase;
  on: boolean;
  level: number;
  muted: boolean;
  microphoneActive: boolean;
  toggleMute: () => void;
  pause: () => void;
  start: () => void;
  stop: () => void;
}

const PLAYER_RATE = 16000;
const BYTES_PER_MS = (PLAYER_RATE * 2) / 1000;

const LEAD_MS = 300;
const SLICE_BYTES = 100 * BYTES_PER_MS;
const PUMP_MS = 50;

const THINKING_AFTER_MS = 700;

const SETUP_TIMEOUT_MS = 10000;

const INACTIVITY_MS = 5 * 60 * 1000;
const PERMISSION_RESUME_GRACE_MS = 800;
const LEFT_BOOK_REASON =
  "Conversation paused because you left the book. Tap Resume when you return.";
const BACKGROUNDED_REASON =
  "Conversation paused while the app was in the background. Tap Resume to pick it up.";
let pausedBook: { docKey: string; expires: number } | null = null;

type Subscription = { remove: () => void } | null;

export function useRealtimeVoice({
  context,
  handlers,
}: {
  context: () => RealtimeContext | null;
  handlers: RealtimeVoiceHandlers;
}): RealtimeVoice {
  const [phase, setPhase] = useState<RealtimePhase>(() =>
    pausedBook &&
    pausedBook.docKey === context()?.docKey &&
    pausedBook.expires > Date.now()
      ? "paused"
      : "off",
  );
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const mutedRef = useRef(false);
  const owner = useRef(Symbol("reader-voice"));
  const starting = useRef(false);
  const prompting = useRef(false);
  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const focused = useRef(false);
  const active = useRef(false);
  const lastActivity = useRef(0);
  const turnContext = useRef<RealtimeContext | null>(null);
  const sentContext = useRef("");
  const sentBook = useRef<RealtimeContext | null>(null);
  const sessionDoc = useRef<string | null>(null);
  const setupCancel = useRef<(() => void) | null>(null);

  const socket = useRef<WebSocket | null>(null);
  const micSub = useRef<Subscription>(null);
  const closing = useRef(false);

  const asked = useRef("");
  const reply = useRef("");
  const answering = useRef(false);
  const thinkingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resampler = useRef(createResampler(PLAYER_RATE));
  const queue = useRef<Uint8Array[]>([]);
  const playedUntil = useRef(0);
  const pumpTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pumpRef = useRef<() => void>(() => {});

  const handlersRef = useRef(handlers);
  const contextRef = useRef(context);
  useEffect(() => {
    handlersRef.current = handlers;
    contextRef.current = context;
  }, [context, handlers]);

  const clearThinking = () => {
    if (thinkingTimer.current) clearTimeout(thinkingTimer.current);
    thinkingTimer.current = null;
  };

  const pump = useCallback(() => {
    const now = Date.now();
    if (playedUntil.current < now) playedUntil.current = now;

    while (queue.current.length && playedUntil.current - now < LEAD_MS) {
      const slice = queue.current.shift()!;
      playPCMData(slice);
      playedUntil.current += slice.length / BYTES_PER_MS;
    }

    const draining = queue.current.length > 0 || playedUntil.current > now;
    if (draining && !pumpTimer.current) {
      pumpTimer.current = setInterval(() => pumpRef.current(), PUMP_MS);
    } else if (!draining && pumpTimer.current) {
      clearInterval(pumpTimer.current);
      pumpTimer.current = null;
      if (!answering.current) {
        setPhase((current) => (current === "speaking" ? "listening" : current));
      }
    }
  }, []);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (base64: string, mimeType?: string) => {
      const pcm = resampler.current.push(
        base64ToBytes(base64),
        rateOf(mimeType),
      );
      for (let i = 0; i < pcm.length; i += SLICE_BYTES) {
        queue.current.push(pcm.slice(i, i + SLICE_BYTES));
      }
      pump();
    },
    [pump],
  );

  const flushPlayback = useCallback(() => {
    queue.current = [];
    playedUntil.current = 0;
    resampler.current.reset();
  }, []);

  const finishTurn = useCallback(() => {
    clearThinking();
    const message = asked.current.trim();
    const answer = reply.current.trim();
    asked.current = "";
    reply.current = "";
    answering.current = false;
    if (message && answer)
      handlersRef.current.onTurn({
        message,
        reply: answer,
        context: turnContext.current,
      });
    turnContext.current = null;
    handlersRef.current.onTurnEnd?.();
  }, []);

  const beginAnswer = useCallback(() => {
    if (answering.current) return;
    answering.current = true;
    clearThinking();
    reply.current = "";
    const text = asked.current.trim();
    if (text) handlersRef.current.onAsk(text, turnContext.current);
  }, []);

  const endPrompt = useCallback(() => {
    prompting.current = false;
    if (promptTimer.current) clearTimeout(promptTimer.current);
    promptTimer.current = null;
  }, []);

  const teardown = useCallback(() => {
    endPrompt();
    closing.current = true;
    active.current = false;
    generation.current += 1;
    setupCancel.current?.();
    setupCancel.current = null;
    clearThinking();
    micSub.current?.remove();
    micSub.current = null;
    socket.current?.close();
    socket.current = null;
    if (pumpTimer.current) clearInterval(pumpTimer.current);
    pumpTimer.current = null;
    flushPlayback();
    if (ownsAudioSession(owner.current)) {
      try {
        toggleRecording(false);
      } catch {}
      try {
        tearDown();
      } catch {}
    }
    if (!starting.current) releaseAudioSession(owner.current);
    asked.current = "";
    reply.current = "";
    answering.current = false;
    turnContext.current = null;
    sentContext.current = "";
  }, [endPrompt, flushPlayback]);

  const stop = useCallback(() => {
    if (pausedBook?.docKey === contextRef.current()?.docKey) pausedBook = null;
    teardown();
    setPhase("off");
  }, [teardown]);

  useEffect(() => {
    if (active.current && context()?.docKey !== sessionDoc.current) stop();
  }, [context, stop]);

  const pause = useCallback(
    (reason = LEFT_BOOK_REASON) => {
      if (!active.current && !starting.current) return;
      const book = contextRef.current();
      if (book)
        pausedBook = {
          docKey: book.docKey,
          expires: Date.now() + INACTIVITY_MS,
        };
      teardown();
      setPhase("paused");
      useToastStore.getState().showToast(reason);
    },
    [teardown],
  );

  const toggleMute = useCallback(() => {
    if (!active.current || starting.current || !ownsAudioSession(owner.current))
      return;
    const next = !mutedRef.current;
    mutedRef.current = next;
    try {
      const recording = toggleRecording(!next);
      if (recording !== !next)
        throw new Error("Microphone did not change state.");
      setMuted(next);
      lastActivity.current = Date.now();
      if (next && socket.current?.readyState === WebSocket.OPEN) {
        socket.current.send(
          JSON.stringify({ realtimeInput: { audioStreamEnd: true } }),
        );
      }
    } catch {
      stop();
      handlersRef.current.onError(
        "Couldn't change the microphone. The conversation was ended.",
      );
    }
  }, [stop]);

  const updateContext = useCallback(() => {
    const book = contextRef.current();
    const ws = socket.current;
    if (
      !book ||
      book.docKey !== sessionDoc.current ||
      !active.current ||
      !ws ||
      ws.readyState !== WebSocket.OPEN
    )
      return;
    if (asked.current || answering.current) return;
    const message = JSON.stringify(liveContextMessage(book));
    if (message === sentContext.current) return;
    ws.send(message);
    sentContext.current = message;
    sentBook.current = { ...book };
  }, []);

  const handleMessage = useCallback(
    (message: LiveServerMessage) => {
      if (closing.current) return;
      const content = message.serverContent;
      if (!content) {
        if (message.error) {
          stop();
          handlersRef.current.onError(
            message.error.message ?? "The voice connection dropped.",
          );
        }
        return;
      }

      const heard = content.inputTranscription?.text;
      if (heard) {
        lastActivity.current = Date.now();
        if (!asked.current) turnContext.current = sentBook.current;
        asked.current += heard;
        if (!answering.current) {
          setPhase("listening");
          clearThinking();
          thinkingTimer.current = setTimeout(
            () => setPhase("thinking"),
            THINKING_AFTER_MS,
          );
        }
      }

      for (const part of content.modelTurn?.parts ?? []) {
        if (!part.inlineData?.data) continue;
        beginAnswer();
        setPhase("speaking");
        enqueue(part.inlineData.data, part.inlineData.mimeType);
        lastActivity.current = Date.now();
      }

      const said = content.outputTranscription?.text;
      if (said) {
        beginAnswer();
        reply.current += said;
        handlersRef.current.onReplyProgress(reply.current);
      }

      if (content.interrupted) {
        flushPlayback();
        finishTurn();
        setPhase("listening");
        return;
      }

      if (content.turnComplete) {
        finishTurn();
        pump();
        if (!queue.current.length && playedUntil.current <= Date.now())
          setPhase("listening");
      }
    },
    [beginAnswer, enqueue, finishTurn, flushPlayback, pump, stop],
  );

  const start = useCallback(async () => {
    const book = contextRef.current();
    if (
      !book ||
      socket.current ||
      starting.current ||
      !focused.current ||
      AppState.currentState !== "active"
    )
      return;
    if (!acquireAudioSession(owner.current)) {
      handlersRef.current.onError(
        "The previous voice connection is still closing. Try again in a moment.",
      );
      return;
    }
    starting.current = true;
    active.current = true;
    const attempt = ++generation.current;
    const cancelled = () =>
      attempt !== generation.current ||
      !focused.current ||
      (!prompting.current && AppState.currentState !== "active");
    lastActivity.current = Date.now();
    pausedBook = null;
    sessionDoc.current = book.docKey;
    mutedRef.current = false;
    setMuted(false);

    closing.current = false;
    setPhase("connecting");
    try {
      prompting.current = true;
      let permission;
      try {
        permission = await requestMicrophonePermissionsAsync();
      } finally {
        if (AppState.currentState === "active") endPrompt();
        else promptTimer.current = setTimeout(endPrompt, PERMISSION_RESUME_GRACE_MS);
      }
      if (cancelled()) return;
      if (!permission.granted) {
        throw new Error(
          "Microphone permission is required. Enable it in your device Settings to talk to Liqrai.",
        );
      }

      const session = await openRealtimeSession(book);
      if (cancelled()) return;
      const initialized = await initialize();
      if (cancelled()) return;
      if (initialized === false) throw new Error("Couldn't initialize audio.");
      toggleRecording(false);

      const ws = new WebSocket(liveSocketUrl(session.clientSecret));
      ws.binaryType = "arraybuffer";
      socket.current = ws;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("The voice line took too long to open.")),
          SETUP_TIMEOUT_MS,
        );
        let ready = false;
        setupCancel.current = () => {
          clearTimeout(timer);
          reject(new Error("Voice connection cancelled."));
        };

        ws.onopen = () => {
          if (cancelled()) return;
          ws.send(JSON.stringify(liveSetupMessage(session.model)));
        };

        ws.onmessage = (event) => {
          if (cancelled()) return;
          let message: LiveServerMessage;
          try {
            message = JSON.parse(
              typeof event.data === "string"
                ? event.data
                : utf8Decode(new Uint8Array(event.data as ArrayBuffer)),
            );
          } catch {
            return;
          }
          if (!ready && message.setupComplete) {
            ready = true;
            setupCancel.current = null;
            clearTimeout(timer);
            resolve();
            return;
          }
          handleMessage(message);
        };

        ws.onerror = () => {
          if (ready) {
            if (!cancelled()) {
              stop();
              handlersRef.current.onError("The voice connection dropped.");
            }
            return;
          }
          clearTimeout(timer);
          reject(new Error("Couldn't open the voice line."));
        };

        ws.onclose = (event) => {
          if (socket.current !== ws) return;
          socket.current = null;
          if (!ready) {
            clearTimeout(timer);
            reject(new Error(event.reason || "Couldn't open the voice line."));
            return;
          }
          if (closing.current) return;
          teardown();
          setPhase("off");
          handlersRef.current.onError(
            event.reason || "The voice connection dropped.",
          );
        };
      });

      if (cancelled()) return;
      updateContext();
      micSub.current = addExpoTwoWayAudioEventListener(
        "onMicrophoneData",
        (event) => {
          const ws = socket.current;
          if (
            cancelled() ||
            mutedRef.current ||
            !active.current ||
            !ws ||
            ws.readyState !== WebSocket.OPEN
          )
            return;
          ws.send(JSON.stringify(liveAudioMessage(bytesToBase64(event.data))));
        },
      );
      if (!toggleRecording(true))
        throw new Error("Could not start the microphone.");

      setPhase("listening");
    } catch (error) {
      if (cancelled()) return;
      teardown();
      setPhase("off");
      handlersRef.current.onError(
        error instanceof Error
          ? error.message
          : "Couldn't start the voice line.",
      );
    } finally {
      starting.current = false;
      if (cancelled()) teardown();
    }
  }, [endPrompt, handleMessage, stop, teardown, updateContext]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (pausedBook && pausedBook.expires <= Date.now()) {
        pausedBook = null;
        setPhase("off");
      }
      return () => {
        focused.current = false;
        pause();
      };
    }, [pause]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        endPrompt();
        return;
      }
      if (prompting.current) return;
      if (state === "background") pause(BACKGROUNDED_REASON);
    });
    return () => subscription.remove();
  }, [endPrompt, pause]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (
        active.current &&
        Date.now() - lastActivity.current >= INACTIVITY_MS
      ) {
        stop();
        handlersRef.current.onError(
          "Conversation ended after five minutes of inactivity.",
        );
      } else if (
        phase === "paused" &&
        (!pausedBook || pausedBook.expires <= Date.now())
      ) {
        stop();
      }
      if (active.current && !starting.current) updateContext();
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, stop, updateContext]);

  useEffect(() => {
    const quantise = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 20) / 20;
    const listen = (name: "onInputVolumeLevelData" | "onOutputVolumeLevelData") =>
      addExpoTwoWayAudioEventListener(name, (event) => {
        if (!active.current) return;
        if (name === "onInputVolumeLevelData" && mutedRef.current) return;
        setLevel((current) => {
          const next = quantise(event.data);
          return next === current ? current : next;
        });
      });
    const subscriptions = [
      listen("onInputVolumeLevelData"),
      listen("onOutputVolumeLevelData"),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  useEffect(() => {
    if (!active.current) setLevel(0);
  }, [phase]);

  useEffect(() => {
    const subscription = addExpoTwoWayAudioEventListener(
      "onAudioInterruption",
      () => {
        if (ownsAudioSession(owner.current))
          pause(
            "Conversation paused because audio was interrupted. Tap Resume to continue.",
          );
      },
    );
    return () => subscription.remove();
  }, [pause]);

  useEffect(
    () => () => {
      pause();
      teardown();
    },
    [pause, teardown],
  );

  return {
    on: phase !== "off" && phase !== "paused",
    level: phase === "off" || phase === "paused" ? 0 : level,
    muted,
    microphoneActive:
      !muted && ["listening", "thinking", "speaking"].includes(phase),
    toggleMute,
    pause,
    phase,
    start: () => {
      void start();
    },
    stop,
  };
}
