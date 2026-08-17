/**
 * A live, spoken conversation with Liqrai.
 *
 * The device holds a WebRTC call with OpenAI's realtime model: the reader's
 * voice goes up as it is spoken and the answer comes back as it is generated,
 * with the platform's own echo cancellation in between. That last part is what
 * the old pipeline could never offer — it had to stop listening while it
 * talked, so "interrupting" was a button. Here the reader can simply speak, and
 * the model stops.
 *
 * Turn-taking is the model's job too. The previous version watched a level
 * meter and guessed when a pause had gone on long enough, which either cut
 * people off or made them wait; the server decides from the audio itself.
 *
 * This hook owns the call and reports what is said. It does not own the
 * transcript — the panel does, the same one the typed chat writes into, so a
 * conversation held out loud is the same thread as one typed.
 */
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
  /** The reader's turn, transcribed — push it into the transcript. */
  onAsk: (text: string) => void;
  /** The reply so far, as it is spoken. Called with the whole text, not a delta. */
  onReplyProgress: (text: string) => void;
  /** The turn finished. Persisting and metering it is the caller's job. */
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
  /** The document the conversation is allowed to be about. */
  context: () => RealtimeContext | null;
  handlers: RealtimeVoiceHandlers;
}): RealtimeVoice {
  const [phase, setPhase] = useState<RealtimePhase>("off");

  const pc = useRef<RTCPeerConnection | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const channel = useRef<ReturnType<
    RTCPeerConnection["createDataChannel"]
  > | null>(null);

  // The turn being assembled. Refs, not state: these are written from the data
  // channel's callback many times a second and nothing renders from them
  // directly — the panel is told through `onReplyProgress`.
  const asked = useRef("");
  const reply = useRef("");

  // Read from callbacks that outlive the render that made them.
  const handlersRef = useRef(handlers);
  const contextRef = useRef(context);
  useEffect(() => {
    handlersRef.current = handlers;
    contextRef.current = context;
  }, [context, handlers]);

  const teardown = useCallback(() => {
    channel.current?.close();
    channel.current = null;
    // Every track, explicitly: closing the peer connection alone leaves the
    // microphone hot on Android, and a reader who ended the conversation
    // deserves the indicator in their status bar to go out with it.
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

  /** One event off the data channel. */
  const handleEvent = useCallback((event: RealtimeEvent) => {
    const { type } = event;

    if (type === "input_audio_buffer.speech_started") {
      // The reader has started talking — over the reply, if it was still going.
      // Nothing to cancel here: the model handles the interruption itself.
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
      // An interrupted response still said what it said, and the reader saw it
      // — keep it. A turn with nothing on one side is not a turn.
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

      // Route to the loudspeaker before any audio arrives. WebRTC puts Android
      // into communication mode, which is the earpiece — correct for a phone
      // call, wrong for someone holding a book in front of them.
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
        } catch {
          // A frame we can't read is one turn's worth of nothing, not a reason
          // to drop a conversation that is otherwise working.
        }
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
      // The wall is the panel's to raise — it owns the auth store and knows
      // whether it should close behind it.
      if (error && (error as { name?: string }).name === "AiQuotaError") {
        throw error;
      }
    }
  }, [handleEvent, teardown]);

  // Closing the panel mid-conversation must not leave a call up or a mic open.
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
