import { useCallback, useEffect, useRef, useState } from "react";
import InCallManager from "react-native-incall-manager";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  type MediaStream,
} from "react-native-webrtc";

import {
  EVENT_CHANNEL,
  exchangeSdp,
  isTranscriptDelta,
  isTranscriptDone,
  isUserTranscript,
  openRealtimeSession,
  type RealtimeContext,
  type RealtimeEvent,
} from "@/services/realtime";

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

export function useRealtimeVoice({
  context,
  handlers,
}: {
  context: () => RealtimeContext | null;
  handlers: RealtimeVoiceHandlers;
}): RealtimeVoice {
  const [phase, setPhase] = useState<RealtimePhase>("off");

  const pc = useRef<RTCPeerConnection | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const channel = useRef<ReturnType<
    RTCPeerConnection["createDataChannel"]
  > | null>(null);

  const asked = useRef("");
  const reply = useRef("");

  const handlersRef = useRef(handlers);
  const contextRef = useRef(context);
  useEffect(() => {
    handlersRef.current = handlers;
    contextRef.current = context;
  }, [context, handlers]);

  const teardown = useCallback(() => {
    channel.current?.close();
    channel.current = null;
    mic.current?.getTracks().forEach((track) => track.stop());
    mic.current = null;
    pc.current?.close();
    pc.current = null;
    InCallManager.stop();
    asked.current = "";
    reply.current = "";
  }, []);

  const stop = useCallback(() => {
    teardown();
    setPhase("off");
  }, [teardown]);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    const { type } = event;

    if (type === "input_audio_buffer.speech_started") {
      setPhase("listening");
      return;
    }
    if (type === "input_audio_buffer.speech_stopped") {
      setPhase("thinking");
      return;
    }
    if (isUserTranscript(type)) {
      const text = (event.transcript ?? "").trim();
      if (!text) return;
      asked.current = text;
      reply.current = "";
      handlersRef.current.onAsk(text);
      return;
    }
    if (isTranscriptDelta(type)) {
      setPhase("speaking");
      reply.current += event.delta ?? "";
      handlersRef.current.onReplyProgress(reply.current);
      return;
    }
    if (isTranscriptDone(type)) {
      if (event.transcript) reply.current = event.transcript;
      handlersRef.current.onReplyProgress(reply.current);
      return;
    }
    if (type === "response.done") {
      const message = asked.current.trim();
      const answer = reply.current.trim();
      asked.current = "";
      reply.current = "";
      setPhase("listening");
      if (message && answer) handlersRef.current.onTurn({ message, reply: answer });
      return;
    }
    if (type === "error") {
      handlersRef.current.onError(
        event.error?.message ?? "The voice connection dropped.",
      );
    }
  }, []);

  const start = useCallback(async () => {
    const book = contextRef.current();
    if (!book || pc.current) return;

    setPhase("connecting");
    try {
      const session = await openRealtimeSession(book);

      InCallManager.start({ media: "audio" });
      InCallManager.setForceSpeakerphoneOn(true);

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.current = connection;

      const stream = await mediaDevices.getUserMedia({ audio: true });
      mic.current = stream;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));

      const events = connection.createDataChannel(EVENT_CHANNEL);
      channel.current = events;
      events.onmessage = (message: unknown) => {
        try {
          handleEvent(JSON.parse((message as { data: string }).data));
        } catch {}
      };

      const offer = await connection.createOffer({});
      await connection.setLocalDescription(offer);
      const answer = await exchangeSdp(offer.sdp ?? "", session.clientSecret);
      await connection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: answer }),
      );

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
  }, [handleEvent, teardown]);

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
