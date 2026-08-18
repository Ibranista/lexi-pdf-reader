import { isAxiosError } from "axios";
import EventSource from "react-native-sse";

import { DICT, LANG_NAMES } from "@/constants/library";
import { ensureSession } from "@/services/device-session";
import type { SpokenWord } from "@/utils/spoken-words";
import type { ExplainStyle, Lang } from "@/stores/app-store";
import { API_BASE_URL, api, tokenStorage } from "@/utils/axios";

export interface AiQuota {
  used: number;
  limit: number;
  resetsAt: number | null;
  tier: "anonymous" | "free" | "pro";
}

export interface TranslateResult {
  word: string;
  pos: string;
  tr?: string;
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
    body?.requiresAuth ?? true
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

export async function translate(
  input: TranslateInput
): Promise<TranslateResult> {
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

export type TranslateField =
  | "word"
  | "pos"
  | "tr"
  | "translit"
  | "s1"
  | "s2"
  | "example";

export type PartialCard = Partial<Record<TranslateField, string>>;

export interface TranslateStreamHandlers {
  onField: (field: TranslateField, value: string) => void;
  onDone: (result: TranslateResult) => void;
  onError: (error: unknown) => void;
}

export async function streamTranslate(
  input: TranslateInput,
  handlers: TranslateStreamHandlers
): Promise<() => void> {
  try {
    if (!tokenStorage.getAccessToken()) await ensureSession();
  } catch {}
  const token = tokenStorage.getAccessToken();

  const source = new EventSource(`${API_BASE_URL}/ai/translate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      context: input.context,
      docKey: input.docKey,
      page: input.page,
      style: input.style ?? "balanced",
      targetLang: input.targetLang,
      text: input.text,
    }),
    pollingInterval: 0,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    source.removeAllEventListeners();
    source.close();
  };

  source.addEventListener("message", (event) => {
    if (finished || !event.data) return;
    let obj: {
      f?: TranslateField;
      t?: string;
      done?: boolean;
      error?: boolean;
      message?: string;
    } & Partial<TranslateResult>;
    try {
      obj = JSON.parse(event.data);
    } catch {
      return; // partial/garbled frame — ignore
    }
    if (obj.done) {
      const { done, f, t, error, message, ...card } = obj;
      handlers.onDone(card as TranslateResult);
      finish();
    } else if (obj.error) {
      handlers.onError(
        new Error(obj.message ?? "Liqrai couldn't finish that.")
      );
      finish();
    } else if (obj.f) {
      handlers.onField(obj.f, obj.t ?? "");
    }
  });

  source.addEventListener("error", (event) => {
    if (finished) return; // a close after `done` also lands here — ignore it
    const status = "xhrStatus" in event ? event.xhrStatus : 0;
    if (status === 402) {
      handlers.onError(
        new AiQuotaError("You've used your free AI credits.", null, true)
      );
    } else {
      const local = localTranslate(input);
      if (local) {
        handlers.onDone(local);
      } else {
        handlers.onError(new Error("Couldn't reach Liqrai."));
      }
    }
    finish();
  });

  return () => finish();
}

function localTranslate(input: TranslateInput): TranslateResult | undefined {
  const key = input.text
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, "");
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
  const words = input.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const asked = input.message.toLowerCase();
  const aboutBook =
    words.some((w) => asked.includes(w)) ||
    /\b(this|book|chapter|page|author|passage|here|mean|why|summar)/.test(
      asked
    );

  return {
    kind: aboutBook ? "normal" : "drift",
    offline: true,
    reply: aboutBook
      ? `I can't reach my reading brain right now, so I can't answer that properly yet — but I've got you on page ${input.page} of ${input.title}. Ask me again once you're back online.`
      : `Happy to chat, but let's park that for later — you were doing well in ${input.title}. Want to carry on?`,
    sessionId: input.sessionId,
  };
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  kind: ChatKind;
  content: string;
}

const chatHistoryCache = new Map<string, ChatHistoryMessage[]>();
const chatHistoryRequests = new Map<
  string,
  Promise<ChatHistoryMessage[] | null>
>();

export interface ChatStreamHandlers {
  onToken: (token: string) => void;
  onDone: (final: {
    kind: ChatKind;
    sessionId: string;
    quota?: AiQuota;
  }) => void;
  onError: (error: unknown) => void;
}

export async function streamChat(
  input: ChatInput,
  handlers: ChatStreamHandlers
): Promise<() => void> {
  try {
    if (!tokenStorage.getAccessToken()) await ensureSession();
  } catch {}
  const token = tokenStorage.getAccessToken();

  const source = new EventSource(`${API_BASE_URL}/ai/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      author: input.author,
      docKey: input.docKey,
      excerpt: input.excerpt,
      message: input.message,
      page: input.page,
      sessionId: input.sessionId,
      style: input.style ?? "balanced",
      title: input.title,
    }),
    pollingInterval: 0,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    source.removeAllEventListeners();
    source.close();
  };

  source.addEventListener("message", (event) => {
    if (finished || !event.data) return;
    let obj: {
      t?: string;
      done?: boolean;
      kind?: ChatKind;
      sessionId?: string;
      quota?: AiQuota;
      error?: boolean;
      message?: string;
    };
    try {
      obj = JSON.parse(event.data);
    } catch {
      return; // partial/garbled frame — ignore
    }
    if (obj.t) {
      handlers.onToken(obj.t);
    } else if (obj.done) {
      handlers.onDone({
        kind: obj.kind ?? "normal",
        sessionId: obj.sessionId ?? input.sessionId,
        quota: obj.quota,
      });
      finish();
    } else if (obj.error) {
      handlers.onError(
        new Error(obj.message ?? "Liqrai couldn't finish that.")
      );
      finish();
    }
  });

  source.addEventListener("error", (event) => {
    if (finished) return; // a close after `done` also lands here — ignore it
    const status = "xhrStatus" in event ? event.xhrStatus : 0;
    if (status === 402) {
      handlers.onError(
        new AiQuotaError("You've used your free AI credits.", null, true)
      );
    } else {
      handlers.onError(new Error("Couldn't reach Liqrai."));
    }
    finish();
  });

  return () => finish();
}

export interface SpeechClip {
  seq: number;
  url: string;
  text: string;
}

export interface LiveChatHandlers extends ChatStreamHandlers {
  onSpeech: (clip: SpeechClip) => void;
}

export async function streamChatLive(
  input: ChatInput,
  handlers: LiveChatHandlers,
): Promise<() => void> {
  try {
    if (!tokenStorage.getAccessToken()) await ensureSession();
  } catch {}
  const token = tokenStorage.getAccessToken();

  const source = new EventSource(`${API_BASE_URL}/ai/chat/live`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      author: input.author,
      docKey: input.docKey,
      excerpt: input.excerpt,
      message: input.message,
      page: input.page,
      sessionId: input.sessionId,
      spoken: true,
      style: input.style ?? "balanced",
      title: input.title,
    }),
    pollingInterval: 0,
  });

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    source.removeAllEventListeners();
    source.close();
  };

  source.addEventListener("message", (event) => {
    if (finished || !event.data) return;
    let obj: {
      t?: string;
      s?: number;
      url?: string;
      text?: string;
      done?: boolean;
      kind?: ChatKind;
      sessionId?: string;
      quota?: AiQuota;
      error?: boolean;
      message?: string;
    };
    try {
      obj = JSON.parse(event.data);
    } catch {
      return; // partial/garbled frame — ignore
    }
    if (obj.t) {
      handlers.onToken(obj.t);
    } else if (obj.url && obj.s !== undefined) {
      handlers.onSpeech({ seq: obj.s, text: obj.text ?? "", url: obj.url });
    } else if (obj.done) {
      handlers.onDone({
        kind: obj.kind ?? "normal",
        quota: obj.quota,
        sessionId: obj.sessionId ?? input.sessionId,
      });
      finish();
    } else if (obj.error) {
      handlers.onError(
        new Error(obj.message ?? "Liqrai couldn't finish that."),
      );
      finish();
    }
  });

  source.addEventListener("error", (event) => {
    if (finished) return; // a close after `done` also lands here — ignore it
    const status = "xhrStatus" in event ? event.xhrStatus : 0;
    if (status === 402) {
      handlers.onError(
        new AiQuotaError("You've used your free AI credits.", null, true),
      );
    } else {
      handlers.onError(new Error("Couldn't reach Liqrai."));
    }
    finish();
  });

  return () => finish();
}

export function cachedChatHistory(
  sessionId: string,
): ChatHistoryMessage[] | undefined {
  return chatHistoryCache.get(sessionId);
}

export function fetchChatHistory(
  sessionId: string,
): Promise<ChatHistoryMessage[] | null> {
  const cached = chatHistoryCache.get(sessionId);
  if (cached) return Promise.resolve(cached);

  const pending = chatHistoryRequests.get(sessionId);
  if (pending) return pending;

  const request = api
    .get<{ messages: ChatHistoryMessage[] }>("/ai/chat/history", {
      params: { sessionId },
    })
    .then(({ data }) => {
      const history = data.messages ?? [];
      chatHistoryCache.set(sessionId, history);
      return history;
    })
    .catch(() => null)
    .finally(() => {
      chatHistoryRequests.delete(sessionId);
    });
  chatHistoryRequests.set(sessionId, request);
  return request;
}

export function preloadChatHistory(sessionId: string): void {
  if (sessionId) void fetchChatHistory(sessionId);
}

export async function clearChatHistory(sessionId: string): Promise<boolean> {
  try {
    await api.delete("/ai/chat/history", { params: { sessionId } });
    chatHistoryCache.delete(sessionId);
    return true;
  } catch {
    return false;
  }
}

export async function speakText(
  text: string,
): Promise<{ audioUrl?: string; words: SpokenWord[] }> {
  try {
    const { data } = await api.post<{
      audioUrl?: string;
      words?: SpokenWord[];
    }>("/ai/speak", { text });
    return { audioUrl: data.audioUrl, words: data.words ?? [] };
  } catch {
    return { words: [] };
  }
}

export async function transcribe(input: {
  audio: string;
  mimeType?: string;
}): Promise<string> {
  try {
    const { data } = await api.post<{ text?: string }>("/ai/transcribe", {
      audio: input.audio,
      ...(input.mimeType ? { mimeType: input.mimeType } : {}),
    });
    return data.text ?? "";
  } catch (error) {
    throw asQuotaError(error) ?? error;
  }
}

export async function speak(
  text: string,
  lang: Lang
): Promise<string | undefined> {
  try {
    const { data } = await api.get<{ audioUrl?: string }>("/ai/tts", {
      params: { lang, text },
    });
    return data.audioUrl;
  } catch (error) {
    throw asQuotaError(error) ?? error;
  }
}
