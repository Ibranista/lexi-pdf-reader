import { api } from "@/utils/axios";
import type { ExplainStyle } from "@/stores/app-store";
import { asQuotaError, type AiQuota } from "@/services/lexi-ai";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export const EVENT_CHANNEL = "oai-events";

export interface RealtimeSession {
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
