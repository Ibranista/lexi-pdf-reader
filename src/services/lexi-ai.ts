/**
 * The AI endpoints described in `prompt.md` — context, translate, chat, speech.
 *
 * When the server can't be *reached*, calls fall back to the bundled dictionary
 * fixture so the word card and chat stay usable offline; a fallback result
 * carries `offline: true` so the UI can say where the answer came from rather
 * than passing a guess off as the model's.
 *
 * A server that answers and *rejects* is a different thing, and is deliberately
 * not softened: a 400 from a malformed `docKey` used to land on the fixture and
 * read as "this word isn't in the dictionary", which hid a broken contract
 * behind plausible-looking output. Only unreachable and 5xx fall back now.
 */
import { isAxiosError } from "axios";

import { DICT, LANG_NAMES } from "@/constants/library";
import type { ExplainStyle, Lang } from "@/stores/app-store";
import { api } from "@/utils/axios";

/** Remaining AI allowance, echoed by every endpoint. */
export interface AiQuota {
  used: number;
  limit: number;
  resetsAt: number | null;
  tier: "anonymous" | "free" | "pro";
}

export interface TranslateResult {
  word: string;
  pos: string;
  /** The translation, in the target script. */
  tr: string;
  /** Latin transliteration; absent for Latin-script targets. */
  translit?: string;
  lang: Lang;
  langName: string;
  /** What it means in this passage. */
  s1: string;
  /** Why it matters here. */
  s2: string;
  /** One example sentence using the word, invented rather than from the page. */
  example?: string;
  /**
   * Spoken reading of the whole card — the word, its translation, both
   * explanation lines and the example — not just the translated word.
   */
  audioUrl?: string;
  quota?: AiQuota;
  /** True when this came from the bundled fixture, not the model. */
  offline?: boolean;
}

/** Matches the three bubble styles the chat sheet already renders. */
export type ChatKind = "drift" | "normal" | "recap";

export interface ChatReply {
  reply: string;
  kind: ChatKind;
  sessionId: string;
  quota?: AiQuota;
  offline?: boolean;
}

/**
 * Thrown when the allowance is gone. `requiresAuth` separates "sign in to carry
 * on" from "you're signed in, this needs a plan" — the two walls the reader
 * shows are different screens.
 */
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

/** 402 is the quota signal; 401 is reserved for the token refresh interceptor. */
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

/**
 * Whether an answer from the fixture is the honest thing to return.
 *
 * No response at all means offline, and 5xx means the server is unwell — both
 * are "come back later", which is exactly what the fixture is for. A 4xx is the
 * server saying this request was wrong; hiding that produces a bug that looks
 * like a bad dictionary.
 */
function isUnreachable(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status >= 500;
}

/* =========================
   Document context
========================= */

export interface ContextInput {
  docKey: string;
  title?: string;
  author?: string;
  pageCount?: number;
  /** Extracted page text. The endpoint takes at most 200 pages per call. */
  pages: { page: number; text: string }[];
}

/** How many pages go up per request — the server caps this at 200. */
export const CONTEXT_CHUNK_PAGES = 20;

/**
 * Hands the document's text to the server so Lexi can answer from the book
 * rather than from the page in view. Uploaded in chunks, in order, because a
 * long book exceeds both the payload cap and any sensible request timeout.
 *
 * Failures are swallowed: this is an enrichment step, and chat still works from
 * the excerpt it sends with each turn.
 */
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

/* =========================
   Translate
========================= */

export interface TranslateInput {
  /** The selected word or short phrase. */
  text: string;
  /** The sentence it was selected in, so the answer can be passage-specific. */
  context?: string;
  page: number;
  targetLang: Lang;
  /**
   * The document's sync key — 64 hex characters from `docKeyFor`. Required: the
   * endpoint 400s without it, since it's how the indexed text is found.
   */
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

/** The bundled dictionary, shaped like a response. Undefined for unknown words. */
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

/* =========================
   Chat
========================= */

export interface ChatInput {
  sessionId: string;
  /** What Lexi is allowed to talk about. */
  title: string;
  author?: string;
  /** 64-hex document key from `docKeyFor`; the endpoint 400s without it. */
  docKey: string;
  page: number;
  /** Text of the page in view, so answers can quote what's on screen. */
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

/**
 * Stand-in until `/ai/chat` exists. It can't answer anything, but it does
 * enforce the one rule the real endpoint has to: a question that isn't about
 * this book gets redirected rather than answered.
 */
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

/* =========================
   Speech
========================= */

/** Spoken audio for a translation. Returns undefined when there's no voice. */
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
