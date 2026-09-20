import { api } from "@/utils/axios";
import type { ExplainStyle } from "@/stores/app-store";
import {
  asQuotaError,
  invalidateChatHistory,
  type AiQuota,
} from "@/services/lexi-ai";

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
  excerpt?: string;
  chapter?: string;
  source?: "selection" | "visible" | "page";
  recent?: { page: number; excerpt: string };
  voiceId?: string;
}

export async function openRealtimeSession(
  context: RealtimeContext,
): Promise<RealtimeSession> {
  try {
    const { data } = await api.post<RealtimeSession>("/ai/realtime/session", {
      author: context.author,
      excerpt: context.excerpt?.slice(0, 4000),
      chapter: context.chapter?.slice(0, 300),
      voiceId: context.voiceId,
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
    invalidateChatHistory(input.sessionId);
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

export const liveContextMessage = (context: RealtimeContext) => ({
  clientContent: {
    turns: [
      {
        role: "user",
        parts: [
          {
            text: `READING_CONTEXT ${JSON.stringify({
              docKey: context.docKey,
              page: context.page,
              chapter: context.chapter?.slice(0, 300),
              source: context.source ?? "page",
              passage: context.excerpt?.slice(0, 4000) ?? "",
              recent: context.recent
                ? {
                    page: context.recent.page,
                    passage: context.recent.excerpt.slice(0, 1000),
                  }
                : undefined,
            })}`,
          },
        ],
      },
    ],
    turnComplete: false,
  },
});
