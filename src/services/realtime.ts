/**
 * Live voice, as a real conversation.
 *
 * The sentence-at-a-time pipeline behind `/ai/chat/live` has a floor it can't
 * get under: a sentence has to be finished, sent to a speech model, rendered to
 * a file and fetched back before one word is heard. That is a second or two
 * however the chunking is tuned, and a second or two is the difference between
 * talking to someone and leaving them a voicemail.
 *
 * So the device talks to the model directly, over WebRTC — audio up, audio
 * down, first word back in a few hundred milliseconds, and echo cancellation
 * from the platform so the reader can cut in mid-sentence the way they would
 * with a person. The transcript rides the same connection, which is what keeps
 * the chat on screen written by the same turn being heard.
 *
 * Our API key is never here. The server mints a short-lived client secret with
 * the document's instructions already baked in, and that is all the device
 * gets — the rule keeping Liqrai inside one book is not something a client
 * should be able to rewrite.
 */
import { api } from "@/utils/axios";
import type { ExplainStyle } from "@/stores/app-store";
import { asQuotaError, type AiQuota } from "@/services/lexi-ai";

/** Where the SDP offer goes. The model is carried by the session, not the url. */
const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/** The channel OpenAI sends conversation events on. Name is fixed by them. */
export const EVENT_CHANNEL = "oai-events";

export interface RealtimeSession {
  /** Short-lived; good for opening the call, not for the life of it. */
  clientSecret: string;
  expiresAt: number | null;
  model: string;
  voice: string;
  quota?: AiQuota;
}

export interface RealtimeContext {
  docKey: string;
  title?: string;
  author?: string;
  page: number;
  style?: ExplainStyle;
}

/**
 * Ask our server to open a line. Throws `AiQuotaError` when the allowance is
 * gone — checked before the session is minted, so an exhausted reader meets the
 * wall rather than a microphone that can only answer 402.
 */
export async function openRealtimeSession(
  context: RealtimeContext,
): Promise<RealtimeSession> {
  try {
    const { data } = await api.post<RealtimeSession>("/ai/realtime/session", {
      author: context.author,
      docKey: context.docKey,
      page: context.page,
      style: context.style ?? "balanced",
      title: context.title,
    });
    return data;
  } catch (error) {
    throw asQuotaError(error) ?? error;
  }
}

/**
 * Trade our SDP offer for the model's answer. Straight to OpenAI, authorised
 * with the ephemeral secret — the audio path never touches our server, which is
 * the whole reason it is fast.
 */
export async function exchangeSdp(
  offer: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch(CALLS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Couldn't open the voice line (${response.status}). ${detail.slice(0, 200)}`,
    );
  }
  return response.text();
}

/**
 * Hand one completed exchange back to be kept and charged for.
 *
 * The call runs device-to-model, so this is the only point at which a spoken
 * turn can be counted or persisted. Sent per turn rather than at the end of the
 * call: a conversation that ends with the app being killed should still have
 * left its history behind.
 */
export async function recordRealtimeTurn(input: {
  docKey: string;
  sessionId: string;
  title?: string;
  page: number;
  message: string;
  reply: string;
}): Promise<AiQuota | undefined> {
  try {
    const { data } = await api.post<{ quota?: AiQuota }>("/ai/realtime/turn", {
      docKey: input.docKey,
      message: input.message,
      page: input.page,
      reply: input.reply,
      sessionId: input.sessionId,
      title: input.title,
    });
    return data.quota;
  } catch (error) {
    throw asQuotaError(error) ?? error;
  }
}

/* =========================
   Conversation events
========================= */

/**
 * The events we act on, out of the many the model sends.
 *
 * Named defensively: the transcript delta has been spelled both
 * `response.output_audio_transcript.delta` and `response.audio_transcript.delta`
 * across versions of this API, and a rename would otherwise show up as a
 * conversation that talks but writes nothing down.
 */
export interface RealtimeEvent {
  type: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
  response?: { status?: string };
}

export const isTranscriptDelta = (type: string) =>
  type === "response.output_audio_transcript.delta" ||
  type === "response.audio_transcript.delta";

export const isTranscriptDone = (type: string) =>
  type === "response.output_audio_transcript.done" ||
  type === "response.audio_transcript.done";

export const isUserTranscript = (type: string) =>
  type === "conversation.item.input_audio_transcription.completed";
