import {
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  acquireAudioSession,
  releaseAudioSession,
} from "@/utils/audio-session";
import { AiQuotaError, transcribe } from "@/services/lexi-ai";

const METER_INTERVAL_MS = 90;

const MAX_DURATION_MS = 60_000;

const MIN_DURATION_MS = 700;

const DB_FLOOR = -50;

const SPEECH_LEVEL = 0.28;
const SILENCE_LEVEL = 0.16;

const NO_SPEECH_TIMEOUT_MS = 7000;

function levelFrom(metering: number | undefined): number {
  if (metering === undefined || Number.isNaN(metering)) return 0;
  if (metering <= DB_FLOOR) return 0;
  if (metering >= 0) return 1;
  return (metering - DB_FLOOR) / -DB_FLOOR;
}

export type VoicePhase = "idle" | "recording" | "transcribing";

export interface VoiceInputOptions {
  silenceMs?: number;
  onTranscript?: (text: string) => void;
  onTranscriptError?: (error: unknown) => void;
}

export interface VoiceInput {
  level: number;
  seconds: number;
  phase: VoicePhase;
  permissionBlocked: boolean;
  start: () => Promise<void>;
  stop: () => Promise<string>;
  cancel: () => Promise<void>;
}

export function useVoiceInput(
  onError: (message: string) => void,
  options: VoiceInputOptions = {},
): VoiceInput {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const state = useAudioRecorderState(recorder, METER_INTERVAL_MS);

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const durationRef = useRef(0);
  useEffect(() => {
    durationRef.current = state.durationMillis ?? 0;
  }, [state.durationMillis]);
  const stoppingRef = useRef(false);
  const generation = useRef(0);
  const audioOwner = useRef(Symbol("dictation"));
  const starting = useRef(false);
  const recording = useRef(false);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const heardSpeech = useRef(false);
  const lastSpeechAt = useRef(0);

  const finishRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {}
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {}
  }, [recorder]);

  const start = useCallback(async () => {
    if (phase !== "idle" || starting.current) return;
    if (!acquireAudioSession(audioOwner.current)) {
      onError("End the current audio session before dictating.");
      return;
    }
    starting.current = true;
    const attempt = ++generation.current;
    const cancelled = () => attempt !== generation.current;
    try {
      const existing = await getRecordingPermissionsAsync();
      const granted =
        existing.granted || (await requestRecordingPermissionsAsync()).granted;

      if (cancelled()) return;
      if (!granted) {
        setPermissionBlocked(true);
        onError(
          "Liqrai needs the microphone to hear your question — enable it in Settings.",
        );
        return;
      }
      setPermissionBlocked(false);

      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        if (cancelled()) {
          await finishRecording();
          return;
        }
        await recorder.prepareToRecordAsync();
        if (cancelled()) {
          await finishRecording();
          return;
        }
        recorder.record();
        recording.current = true;
        stoppingRef.current = false;
        heardSpeech.current = false;
        lastSpeechAt.current = 0;
        setPhase("recording");
      } catch {
        await finishRecording();
        setPhase("idle");
        onError("Couldn't start recording just then");
      }
    } catch {
      if (!cancelled())
        onError(
          "Could not access the microphone. Check device permissions and try again.",
        );
    } finally {
      starting.current = false;
      if (!recording.current) releaseAudioSession(audioOwner.current);
    }
  }, [finishRecording, onError, phase, recorder]);

  const cancel = useCallback(async () => {
    generation.current += 1;
    if (!recording.current) return;
    recording.current = false;
    stoppingRef.current = true;
    setPhase("idle");
    await finishRecording();
    releaseAudioSession(audioOwner.current);
  }, [finishRecording]);

  const stop = useCallback(async (): Promise<string> => {
    if (phase !== "recording") return "";
    recording.current = false;
    const attempt = generation.current;
    stoppingRef.current = true;

    const heldFor = durationRef.current;
    await finishRecording();
    releaseAudioSession(audioOwner.current);
    const uri = recorder.uri;

    if (heldFor < MIN_DURATION_MS || !uri) {
      setPhase("idle");
      return "";
    }

    setPhase("transcribing");
    try {
      const audio = await new File(uri).base64();
      if (attempt !== generation.current) return "";
      const text = await transcribe({ audio, mimeType: "audio/m4a" });
      if (attempt !== generation.current) return "";
      if (!text) onError("Didn't catch that — try again");
      return text;
    } catch (error) {
      console.log("error-->", error);
      if (error instanceof AiQuotaError) throw error;
      onError("Couldn't transcribe that — check your connection");
      return "";
    } finally {
      setPhase("idle");
    }
  }, [finishRecording, onError, phase, recorder]);

  const selfStop = useCallback(async () => {
    try {
      const text = await stop();
      if (text) optionsRef.current.onTranscript?.(text);
    } catch (error) {
      optionsRef.current.onTranscriptError?.(error);
    }
  }, [stop]);

  useEffect(() => {
    if (phase !== "recording" || stoppingRef.current) return;
    if ((state.durationMillis ?? 0) < MAX_DURATION_MS) return;
    stoppingRef.current = true;
    void selfStop();
  }, [phase, selfStop, state.durationMillis]);

  useEffect(() => {
    const { silenceMs } = optionsRef.current;
    if (!silenceMs || phase !== "recording" || stoppingRef.current) return;

    const elapsed = state.durationMillis ?? 0;
    const level = levelFrom(state.metering);

    if (level >= SPEECH_LEVEL) {
      heardSpeech.current = true;
      lastSpeechAt.current = elapsed;
      return;
    }
    if (level > SILENCE_LEVEL) return;

    const done = heardSpeech.current
      ? elapsed - lastSpeechAt.current >= silenceMs
      : elapsed >= NO_SPEECH_TIMEOUT_MS;
    if (!done) return;

    stoppingRef.current = true;
    void selfStop();
  }, [phase, selfStop, state.durationMillis, state.metering]);

  useEffect(
    () => () => {
      generation.current += 1;
      if (recording.current) {
        recording.current = false;
        void finishRecording().finally(() =>
          releaseAudioSession(audioOwner.current),
        );
      }
    },
    [finishRecording],
  );

  return {
    cancel,
    level: phase === "recording" ? levelFrom(state.metering) : 0,
    permissionBlocked,
    phase,
    seconds: Math.floor((state.durationMillis ?? 0) / 1000),
    start,
    stop,
  };
}
