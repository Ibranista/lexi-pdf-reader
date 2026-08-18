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
// A maintained SSE client for React Native — it reads the XHR response
// incrementally, which is what actually delivers chat tokens as they arrive
// (RN's own fetch/XHR and expo/fetch buffered the whole body on-device).
import EventSource from "react-native-sse";

import { DICT, LANG_NAMES } from "@/constants/library";
import { ensureSession } from "@/services/device-session";
import type { SpokenWord } from "@/utils/spoken-words";
import type { ExplainStyle, Lang } from "@/stores/app-store";
import { API_BASE_URL, api, tokenStorage } from "@/utils/axios";

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
  /** The translation, in the target script. Omitted when the selection is
   *  already in the target language (English word, English target) — then the
   *  card shows only the explanation. */
  tr?: string;
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
    body?.requiresAuth ?? true
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
 * Hands the document's text to the server so Liqrai can answer from the book
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

/** The card fields the stream fills in, in the order the server writes them. */
export type TranslateField =
  | "word"
  | "pos"
  | "tr"
  | "translit"
  | "s1"
  | "s2"
  | "example";

/** What the card knows mid-stream: whichever fields have arrived so far. */
export type PartialCard = Partial<Record<TranslateField, string>>;

export interface TranslateStreamHandlers {
  /** A field grew. `value` is everything written for it so far, not a delta. */
  onField: (field: TranslateField, value: string) => void;
  /** The card finished — the same shape `translate` resolves to. */
  onDone: (result: TranslateResult) => void;
  /** Network/server failure, or an AiQuotaError when the wall should rise. */
  onError: (error: unknown) => void;
}

/**
 * The word card, streamed. The server writes one field per line and sends a
 * `data: { f, t }` per update — `f` the field name, `t` its value so far — then
 * a final `data: { done, ...card }` with the finished, clamped result. The card
 * fills in as it's written instead of waiting on the whole lookup.
 *
 * Returns an abort function so a closing card can cancel an in-flight lookup.
 */
