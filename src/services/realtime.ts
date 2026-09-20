import { api } from "@/utils/axios";
import type { ExplainStyle } from "@/stores/app-store";
import { asQuotaError, type AiQuota } from "@/services/lexi-ai";

const LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

export const liveSocketUrl = (token: string) =>
  `${LIVE_URL}?access_token=${encodeURIComponent(token)}`;

export const liveSetupMessage = (model: string) => ({
  setup: {
    model: model.startsWith("models/") ? model : `models/${model}`,
  },
});

export const liveAudioMessage = (base64Pcm: string) => ({
  realtimeInput: {
    audio: { data: base64Pcm, mimeType: "audio/pcm;rate=16000" },
  },
});

export interface RealtimeSession {
  provider?: "gemini";
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

export interface LiveServerMessage {
  setupComplete?: object;
  serverContent?: {
    modelTurn?: {
      parts?: { inlineData?: { data?: string; mimeType?: string } }[];
    };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  goAway?: { timeLeft?: string };
  error?: { message?: string };
}
