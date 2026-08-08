/**
 * Voice input for the chat composer — hold the mic, speak, get text back.
 *
 * The clip is recorded on the device and transcribed on the server rather than
 * by an on-device speech recogniser. That keeps the model key server-side,
 * gives the same three languages the rest of Liqrai speaks (a device's built-in
 * recogniser is often English-only, and Amharic support is rare), and needs no
 * second native module beyond the recorder itself.
 *
 * What comes back is a *draft*, never a sent message. The composer already
 * treats its opener chips that way — "an opener is a draft, not a send" — and
 * a transcript is a guess at what someone said, so it has to be reviewable
 * before it goes to the model.
 */
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

import { AiQuotaError, transcribe } from "@/services/lexi-ai";

/**
 * How often the recorder's level is sampled. The default is 500ms, which makes
 * a level meter look broken — it has to move with the voice, not a beat behind
 * it. 90ms is roughly a frame's worth of lag at the wave's own animation rate.
 */
const METER_INTERVAL_MS = 90;

/**
 * A spoken question is short. Past a minute this is a pocket recording, and it
 * costs the reader a credit and the upload either way, so it stops itself.
 */
const MAX_DURATION_MS = 60_000;

/**
 * Below this, nothing was said — the mic was tapped rather than held. Stopping
 * here avoids a round trip that could only come back empty (the server rejects
 * clips this short too, since Whisper invents a sentence out of silence).
 */
const MIN_DURATION_MS = 700;

/** dBFS range the recorder reports; -160 is silence, 0 is clipping. */
const DB_FLOOR = -50;

/**
 * Recorder level as 0..1, ready to scale a bar.
 *
 * `metering` is in dBFS — a logarithmic scale where ordinary speech sits
 * around -20 and silence is far below -50. Mapping from -50 rather than the
 * true -160 floor is what makes the wave respond to talking instead of
 * flattening against the bottom of a range it never reaches.
 */
function levelFrom(metering: number | undefined): number {
  if (metering === undefined || Number.isNaN(metering)) return 0;
  if (metering <= DB_FLOOR) return 0;
  if (metering >= 0) return 1;
  return (metering - DB_FLOOR) / -DB_FLOOR;
}

export type VoicePhase = "idle" | "recording" | "transcribing";

export interface VoiceInput {
  /** Live 0..1 loudness while recording, for the wave. */
  level: number;
  /** Seconds held so far, for the timer next to the wave. */
  seconds: number;
  phase: VoicePhase;
  /** True once the OS has refused the microphone and won't ask again. */
  permissionBlocked: boolean;
  start: () => Promise<void>;
  /** Stop and transcribe. Resolves to the text, or "" when nothing was said. */
  stop: () => Promise<string>;
  /** Stop and throw the recording away — the reader changed their mind. */
  cancel: () => Promise<void>;
}

/**
 * @param onError Told what to say when something fails, so the surface owning
 *   the composer decides how to show it (a toast here, a bubble elsewhere).
 */
export function useVoiceInput(onError: (message: string) => void): VoiceInput {
  // The API accepts AAC/M4A. Expo's low-quality Android preset instead
  // records AMR-NB in a .3gp container, which cannot truthfully be uploaded
  // as audio/m4a and is rejected by common transcription providers.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const state = useAudioRecorderState(recorder, METER_INTERVAL_MS);

  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  // Read inside `stop`, which needs the length at the moment of release.
  // Mirrored into a ref rather than closed over, so `stop` doesn't have to be
  // rebuilt on every one of the ~11 level samples a second.
  const durationRef = useRef(0);
  useEffect(() => {
    durationRef.current = state.durationMillis ?? 0;
  }, [state.durationMillis]);
  // Guards the auto-stop below against firing twice on consecutive polls.
  const stoppingRef = useRef(false);

  const finishRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // Already stopped, or never started — either way there is nothing to
      // clean up and nothing worth telling the reader about.
    }
    // Hand the audio route back. While `allowsRecording` is on, playback is
    // routed the way a call would be — quiet, and on iOS through the earpiece
    // — so a reply read aloud straight after would sound broken.
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  }, [recorder]);

  const start = useCallback(async () => {
    if (phase !== "idle") return;

    // Ask only when we don't already have it: `request` on an OS-blocked
    // permission returns immediately without a prompt, and treating that as a
    // fresh denial would show the "enable it in Settings" message every time.
    const existing = await getRecordingPermissionsAsync();
    const granted =
      existing.granted || (await requestRecordingPermissionsAsync()).granted;

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
      await recorder.prepareToRecordAsync();
      recorder.record();
      stoppingRef.current = false;
      setPhase("recording");
    } catch {
      await finishRecording();
      setPhase("idle");
      onError("Couldn't start recording just then");
    }
  }, [finishRecording, onError, phase, recorder]);

  const cancel = useCallback(async () => {
    if (phase !== "recording") return;
    stoppingRef.current = true;
    setPhase("idle");
    await finishRecording();
  }, [finishRecording, phase]);

  const stop = useCallback(async (): Promise<string> => {
    if (phase !== "recording") return "";
    stoppingRef.current = true;

    const heldFor = durationRef.current;
    // `recorder.uri` is only meaningful once the file is closed.
    await finishRecording();
    const uri = recorder.uri;

    if (heldFor < MIN_DURATION_MS || !uri) {
      setPhase("idle");
      return "";
    }

      setPhase("transcribing");
    try {
      const audio = await new File(uri).base64();
      const text = await transcribe({ audio, mimeType: "audio/m4a" });
      if (!text) onError("Didn't catch that — try again");
      return text;
    } catch (error) {
      console.log("error-->", error);
      // The wall is the caller's to raise: it owns the auth store and knows
      // whether the panel should close behind it.
      if (error instanceof AiQuotaError) throw error;
      onError("Couldn't transcribe that — check your connection");
      return "";
    } finally {
      setPhase("idle");
    }
  }, [finishRecording, onError, phase, recorder]);

  // A recording that runs long stops itself and transcribes what it has,
  // rather than being thrown away for the reader's not having noticed.
  useEffect(() => {
    if (phase !== "recording" || stoppingRef.current) return;
    if ((state.durationMillis ?? 0) < MAX_DURATION_MS) return;
    stoppingRef.current = true;
    void stop();
  }, [phase, state.durationMillis, stop]);

  // Leaving the panel mid-recording must not leave the mic open.
  useEffect(
    () => () => {
      void finishRecording();
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