export async function streamTranslate(
  input: TranslateInput,
  handlers: TranslateStreamHandlers
): Promise<() => void> {
  // The EventSource bypasses the axios interceptors, so guarantee a session.
  try {
    if (!tokenStorage.getAccessToken()) await ensureSession();
  } catch {
    // offline on first launch — the connection below fails and onError fires
  }
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
    // One-shot: never auto-reconnect after the card ends or fails.
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
      // Unreachable and the word is in the bundled dictionary: answer from it
      // rather than showing a failure, same as the non-streaming path.
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

/** The bundled dictionary, shaped like a response. Undefined for unknown words. */
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

/* =========================
   Chat
========================= */

export interface ChatInput {
  sessionId: string;
  /** What Liqrai is allowed to talk about. */
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

/* =========================
   Streaming chat
========================= */

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  kind: ChatKind;
  content: string;
}

// A document is normally opened before its Lexi panel. Keeping its small chat
// history in memory lets the panel mount with the full thread already present,
// instead of rendering a placeholder and replacing it after an HTTP round trip.
const chatHistoryCache = new Map<string, ChatHistoryMessage[]>();
const chatHistoryRequests = new Map<
  string,
  Promise<ChatHistoryMessage[] | null>
>();

export interface ChatStreamHandlers {
  /** A piece of the reply, as it's generated. */
  onToken: (token: string) => void;
  /** The reply finished — carries the final kind and refreshed quota. */
  onDone: (final: {
    kind: ChatKind;
    sessionId: string;
    quota?: AiQuota;
  }) => void;
  /** Network/server failure, or an AiQuotaError when the wall should rise. */
  onError: (error: unknown) => void;
}

/**
 * One chat turn, streamed over Server-Sent Events. The server sends one
 * `data: { t }` per token and a final `data: { done, kind, quota }`; the
 * EventSource fires a `message` event for each, so the reply renders
 * token-by-token as it's generated. Returns an abort function so a closing
 * sheet can cancel an in-flight reply.
 */
export async function streamChat(
  input: ChatInput,
  handlers: ChatStreamHandlers
): Promise<() => void> {
  // The EventSource bypasses the axios interceptors, so guarantee a session.
  try {
    if (!tokenStorage.getAccessToken()) await ensureSession();
  } catch {
    // offline on first launch — the connection below fails and onError fires
  }
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
    // One-shot: never auto-reconnect after the reply ends or fails.
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
    // The quota wall answers 402 before any events; other statuses / network
    // drops are a plain failure.
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

/* =========================
   Live voice chat
========================= */

/** A sentence of the reply, rendered to audio while the rest is still writing. */
export interface SpeechClip {
  /** Play order. Clips can arrive out of order — a repeated sentence is a
   *  server-side cache hit and comes back instantly where a fresh one doesn't. */
  seq: number;
  url: string;
  /** The sentence this clip says, as the voice was given it. */
  text: string;
}

export interface LiveChatHandlers extends ChatStreamHandlers {
  /** A clip is ready to play. Play by `seq`, holding anything that arrives early. */
  onSpeech: (clip: SpeechClip) => void;
}

/**
 * One turn of a spoken conversation: everything {@link streamChat} delivers,
 * plus the reply's audio, cut into sentences and voiced as it is written.
 *
 * The two travel on one stream so the transcript and the voice can never
 * disagree about what was said, and so playback can start on the first sentence
 * instead of after the last word — the gap between those two is the difference
 * between talking to Liqrai and leaving it a voicemail.
 *
 * `onDone` fires when the turn ends, which is also when the audio queue is
 * complete: no clip is announced after it.
 */
export async function streamChatLive(
  input: ChatInput,
  handlers: LiveChatHandlers,
): Promise<() => void> {
  // The EventSource bypasses the axios interceptors, so guarantee a session.
  try {
    if (!tokenStorage.getAccessToken()) await ensureSession();
  } catch {
    // offline on first launch — the connection below fails and onError fires
  }
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
      // Asks for an answer written to be *heard*: a few sentences, no lists or
      // file names, ending in something the reader can answer out loud.
      spoken: true,
      style: input.style ?? "balanced",
      title: input.title,
    }),
    // One-shot: never auto-reconnect after the turn ends or fails.
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

/** Prior turns for a book's conversation, oldest first — to rehydrate the sheet. */
export function cachedChatHistory(
  sessionId: string,
): ChatHistoryMessage[] | undefined {
  return chatHistoryCache.get(sessionId);
}

/**
 * A document's thread, or `null` when it couldn't be fetched.
 *
 * The distinction matters: this used to answer `[]` for both, so a reader whose
 * history failed to load was shown a fresh greeting that looked exactly like
 * having no history — the conversation appearing to have been lost when it was
 * sitting on the server the whole time. A failure is not cached, so the next
 * open tries again.
 */
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

/** Start loading a document's thread before the reader opens its Lexi panel. */
export function preloadChatHistory(sessionId: string): void {
  if (sessionId) void fetchChatHistory(sessionId);
}

/**
 * Forget a document's conversation, server-side. False when it didn't happen —
 * the caller has to know, because a thread cleared only on the device comes
 * straight back the next time the panel rehydrates its history.
 */
export async function clearChatHistory(sessionId: string): Promise<boolean> {
  try {
    await api.delete("/ai/chat/history", { params: { sessionId } });
    chatHistoryCache.delete(sessionId);
    return true;
  } catch {
    return false;
  }
}

/* =========================
   Speech
========================= */

/**
 * Voice arbitrary text (a chat reply's speaker button).
 *
 * `words` carries when each word is spoken, so the reply can be followed along
 * as it is read. It comes back empty when the alignment failed or wasn't worth
 * doing — the clip still plays, it just plays with nothing following it — so
 * callers treat it as an enhancement and never as a precondition.
 */
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

/* =========================
   Speech to text
========================= */

/**
 * Turn a recorded question into text for the chat composer.
 *
 * An empty `text` is a real, successful answer — the reader held the mic and
 * said nothing, which costs no credit and is not an error. Anything that
 * actually went wrong throws, so the composer can tell the two apart instead
 * of silently doing nothing on a recording that failed to reach the server.
 */
export async function transcribe(input: {
  /** base64 audio, no `data:` prefix needed. */
  audio: string;
  /** The recorder's container, e.g. `audio/m4a`. */
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

/**
 * Spoken audio for a translation.
 *
 * `undefined` means one thing only: the server answered and has no voice for
 * this language. A request that *failed* throws instead — collapsing the two
 * into `undefined` made every network blip and 500 read on screen as "no
 * audio for this language yet", which is a different (and permanent-sounding)
 * problem from the one that actually happened.
 */
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
