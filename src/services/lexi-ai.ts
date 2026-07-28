import { isAxiosError } from "axios";

import { DICT, LANG_NAMES } from "@/constants/library";
import type { ExplainStyle, Lang } from "@/stores/app-store";
import { api } from "@/utils/axios";

export interface AiQuota {
  used: number;
  limit: number;
  resetsAt: number | null;
  tier: "anonymous" | "free" | "pro";
}

export interface TranslateResult {
  word: string;
  pos: string;
  tr: string;
  translit?: string;
  lang: Lang;
  langName: string;
  s1: string;
  s2: string;
  example?: string;
  audioUrl?: string;
  quota?: AiQuota;
  offline?: boolean;
}

export type ChatKind = "drift" | "normal" | "recap";

export interface ChatReply {
  reply: string;
  kind: ChatKind;
  sessionId: string;
  quota?: AiQuota;
  offline?: boolean;
}

export class AiQuotaError extends Error {
  readonly quota: AiQuota | null;
  readonly requiresAuth: boolean;

  constructor(message: string, quota: AiQuota | null, requiresAuth: boolean) {
    super(message);
    this.name = "AiQuotaError";
    this.quota = quota;
    this.requiresAuth = requiresAuth;
  }
}

export function asQuotaError(error: unknown): AiQuotaError | null {
  if (!isAxiosError(error) || error.response?.status !== 402) return null;
  const body = error.response.data as {
    message?: string;
    quota?: AiQuota;
    requiresAuth?: boolean;
  };
  return new AiQuotaError(
    body?.message ?? "You've used your free AI credits.",
    body?.quota ?? null,
    body?.requiresAuth ?? true,
  );
}

function isUnreachable(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status >= 500;
}

export interface ContextInput {
  docKey: string;
  title?: string;
  author?: string;
  pageCount?: number;
  pages: { page: number; text: string }[];
}

export const CONTEXT_CHUNK_PAGES = 20;

export async function uploadContext(input: ContextInput): Promise<boolean> {
  const { pages, ...meta } = input;
  try {
    for (let i = 0; i < pages.length; i += CONTEXT_CHUNK_PAGES) {
      await api.post("/ai/context", {
        ...meta,
        pages: pages.slice(i, i + CONTEXT_CHUNK_PAGES),
      });
    }
    return true;
  } catch {
    return false;
  }
}

export interface TranslateInput {
  text: string;
  context?: string;
  page: number;
  targetLang: Lang;
  docKey: string;
  style?: ExplainStyle;
}

export async function translate(input: TranslateInput): Promise<TranslateResult> {
  try {
    const { data } = await api.post<TranslateResult>("/ai/translate", {
      context: input.context,
      docKey: input.docKey,
      page: input.page,
      style: input.style ?? "balanced",
      targetLang: input.targetLang,
      text: input.text,
    });
    return data;
  } catch (error) {
    const quota = asQuotaError(error);
    if (quota) throw quota;
    if (isUnreachable(error)) {
      const local = localTranslate(input);
      if (local) return local;
    }
    throw error;
  }
}

function localTranslate(input: TranslateInput): TranslateResult | undefined {
  const key = input.text.trim().toLowerCase().replace(/[^a-z'-]/g, "");
  const entry = DICT[key];
  if (!entry) return undefined;
  const [tr, translit] = entry[input.targetLang];
  return {
    lang: input.targetLang,
    langName: LANG_NAMES[input.targetLang] ?? input.targetLang,
    offline: true,
    pos: entry.pos,
    s1: entry.s1,
    s2: entry.s2,
    tr,
    translit: translit === "—" ? undefined : translit,
    word: key,
  };
}

export interface ChatInput {
  sessionId: string;
  title: string;
  author?: string;
  docKey: string;
  page: number;
  excerpt?: string;
  message: string;
  style?: ExplainStyle;
}

export async function chat(input: ChatInput): Promise<ChatReply> {
  try {
    const { data } = await api.post<ChatReply>("/ai/chat", {
      author: input.author,
      docKey: input.docKey,
      excerpt: input.excerpt,
      message: input.message,
      page: input.page,
      sessionId: input.sessionId,
      style: input.style ?? "balanced",
      title: input.title,
    });
    return data;
  } catch (error) {
    const quota = asQuotaError(error);
    if (quota) throw quota;
    if (isUnreachable(error)) return localChat(input);
    throw error;
  }
}

function localChat(input: ChatInput): ChatReply {
  const words = input.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const asked = input.message.toLowerCase();
  const aboutBook =
    words.some((w) => asked.includes(w)) ||
    /\b(this|book|chapter|page|author|passage|here|mean|why|summar)/.test(asked);

  return {
    kind: aboutBook ? "normal" : "drift",
    offline: true,
    reply: aboutBook
      ? `I can't reach my reading brain right now, so I can't answer that properly yet — but I've got you on page ${input.page} of ${input.title}. Ask me again once you're back online.`
      : `Happy to chat, but let's park that for later — you were doing well in ${input.title}. Want to carry on?`,
    sessionId: input.sessionId,
  };
}

export async function speak(text: string, lang: Lang): Promise<string | undefined> {
  try {
    const { data } = await api.get<{ audioUrl?: string }>("/ai/tts", {
      params: { lang, text },
    });
    return data.audioUrl;
  } catch (error) {
    const quota = asQuotaError(error);
    if (quota) throw quota;
    return undefined;
  }
}
