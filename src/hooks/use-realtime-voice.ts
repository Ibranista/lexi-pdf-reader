import {
  addExpoTwoWayAudioEventListener,
  initialize,
  playPCMData,
  requestMicrophonePermissionsAsync,
  restart,
  tearDown,
  toggleRecording,
} from "@speechmatics/expo-two-way-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import {
  liveAudioMessage,
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
  | "off"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking";

export interface RealtimeVoiceHandlers {
  onAsk: (text: string) => void;
  onReplyProgress: (text: string) => void;
  onTurn: (turn: { message: string; reply: string }) => void;
  onError: (message: string) => void;
}

export interface RealtimeVoice {
  phase: RealtimePhase;
  on: boolean;
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

type Subscription = { remove: () => void } | null;

export function useRealtimeVoice({
  context,
  handlers,
}: {
  context: () => RealtimeContext | null;
  handlers: RealtimeVoiceHandlers;
}): RealtimeVoice {
  const [phase, setPhase] = useState<RealtimePhase>("off");

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
    if (message && answer) handlersRef.current.onTurn({ message, reply: answer });
  }, []);

  const beginAnswer = useCallback(() => {
    if (answering.current) return;
    answering.current = true;
    clearThinking();
    reply.current = "";
    const text = asked.current.trim();
    if (text) handlersRef.current.onAsk(text);
  }, []);

  const teardown = useCallback(() => {
    closing.current = true;
    clearThinking();
    micSub.current?.remove();
    micSub.current = null;
    socket.current?.close();
    socket.current = null;
    if (pumpTimer.current) clearInterval(pumpTimer.current);
    pumpTimer.current = null;
    flushPlayback();
    try {
      toggleRecording(false);
      tearDown();
    } catch {}
    asked.current = "";
    reply.current = "";
    answering.current = false;
  }, [flushPlayback]);

  const stop = useCallback(() => {
    teardown();
    setPhase("off");
  }, [teardown]);

  const handleMessage = useCallback(
    (message: LiveServerMessage) => {
      const content = message.serverContent;
      if (!content) {
        if (message.error) {
          handlersRef.current.onError(
            message.error.message ?? "The voice connection dropped.",
          );
        }
        return;
      }

      const heard = content.inputTranscription?.text;
      if (heard) {
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
      }
    },
    [beginAnswer, enqueue, finishTurn, flushPlayback, pump],
  );

  const start = useCallback(async () => {
    const book = contextRef.current();
    if (!book || socket.current) return;

    closing.current = false;
    setPhase("connecting");
    try {
      const session = await openRealtimeSession(book);

      const permission = await requestMicrophonePermissionsAsync();
      if (!permission.granted) {
        throw new Error("Liqrai needs the microphone for a live conversation.");
      }

      await initialize();
      if (Platform.OS === "ios") restart();

      const ws = new WebSocket(liveSocketUrl(session.clientSecret));
      ws.binaryType = "arraybuffer";
      socket.current = ws;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("The voice line took too long to open.")),
          SETUP_TIMEOUT_MS,
        );
        let ready = false;

        ws.onopen = () => ws.send(JSON.stringify(liveSetupMessage(session.model)));

        ws.onmessage = (event) => {
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
            clearTimeout(timer);
            resolve();
            return;
          }
          handleMessage(message);
        };

        ws.onerror = () => {
          if (ready) return;
          clearTimeout(timer);
          reject(new Error("Couldn't open the voice line."));
        };

        ws.onclose = (event) => {
          socket.current = null;
          if (!ready) {
            clearTimeout(timer);
            reject(
              new Error(event.reason || "Couldn't open the voice line."),
            );
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

      micSub.current = addExpoTwoWayAudioEventListener(
        "onMicrophoneData",
        (event) => {
          const ws = socket.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify(liveAudioMessage(bytesToBase64(event.data))));
        },
      );
      toggleRecording(true);

      setPhase("listening");
    } catch (error) {
      teardown();
      setPhase("off");
      handlersRef.current.onError(
        error instanceof Error ? error.message : "Couldn't start the voice line.",
      );
      if (error && (error as { name?: string }).name === "AiQuotaError") {
        throw error;
      }
    }
  }, [handleMessage, teardown]);

  const teardownRef = useRef(teardown);
  useEffect(() => {
    teardownRef.current = teardown;
  }, [teardown]);
  useEffect(() => () => teardownRef.current(), []);

  return {
    on: phase !== "off",
    phase,
    start: () => {
      void start();
    },
    stop,
  };
}
