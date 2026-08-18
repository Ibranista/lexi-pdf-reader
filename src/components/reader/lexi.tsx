/**
 * "Hey Liqrai" — the reading companion bubble and its chat panel.
 *
 * The panel slides in from the right edge, the same side-drawer shape as
 * `PdfOutlineDrawer` / `PdfSearchPanel`, rather than the bottom sheet it used
 * to be: over a page of text a right-hand panel keeps the passage you're asking
 * about visible on the left instead of burying it under a sheet.
 *
 * Keyboard: there is no sheet doing the avoidance any more, so the panel does
 * it itself off `useReanimatedKeyboardAnimation` — its content area is padded
 * by the live keyboard height, which pushes the composer up and shrinks the
 * message list. That hook flips the activity to `adjustResize` while the panel
 * is mounted and restores the app's `adjustPan` on unmount, so the gorhom
 * sheets elsewhere keep the input mode they were written against. Under
 * edge-to-edge neither mode moves the window on its own, so the padding below
 * is the only compensation applied — nothing double-counts.
 */
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box, TextInput } from "@/components/atoms";
import {
  IconBack,
  IconCheck,
  IconClose,
  IconMic,
  IconSend,
  IconSpark,
  IconSpeaker,
  IconTrash,
  IconWave,
  LiveWave,
  SpeakingWave,
  Tap,
  Text,
} from "@/components/lexi-components";
import { CenterModal } from "@/components/modals";
import { palette } from "@/constants/colors";
import { LEXI_SEED } from "@/constants/library";
import { useRealtimeVoice } from "@/hooks/use-realtime-voice";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { recordRealtimeTurn } from "@/services/realtime";
import {
  AiQuotaError,
  cachedChatHistory,
  clearChatHistory,
  fetchChatHistory,
  speakText,
  streamChat,
  type AiQuota,
} from "@/services/lexi-ai";
import {
  useAnnotationsStore,
  type Annotation,
} from "@/stores/annotations-store";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { readerBodyFont, sansFamily } from "@/theme/app-fonts";
import { useProtoTheme } from "@/theme/proto";
import { alignWords, tokenize, type WordSpan } from "@/utils/spoken-words";

interface LexiMsg {
  role: "lexi" | "user";
  kind: "drift" | "normal" | "recap" | "error";
  text: string;
  /** A highlight of yours the reply leaned on, shown as a quoted source card. */
  cite?: { page: number; text: string };
}

/** Composer growth bounds — one line, then up to ~5 before the draft scrolls. */
const INPUT_MIN = 22;
const INPUT_MAX = 112;
/** Don't show the jump-to-start affordance until the reader has browsed back. */
const SCROLL_TO_TOP_REVEAL_DISTANCE = 120;

/** Keeps the off-screen audio WebView out of the layout entirely. */
const ZERO_SIZE = {
  position: "absolute",
  width: 0,
  height: 0,
  opacity: 0,
} as const;

/**
 * Openers offered while the composer is empty and nothing is streaming. Phrased
 * to fit whatever is open — "what is the author saying" is a fine question of a
 * book and a strange one of a CV or an invoice.
 */
const STARTERS = ["What's the key point here?", "Explain this concept"];

const DOC_WORDS = [
  "edison",
  "light",
  "gas",
  "lamp",
  "pearl",
  "electric",
  "chapter",
  "page",
  "author",
  "mean",
  "night",
  "manhattan",
  "summar",
  "book",
  "section",
  "time",
  "city",
  "read",
  "why",
  "how",
];

const REPLY_POOL = [
  "Good question. On this page, the author frames Edison as selling reclaimed time, not just light — the lamps mattered because of what people could now do after dark.",
  "The gas industry's collapse is the page's counterweight: every hour gained by electric light cost the lamplighters their trade. The author wants you to hold both at once.",
];

/**
 * The prototype reader's canned companion, kept for `/reader` — it has no real
 * document, so there's nothing for the model to be grounded in. Real documents
 * go through `/ai/chat`, which enforces the same "stay on this book" rule
 * server-side, where it can't be talked out of it.
 */
function scriptedReply(
  question: string,
  rabbitCount: { current: number },
  replyIdx: { current: number },
): LexiMsg {
  const lower = question.toLowerCase();
  if (!DOC_WORDS.some((w) => lower.includes(w))) {
    rabbitCount.current = 0;
    return {
      role: "lexi",
      kind: "drift",
      text: "Happy to chat, but let's park that for later — you were doing great on Chapter 3. Want to continue?",
    };
  }
  rabbitCount.current += 1;
  if (rabbitCount.current >= 3) {
    rabbitCount.current = 0;
    return {
      role: "lexi",
      kind: "recap",
      text: "Short answer: it comes back to cheap, constant light. We've covered this point well — the core idea is that electricity turned night into usable time. Ready for the next section?",
    };
  }
  replyIdx.current += 1;
  return {
    role: "lexi",
    kind: "normal",
    text: REPLY_POOL[replyIdx.current % REPLY_POOL.length],
  };
}

/** Elapsed recording time, as a clock rather than a bare second count. */
function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** A quiet three-dot pulse while Liqrai is forming the next reply. */
function TypingDot({ color, delay }: { color: string; delay: number }) {
  const pulse = useSharedValue(0.3);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(1, { duration: 190 })),
        withTiming(0.3, { duration: 190 }),
        withDelay(540 - delay, withTiming(0.3, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [delay, pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ translateY: (1 - pulse.value) * 3 }],
  }));

  return (
    <Reanimated.View
      style={[
        { backgroundColor: color, borderRadius: 3, height: 6, width: 6 },
        style,
      ]}
    />
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <Box align="center" direction="row" gap={5} height={21} paddingX={2}>
      <TypingDot color={color} delay={0} />
      <TypingDot color={color} delay={180} />
      <TypingDot color={color} delay={360} />
    </Box>
  );
}

/** Content words only — "the", "and" and friends match every reply going. */
function keyWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

/**
 * The highlight a reply actually leaned on, or nothing.
 *
 * The model isn't asked to cite, so this reads the finished reply back against
 * the reader's own highlights and only claims a source when most of a
 * highlight's content words turn up in the answer. A miss shows no card, which
 * is the point — a card that appears when the reply didn't use the highlight
 * would be worse than no card at all.
 */
function citedHighlight(reply: string, highlights: Annotation[]) {
  const hay = reply.toLowerCase();
  let best: Annotation | undefined;
  let bestScore = 0.6;
  for (const h of highlights) {
    const words = keyWords(h.text);
    if (words.length < 3) continue;
    const score = words.filter((w) => hay.includes(w)).length / words.length;
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best ? { page: best.page, text: best.text } : undefined;
}

export function LexiBubble({ onPress }: { onPress: () => void }) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tap
      onPress={onPress}
      scale={0.95}
      style={{
        position: "absolute",
        left: 18,
        bottom: 24 + insets.bottom,
        zIndex: 31,
      }}
    >
      <Box
        align="center"
        bg={t.card}
        borderColor={t.line}
        borderWidth={1}
        direction="row"
        gap={8}
        paddingLeft={12}
        paddingRight={16}
        paddingY={10}
        rounded={24}
        style={{
          shadowColor: "#14100C",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.2,
          shadowRadius: 26,
          elevation: 8,
        }}
      >
        <IconSpark color={t.accent} size={16} />
        <Text size={13} weight="600">
          Hey Liqrai
        </Text>
      </Box>
    </Tap>
  );
}

/** The document Liqrai is allowed to talk about. */
export interface LexiBook {
  title: string;
  author?: string;
  /**
   * Sync key of the document (64 hex, from `docKeyFor`), so the model can reach
   * its indexed text. Required — `/ai/chat` rejects a turn without one, so a
   * screen that hasn't derived it yet should hold the panel closed rather than
   * open it on a document Liqrai can't look up.
   */
  docKey: string;
  page: number;
  /** Title of the section the page falls in, when the document names one. */
  chapter?: string;
  /** Text of the page in view, so answers can quote what's on screen. */
  excerpt?: string;
  /**
   * This device's pointer to the document. Only used to find its annotations:
   * a highlight made offline has no `docKey` yet, so matching on that alone
   * would silently drop the newest ones.
   */
  uri?: string;
}

export function LexiSheet({
  ask,
  book,
  onClose,
}: {
  /**
   * A question the panel opens holding — sent from somewhere else in the
   * reader, like the card behind a flagged claim. It lands in the composer as a
   * draft rather than being sent, the same rule the opener chips follow: the
   * reader gets to see, edit or drop it before it goes anywhere.
   */
  ask?: string;
  /**
   * Omitted by the prototype reader, which has no real document behind it and
   * falls back to its scripted replies.
   */
  book?: LexiBook;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const explStyle = useAppStore((s) => s.explStyle);
  // The typeface chosen in the reader's settings, carried into the chat. The
  // reply is reading too, and someone who needs Atkinson to read the book needs
  // it here as well.
  const fontFam = useAppStore((s) => s.fontFam);
  const bodyFont = readerBodyFont(fontFam);
  // `Text` sets a family on every instance, so a nested span would drop back to
  // the app's own sans unless it is told too — the trail below is nested spans.
  const bodyFontBold = readerBodyFont(fontFam, true);
  const bodySerif = fontFam === "serif";
  const showToast = useToastStore((s) => s.showToast);
  const setQuota = useAuthStore((s) => s.setQuota);
  const openWall = useAuthStore((s) => s.openWall);
  const annotations = useAnnotationsStore((s) => s.items);

  const scrollRef = useRef<ScrollView>(null);
  const panelWidth = Math.min(width * 0.9, 420);

  const waveBars = Math.floor(width / 6);

  // ── enter / exit ───────────────────────────────────────────────
  // `anim` drives both the slide and the backdrop fade; the exit runs to
  // completion before `onClose` unmounts us, so the panel is never yanked.
  const anim = useSharedValue(0);
  const kb = useReanimatedKeyboardAnimation();

  // The entrance runs off first layout rather than an effect: the panel starts
  // parked off the right edge, so it can only slide in once it has been laid
  // out there. (It also has to be written before any hook closes over `anim` —
  // the compiler rules forbid mutating a value a hook already captured.)
  const entered = useRef(false);
  const onPanelLayout = () => {
    if (entered.current) return;
    entered.current = true;
    anim.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  };

  const close = useCallback(() => {
    Keyboard.dismiss();
    anim.value = withTiming(
      0,
      { duration: 200, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
    // `anim` is a shared value — stable across renders, so it stays out of deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - anim.value) * panelWidth }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: anim.value }));
  // `kb.height` is negative as the keyboard rises; padding the content area by
  // it lifts the composer and shortens the message list by the same amount.
  const contentStyle = useAnimatedStyle(() => ({
    paddingBottom: -kb.height.value,
  }));
  // The home-indicator inset is only worth reserving while the keyboard is
  // down — with it up, the gesture bar is behind the keyboard.
  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: 10 + insets.bottom * (1 - kb.progress.value),
  }));

  // The conversation is keyed to the book itself (its docKey), so reopening the
  // panel on the same document continues the same thread rather than starting a
  // fresh one — which is what lets prior turns be loaded back below.
  const sessionId = book?.docKey ?? "";

  // Everything this reader has marked up in this document, newest first.
  const docNotes = useMemo(() => {
    if (!book) return [];
    return annotations
      .filter(
        (a) =>
          (book.uri && a.uri === book.uri) ||
          (a.docKey && a.docKey === book.docKey),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [annotations, book]);

  // Where the reader is, and nothing else — the chapter is dropped rather than
  // padded out when the document has no outline to name one.
  const subtitle = book
    ? [`Page ${book.page}`, book.chapter?.trim() || null]
        .filter(Boolean)
        .join(" · ")
    : "Chapter 3";

  // Deliberately says nothing about what kind of document this is. The opener
  // is written before anything has been asked, and the only thing on hand to
  // guess from is a filename — which is as likely to be a scanner's serial as
  // it is a title. Offering a book's "where the argument is going" over
  // someone's CV reads worse than staying plain.
  const greeting = useMemo<LexiMsg[]>(
    () =>
      book
        ? [
            {
              role: "lexi",
              kind: "normal",
              text: `I've got ${book.title} open in front of me. Ask about anything in it — a line you're stuck on, something that needs unpacking, or what a page adds up to.`,
            },
          ]
        : LEXI_SEED,
    [book],
  );

  const initialHistory = book ? cachedChatHistory(sessionId) : undefined;
  const [messages, setMessages] = useState<LexiMsg[]>(() =>
    // `?? greeting` alone was not enough: a cached *empty* history is an array,
    // so it satisfied the coalesce and opened the panel on nothing at all —
    // no greeting, no thread, and no way to tell which had happened.
    initialHistory?.length
      ? initialHistory.map((m) => ({
          role: m.role === "user" ? "user" : "lexi",
          kind: m.kind,
          text: m.content,
        }))
      : greeting,
  );
  // Wait for the persisted thread before mounting the list. Rendering the
  // greeting first and replacing it with history made the panel visibly jump
  // from the top of the conversation to the bottom on open.
  const [historyReady, setHistoryReady] = useState(
    !book || initialHistory !== undefined,
  );
  const [historyVisible, setHistoryVisible] = useState(!book);
  // Seeded from `ask` when the panel is opened from elsewhere in the reader —
  // as a draft, never a send. Only the initial value: re-sending the same
  // question because the prop happened to still be set would be worse.
  const [input, setInput] = useState(ask ?? "");
  const [inputH, setInputH] = useState(INPUT_MIN);
  // Confirmation for wiping the thread, and the wipe itself once confirmed.
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  // The reply currently streaming in, shown as a live bubble; null when idle.
  const [streaming, setStreaming] = useState<string | null>(null);
  const busy = streaming !== null;
  const rabbitCount = useRef(0);
  const replyIdx = useRef(0);
  const lastQuestion = useRef("");
  const abortRef = useRef<(() => void) | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const initiallyPositioned = useRef(false);
  const staysAtBottom = useRef(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Text accumulated for the in-flight reply — read on completion, off-render.
  const accRef = useRef("");
  // Read inside the stream callbacks, which close over the turn they started on.
  const notesRef = useRef(docNotes);
  useEffect(() => {
    notesRef.current = docNotes;
  }, [docNotes]);

  // Rehydrate the book's earlier conversation, so the reader picks up where
  // they left off instead of a blank slate every time the panel opens.
  useEffect(() => {
    if (!book || !sessionId) return;
    // The document screen normally preloads this before the drawer mounts.
    // In that case the state above already contains the complete thread.
    if (cachedChatHistory(sessionId) !== undefined) return;
    let cancelled = false;
    initiallyPositioned.current = false;
    staysAtBottom.current = true;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setShowScrollTop(false);
        setHistoryReady(false);
        return fetchChatHistory(sessionId);
      })
      .then((history) => {
        if (cancelled) return;
        // `null` is "couldn't reach it", which is not the same as "nothing was
        // ever said here" — say so, rather than opening on a greeting that
        // reads as a conversation that has been lost.
        if (history === null) {
          showToast("Couldn't load this conversation — check your connection");
        }
        setMessages(
          history?.length
            ? history.map((m) => ({
                role: m.role === "user" ? "user" : "lexi",
                kind: m.kind,
                text: m.content,
              }))
            : greeting,
        );
        setHistoryVisible(false);
        setHistoryReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [book, greeting, sessionId, showToast]);

  // Abort any in-flight stream if the panel unmounts mid-reply.
  useEffect(() => () => abortRef.current?.(), []);

  // The list shrinks when the keyboard opens; keep the newest replies in view.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    return () => show.remove();
  }, []);

  const push = (msg: LexiMsg) => setMessages((prev) => [...prev, msg]);
  const scrollToEnd = useCallback((animated = true, force = false) => {
    if ((!force && !staysAtBottom.current) || scrollFrame.current !== null) {
      return;
    }
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);
  const onMessagesScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      const distanceFromBottom = Math.max(
        0,
        contentSize.height - (contentOffset.y + layoutMeasurement.height),
      );
      staysAtBottom.current = distanceFromBottom <= 24;
      // The list opens at the latest message. The control belongs to the
      // backwards journey through history, not to that initial position.
      const awayFromLatest =
        distanceFromBottom >= SCROLL_TO_TOP_REVEAL_DISTANCE;
      setShowScrollTop((visible) =>
        visible === awayFromLatest ? visible : awayFromLatest,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      if (scrollFrame.current !== null) {
        cancelAnimationFrame(scrollFrame.current);
      }
    },
    [],
  );

  // ── read a reply aloud ─────────────────────────────────────────
  // Same off-screen WebView trick as the word card: no native audio module, so
  // it works without a rebuild. `key` is the bubble being read (so only that
  // one shows a stop button) and `seq` replays the same bubble on a re-tap.
  const [voice, setVoice] = useState<{
    key: number;
    seq: number;
    url?: string;
    /** Which token to light, and when — empty when alignment wasn't available. */
    spans?: WordSpan[];
  } | null>(null);
  /**
   * The token the voice is on. Held apart from `voice` deliberately: the
   * WebView below is memoised on `voice`, so folding this into it would rebuild
   * the player several times a second and restart the audio on every word.
   */
  const [spokenAt, setSpokenAt] = useState(-1);

  const audioNode = useMemo(() => {
    if (!voice?.url) return null;
    // The page reports two things: that the clip ran out — which flips the
    // bubble's stop button back to a speaker on its own — and which word is
    // being said. The word is worked out *here* rather than in React and sent
    // only when it changes, so following a reply costs a handful of messages
    // rather than one per frame.
    const spans = JSON.stringify(voice.spans ?? []);
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><audio id="a" autoplay playsinline src="${voice.url}"></audio><script>
var a=document.getElementById('a');
var S=${spans};
var last=-1;
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
function tick(){
  if(S.length){
    /* The furthest word started, not the word straddling the clock. Words do
       not butt up against each other — there is a gap at every comma, every
       full stop, every breath — and asking "which word contains this instant"
       answers "none" in all of them, blanking the trail between one word and
       the next. This only ever moves forward. */
    var t=a.currentTime,i=last;
    for(var k=0;k<S.length;k++){if(S[k].s>t)break;i=S[k].i}
    if(i!==last){last=i;post('w:'+i)}
  }
  if(!a.paused&&!a.ended)requestAnimationFrame(tick);
}
a.addEventListener('playing',function(){requestAnimationFrame(tick)});
var done=function(){post('ended')};
a.addEventListener('ended',done);a.addEventListener('error',done);
</script></body></html>`;
    return (
      <WebView
        allowsInlineMediaPlayback
        // Both styles matter: the container defaults to `flex: 1`, which would
        // otherwise eat half the panel's column height.
        containerStyle={ZERO_SIZE}
        key={voice.seq}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        onMessage={(e) => {
          const data = e.nativeEvent.data;
          if (data.startsWith("w:")) setSpokenAt(Number(data.slice(2)));
          else setVoice(null);
        }}
        pointerEvents="none"
        source={{ html }}
        style={ZERO_SIZE}
      />
    );
  }, [voice]);

  /** Speak this bubble, or stop it if it is the one already speaking. */
  const toggleVoice = async (key: number, text: string) => {
    if (voice?.key === key) {
      setVoice(null);
      return;
    }
    const seq = (voice?.seq ?? 0) + 1;
    setVoice({ key, seq });
    setSpokenAt(-1);
    const { audioUrl, words } = await speakText(text);
    // A stop, or a tap on another bubble, happened while the clip was being
    // fetched — that newer intent wins.
    setVoice((cur) =>
      cur && cur.seq === seq
        ? audioUrl
          ? { ...cur, spans: alignWords(tokenize(text), words), url: audioUrl }
          : null
        : cur,
    );
  };

  /**
   * The bubble being read, split for the highlight. Only the one — tokenising
   * every reply in the thread to light a word in one of them would be work
   * thrown away, and this is rebuilt as often as the reply is played.
   */
  const spokenTokens = useMemo(() => {
    if (!voice?.url || !voice.spans?.length) return null;
    const text = messages[voice.key]?.text;
    return text ? tokenize(text) : null;
  }, [messages, voice]);

  /**
   * What Liqrai can see beyond the page text: the passages this reader marked
   * up, so an answer can build on what they already thought was worth keeping —
   * and so the source card below has something real to quote back.
   */
  const readerContext = () => {
    if (!book) return undefined;
    const onPage = docNotes.filter((a) => a.page === book.page);
    const others = docNotes.filter((a) => a.page !== book.page).slice(0, 6);
    const lines = [...onPage, ...others]
      .slice(0, 10)
      .map(
        (a) =>
          `- p.${a.page} "${a.text}"${
            a.note.trim() ? ` — their note: ${a.note.trim()}` : ""
          }`,
      );
    if (!lines.length) return book.excerpt;
    return [book.excerpt, `The reader's highlights:\n${lines.join("\n")}`]
      .filter(Boolean)
      .join("\n\n");
  };

  /**
   * One typed turn, streamed into the transcript.
   *
   * Resolves when the reply is complete and rejects when it failed. Spoken
   * turns do not come through here — the live conversation runs device to
   * model and arrives already finished — but they land in the same transcript.
   */
  const runChat = (q: string) =>
    new Promise<void>((resolve, reject) => {
      accRef.current = "";
      setStreaming("");

      let settled = false;
      const input = {
        author: book!.author,
        docKey: book!.docKey,
        excerpt: readerContext(),
        message: q,
        page: book!.page,
        sessionId,
        style: explStyle,
        title: book!.title,
      };

      const handlers = {
        onToken: (token: string) => {
          accRef.current += token;
          setStreaming(accRef.current);
          scrollToEnd();
        },
        onDone: ({ kind, quota }: { kind: LexiMsg["kind"]; quota?: AiQuota }) => {
          settled = true;
          abortRef.current = null;
          setStreaming(null);
          if (quota) setQuota(quota);
          const text = accRef.current.trim();
          if (text) {
            push({
              role: "lexi",
              kind,
              text,
              cite: citedHighlight(text, notesRef.current),
            });
            // The answer landed — a soft tap says so without stealing the eyes
            // back from the page you were reading.
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          scrollToEnd();
          resolve();
        },
        onError: (error: unknown) => {
          settled = true;
          abortRef.current = null;
          setStreaming(null);
          // Out of credits: bank it, raise the wall, and get out of the way.
          if (error instanceof AiQuotaError) {
            setQuota(error.quota);
            if (error.requiresAuth) openWall("quota");
            close();
            reject(error);
            return;
          }
          push({
            role: "lexi",
            kind: "error",
            text:
              error instanceof Error
                ? error.message
                : "Liqrai couldn't answer just then.",
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          scrollToEnd();
          reject(error);
        },
      };

      streamChat(input, handlers)
        .then((abort) => {
          // A cached turn can finish before its own abort handle exists;
          // keeping it then would leave a spent stream armed for cancelling.
          if (!settled) abortRef.current = abort;
        })
        .catch(handlers.onError);
    });

  const canSend = input.trim().length > 0 && !busy;
  // Nothing but the opener means there is nothing to clear.
  const canClear = messages.length > 1 && !busy;

  /**
   * Wipe the thread — on the server first. Clearing only the device would look
   * like it worked right up until the panel reopened and refetched the history,
   * so a failed delete leaves the conversation where it is and says so.
   */
  const clearThread = async () => {
    if (clearing) return;
    setClearing(true);
    const gone = book ? await clearChatHistory(sessionId) : true;
    setClearing(false);
    setConfirmClear(false);

    if (!gone) {
      showToast("Couldn't clear that conversation — try again");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    // The prototype's seeded demo would be odd to "restore" after a wipe, so
    // only a real document gets its opener back.
    setMessages(book ? greeting : []);
    setVoice(null);
    lastQuestion.current = "";
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Conversation cleared");
  };

  const submit = (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    push({ role: "user", kind: "normal", text: q });
    setInput("");
    setInputH(INPUT_MIN);
    scrollToEnd();

    // No document behind the panel — the prototype reader's scripted path.
    if (!book) {
      push(scriptedReply(q, rabbitCount, replyIdx));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scrollToEnd();
      return;
    }

    lastQuestion.current = q;
    // The handlers have already put the failure in the transcript; this only
    // keeps the rejection from surfacing as an unhandled one.
    runChat(q).catch(() => {});
  };

  const retry = () => {
    if (!book || busy || !lastQuestion.current) return;
    // Drop the error bubble it's attached to, then ask again.
    setMessages((prev) =>
      prev.length && prev[prev.length - 1].kind === "error"
        ? prev.slice(0, -1)
        : prev,
    );
    runChat(lastQuestion.current).catch(() => {});
  };

  // ── voice ──────────────────────────────────────────────────────
  // Named `mic` because `voice` above is the other direction: reading a reply
  // aloud. This one is the reader talking to Liqrai — a held button that drafts
  // what they said into the composer for them to check before it goes.
  const mic = useVoiceInput(showToast, {
    onTranscript: (text) =>
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text)),
  });

  /**
   * The live conversation. A separate path from `runChat` on purpose: the audio
   * never passes through our server, so what arrives here is a finished
   * exchange rather than a stream to render. It lands in the same transcript.
   */
  const live = useRealtimeVoice({
    context: () =>
      book
        ? {
            author: book.author,
            docKey: book.docKey,
            page: book.page,
            style: explStyle,
            title: book.title,
          }
        : null,
    handlers: {
      onAsk: (text) => {
        push({ role: "user", kind: "normal", text });
        lastQuestion.current = text;
        setStreaming("");
        scrollToEnd();
      },
      onReplyProgress: (text) => {
        setStreaming(text);
        scrollToEnd();
      },
      onTurn: ({ message, reply }) => {
        setStreaming(null);
        push({
          role: "lexi",
          kind: "normal",
          text: reply,
          cite: citedHighlight(reply, notesRef.current),
        });
        scrollToEnd();
        // Kept and charged for out of band: the call itself never reaches our
        // server, so this is the only record of it that ever will.
        recordRealtimeTurn({
          docKey: book!.docKey,
          message,
          page: book!.page,
          reply,
          sessionId,
          title: book!.title,
        })
          .then((quota) => {
            if (quota) setQuota(quota);
          })
          .catch((error) => {
            if (!(error instanceof AiQuotaError)) return;
            setQuota(error.quota);
            if (error.requiresAuth) openWall("quota");
            live.stop();
            close();
          });
      },
      onError: showToast,
    },
  });

  const startLive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Nothing half-typed is lost: the composer is empty whenever the control
    // that starts this is on screen.
    Keyboard.dismiss();
    setVoice(null);
    live.start();
  };

  const endLive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStreaming(null);
    live.stop();
  };

  /**
   * End the recording and drop what was said into the composer.
   *
   * A transcript is a guess at speech, so it lands as an editable draft rather
   * than being sent — the same rule the opener chips follow. Appending instead
   * of replacing means dictating twice, or dictating onto something already
   * typed, adds to the question rather than eating it.
   */
  const finishVoice = async () => {
    try {
      const text = await mic.stop();
      if (!text) return;
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // Out of credits — the hook leaves the wall to us, since it is this
      // panel that has to get out of the way behind it.
      if (error instanceof AiQuotaError) {
        setQuota(error.quota);
        if (error.requiresAuth) openWall("quota");
        close();
      }
    }
  };

  const startVoice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void mic.start();
  };

  // ── a message ──────────────────────────────────────────────────
  const renderMessage = (m: LexiMsg, i: number): ReactNode => {
    const user = m.role === "user";
    const special = m.kind === "drift" || m.kind === "recap";
    const isError = m.kind === "error";
    // `armed` covers the wait for the clip too, so the button reacts to the tap
    // instead of sitting dead until the voice comes back off the network.
    const armed = voice?.key === i;
    const playing = armed && Boolean(voice?.url);
    const loading = armed && !playing;
    // Focus, the same as the reader's: while one reply is being read the rest
    // of the thread steps back, at the same 0.27 the page dims to, so the two
    // feel like one idea rather than two features that both dim things.
    const dimmed = Boolean(voice?.url) && !playing;
    return (
      <Box key={i} paddingY={5} style={{ opacity: dimmed ? 0.27 : 1 }}>
        <Box
          bg={user ? t.onAccent : isError ? t.accentSoft : t.card}
          borderColor={
            isError
              ? t.accentMid
              : special
                ? t.accentMid
                : user
                  ? t.onAccent
                  : t.line
          }
          borderWidth={1}
          gap={9}
          paddingX={14}
          paddingY={11}
          rounded={16}
          style={{
            alignSelf: user ? "flex-end" : "flex-start",
            maxWidth: "88%",
            ...(user
              ? null
              : {
                  shadowColor: "#14100C",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: t.dark ? 0 : 0.05,
                  shadowRadius: 8,
                  elevation: 1,
                }),
          }}
        >
          {/* While this reply is being read it is drawn in three pieces:
              what has been said, the word being said, and what is still to
              come. A single moving highlight says where the voice is but not
              how far it has got, which leaves you scanning the paragraph to
              work out what you have already heard.

              Sliced rather than mapped per word — three Texts instead of one
              per token, rebuilt several times a second. Every other bubble
              stays a single plain string. */}
          <Text
            color={user ? t.pill : t.ink}
            lh={21}
            serif={bodySerif}
            size={13.5}
            style={bodyFont ? { fontFamily: bodyFont } : undefined}
          >
            {playing && spokenTokens && spokenAt >= 0 ? (
              <>
                <Text
                  color={t.accentText}
                  serif={bodySerif}
                  style={bodyFont ? { fontFamily: bodyFont } : undefined}
                >
                  {spokenTokens.slice(0, spokenAt).join("")}
                </Text>
                <Text
                  serif={bodySerif}
                  style={{
                    backgroundColor: t.accentSoft,
                    color: t.accentText,
                    ...(bodyFontBold ? { fontFamily: bodyFontBold } : null),
                  }}
                  weight="600"
                >
                  {spokenTokens[spokenAt] ?? ""}
                </Text>
                {spokenTokens.slice(spokenAt + 1).join("")}
              </>
            ) : (
              m.text
            )}
          </Text>
          {isError ? (
            <Tap
              onPress={retry}
              scale={0.95}
              style={{ alignSelf: "flex-start" }}
            >
              <Box bg={t.accentSoft} paddingX={12} paddingY={8} rounded={10}>
                <Text color={t.accent} size={12} weight="600">
                  Try again
                </Text>
              </Box>
            </Tap>
          ) : null}
          {m.kind === "drift" ? (
            <Tap
              onPress={close}
              scale={0.95}
              style={{ alignSelf: "flex-start" }}
            >
              <Box bg={t.accentSoft} paddingX={12} paddingY={8} rounded={10}>
                <Text color={t.accent} size={12} weight="600">
                  Back to reading
                </Text>
              </Box>
            </Tap>
          ) : null}
          {/* {m.kind === "recap" ? (
            <Box
              bg={t.calmSoft}
              paddingX={9}
              paddingY={4}
              rounded={10}
              style={{ alignSelf: "flex-start" }}
            >
              <Text color={t.calm} size={10.5} weight="600">
                You’re on track ✓
              </Text>
            </Box>
          ) : null} */}
          {/* Read aloud in Liqrai's voice — bottom right of the bubble. While
              this is the reply speaking it waves; tapping it stops. */}
          {!user && !isError ? (
            <Tap
              onPress={() => toggleVoice(i, m.text)}
              scale={0.88}
              // Tucked into the bubble's own padding: a full 32pt tap target
              // that doesn't make every reply that much taller.
              style={{
                alignSelf: "flex-end",
                marginBottom: -5,
                marginRight: -5,
              }}
            >
              <Box
                align="center"
                bg={armed ? t.accentSoft : "transparent"}
                height={32}
                justify="center"
                rounded={16}
                width={32}
              >
                {playing ? (
                  <SpeakingWave color={t.accent} />
                ) : loading ? (
                  <ActivityIndicator color={t.accent} size="small" />
                ) : (
                  <IconSpeaker color={t.sub} size={16} />
                )}
              </Box>
            </Tap>
          ) : null}
        </Box>

        {/* The highlight the answer drew on, quoted back under it. */}
        {m.cite ? (
          <Box
            bg={t.accentSoft}
            marginTop={7}
            paddingLeft={13}
            paddingRight={14}
            paddingY={11}
            rounded={12}
            style={{
              alignSelf: "flex-start",
              maxWidth: "88%",
              borderLeftWidth: 3,
              borderLeftColor: t.accent,
            }}
          >
            <Text color={t.accentText} ls={0.7} size={9.5} upper weight="700">
              {`From your highlight · p. ${m.cite.page}`}
            </Text>
            <Text
              color={t.readerInk}
              italic
              lh={20}
              serif
              size={13}
              style={{ marginTop: 6 }}
            >
              {`“${m.cite.text}”`}
            </Text>
          </Box>
        ) : null}
      </Box>
    );
  };

  return (
    <>
      <Reanimated.View
        style={[
          backdropStyle,
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "rgba(20,16,12,.38)",
            zIndex: 38,
          },
        ]}
      >
        <Pressable onPress={close} style={{ flex: 1 }} />
      </Reanimated.View>

      <Reanimated.View
        onLayout={onPanelLayout}
        style={[
          panelStyle,
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: panelWidth,
            zIndex: 39,
            shadowColor: "#14100C",
            shadowOffset: { width: -12, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 40,
            elevation: 24,
          },
        ]}
      >
        {/* Radius + clipping live here so the outer view keeps its shadow. */}
        <Reanimated.View
          style={[
            contentStyle,
            {
              flex: 1,
              backgroundColor: t.bg,
              borderTopLeftRadius: 22,
              borderBottomLeftRadius: 22,
              overflow: "hidden",
              paddingTop: insets.top,
            },
          ]}
        >
          {audioNode}

          <Box
            align="center"
            direction="row"
            gap={11}
            paddingX={16}
            paddingY={14}
          >
            <Image
              // The app icon carries its own dark ground, so it needs no plate
              // behind it — just the same rounding as the badge it replaced.
              contentFit="cover"
              source={require("@/assets/images/icon.png")}
              style={{ width: 34, height: 34, borderRadius: 11 }}
            />
            <Box flex={1} gap={2}>
              <Text size={14.5} weight="700">
                Reading companion
              </Text>
              <Text color={t.sub} numberOfLines={1} size={11}>
                {subtitle}
              </Text>
            </Box>
            {/* Only offered once there is a thread to lose. */}
            {canClear ? (
              <Tap onPress={() => setConfirmClear(true)} scale={0.9}>
                <Box
                  align="center"
                  height={32}
                  justify="center"
                  rounded={16}
                  width={32}
                >
                  <IconTrash color={t.sub} size={16} />
                </Box>
              </Tap>
            ) : null}
            <Tap onPress={close}>
              <Box
                align="center"
                height={32}
                justify="center"
                rounded={10}
                width={32}
              >
                <IconClose color={t.sub} size={15} />
              </Box>
            </Tap>
          </Box>

          <Box flex={1} style={{ position: "relative" }}>
            {historyReady ? (
              <Box flex={1} style={{ opacity: historyVisible ? 1 : 0 }}>
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => {
                    if (!initiallyPositioned.current) {
                      initiallyPositioned.current = true;
                      scrollToEnd(false, true);
                      // Queue behind `scrollToEnd`'s frame so the reader sees
                      // the list only after it is already at the latest turn.
                      requestAnimationFrame(() => {
                        setHistoryVisible(true);
                      });
                    } else {
                      scrollToEnd();
                    }
                  }}
                  onScroll={onMessagesScroll}
                  ref={scrollRef}
                  scrollEventThrottle={16}
                  style={{ flex: 1 }}
                >
                  {messages.map(renderMessage)}

                  {/* The reply as it streams in — a placeholder until the first token. */}
                  {streaming !== null ? (
                    <Box paddingY={5}>
                      <Box
                        bg={t.card}
                        borderColor={t.line}
                        borderWidth={1}
                        paddingX={14}
                        paddingY={11}
                        rounded={16}
                        style={{ alignSelf: "flex-start", maxWidth: "88%" }}
                      >
                        {streaming ? (
                          <Text
                            color={t.ink}
                            lh={21}
                            serif={bodySerif}
                            size={13.5}
                            style={
                              bodyFont ? { fontFamily: bodyFont } : undefined
                            }
                          >
                            {streaming}
                          </Text>
                        ) : (
                          <TypingDots color={t.accent} />
                        )}
                      </Box>
                    </Box>
                  ) : null}
                </ScrollView>
              </Box>
            ) : (
              <Box align="center" flex={1} justify="center">
                <ActivityIndicator color={t.accent} size="small" />
              </Box>
            )}

            {historyReady && showScrollTop ? (
              <Tap
                onPress={() =>
                  scrollRef.current?.scrollTo({ animated: true, y: 0 })
                }
                scale={0.9}
                style={{ bottom: 14, position: "absolute", right: 16 }}
              >
                <Box
                  align="center"
                  bg={t.card}
                  borderColor={t.line}
                  borderWidth={1}
                  height={38}
                  justify="center"
                  rounded={19}
                  style={{
                    elevation: 3,
                    shadowColor: "#14100C",
                    shadowOpacity: 0.14,
                    shadowRadius: 6,
                  }}
                  width={38}
                >
                  <Box style={{ transform: [{ rotate: "90deg" }] }}>
                    <IconBack color={t.ink} size={17} />
                  </Box>
                </Box>
              </Tap>
            ) : null}
          </Box>

          {/* Sticky footer: openers while idle, then the composer. */}
          <Reanimated.View style={[composerStyle, { paddingTop: 6 }]}>
            {!busy && !input.trim() && mic.phase === "idle" && !live.on ? (
              <Box
                direction="row"
                gap={7}
                paddingBottom={9}
                paddingX={14}
                wrap="wrap"
              >
                {/* An opener is a draft, not a send — it lands in the composer
                    so it can be edited before it goes anywhere. */}
                {!messages?.length &&
                  STARTERS.map((s) => (
                    <Tap key={s} onPress={() => setInput(s)} scale={0.96}>
                      <Box
                        bg={t.chip}
                        borderColor={t.line}
                        borderWidth={1}
                        paddingX={14}
                        paddingY={9}
                        rounded={20}
                      >
                        <Text color={t.ink} size={12.5} weight="500">
                          {s}
                        </Text>
                      </Box>
                    </Tap>
                  ))}
              </Box>
            ) : null}

            {live.on ? (
              /* A conversation, not a composer. There is only one control:
                 hanging up. Interrupting used to need a button and now doesn't
                 — the reader just talks over it, the way they would with a
                 person, and the model stops. */
              <Box align="center" direction="row" gap={10} paddingX={12}>
                <Tap onPress={endLive} scale={0.9}>
                  <Box
                    align="center"
                    height={38}
                    justify="center"
                    rounded={19}
                    width={38}
                  >
                    <IconClose color={t.sub} size={16} />
                  </Box>
                </Tap>

                <Box
                  align="center"
                  bg={t.chip}
                  borderColor={
                    live.phase === "listening" ? t.accentMid : t.line
                  }
                  borderWidth={1}
                  direction="row"
                  flex={1}
                  gap={10}
                  paddingX={14}
                  paddingY={9}
                  rounded={22}
                >
                  {live.phase === "connecting" ? (
                    <>
                      <ActivityIndicator color={t.accent} size="small" />
                      <Text color={t.sub} size={12}>
                        Connecting…
                      </Text>
                    </>
                  ) : live.phase === "speaking" ? (
                    <>
                      <SpeakingWave color={t.accent} />
                      <Box flex={1}>
                        <Text color={t.sub} size={12}>
                          Speaking
                        </Text>
                      </Box>
                      <Text color={t.accent} size={11.5} weight="600">
                        Talk to cut in
                      </Text>
                    </>
                  ) : live.phase === "thinking" ? (
                    <>
                      <TypingDots color={t.accent} />
                      <Box flex={1}>
                        <Text color={t.sub} size={12}>
                          Thinking…
                        </Text>
                      </Box>
                    </>
                  ) : (
                    <>
                      <SpeakingWave color={t.accent} />
                      <Box flex={1}>
                        <Text color={t.sub} size={12}>
                          Listening — just talk
                        </Text>
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            ) : mic.phase !== "idle" ? (
              /* Recording takes the composer's place rather than sitting
                 beside it: while the mic is open there is nothing else to do
                 down here, and the three targets — discard, level, keep —
                 want the whole width. */
              <Box align="center" direction="row" gap={10} paddingX={12}>
                <Tap
                  disabled={mic.phase !== "recording"}
                  onPress={() => void mic.cancel()}
                  scale={0.9}
                >
                  <Box
                    align="center"
                    height={38}
                    justify="center"
                    rounded={19}
                    width={38}
                  >
                    <IconClose color={t.sub} size={16} />
                  </Box>
                </Tap>

                <Box
                  align="center"
                  bg={t.chip}
                  borderColor={t.line}
                  borderWidth={1}
                  direction="row"
                  flex={1}
                  gap={10}
                  paddingX={14}
                  paddingY={9}
                  rounded={22}
                >
                  {mic.phase === "recording" ? (
                    <>
                      {/* Fed the microphone's real level, so silence reads as
                          silence — the reader can see they're being heard. */}
                      <Box flex={1}>
                        <LiveWave
                          color={t.accent}
                          level={mic.level}
                          style={{
                            width: "100%",
                          }}
                          waveStyle={{ flex: 1 }}
                        />
                      </Box>
                      <Text
                        color={t.sub}
                        size={12}
                        style={{ minWidth: 38, textAlign: "right" }}
                        weight="600"
                      >
                        {mmss(mic.seconds)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator color={t.accent} size="small" />
                      {/* <Text color={t.sub} size={13}>
                        Turning that into words…
                      </Text> */}
                    </>
                  )}
                </Box>

                <Tap
                  disabled={mic.phase !== "recording"}
                  onPress={() => void finishVoice()}
                  scale={0.92}
                >
                  <Box
                    align="center"
                    bg={mic.phase === "recording" ? t.accent : t.line}
                    height={38}
                    justify="center"
                    rounded={19}
                    width={38}
                  >
                    <IconCheck
                      color={mic.phase === "recording" ? t.onAccent : t.sub}
                      size={16}
                    />
                  </Box>
                </Tap>
              </Box>
            ) : (
              <Box align="end" direction="row" gap={8} paddingX={12}>
                <Box
                  align="end"
                  bg={t.chip}
                  borderColor={t.line}
                  borderWidth={1}
                  direction="row"
                  flex={1}
                  paddingLeft={16}
                  paddingRight={6}
                  paddingY={7}
                  rounded={22}
                >
                  <TextInput
                    backgroundColor="transparent"
                    borderColor="transparent"
                    borderWidth={0}
                    multiline
                    onChangeText={setInput}
                    // Grows with the draft, then scrolls once it hits the cap.
                    onContentSizeChange={(e) =>
                      setInputH(e.nativeEvent.contentSize.height)
                    }
                    placeholder="Ask about this page…"
                    placeholderTextColor={t.faint}
                    pl={0}
                    px={0}
                    py={0}
                    rounded={0}
                    scrollEnabled={inputH >= INPUT_MAX}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: Math.min(Math.max(inputH, INPUT_MIN), INPUT_MAX),
                      paddingTop: 0,
                      paddingBottom: 0,
                      fontFamily: sansFamily["400"],
                      fontSize: 15,
                      lineHeight: 21,
                      color: t.ink,
                      textAlignVertical: "top",
                    }}
                    value={input}
                  />
                </Box>
                {/* One button, two jobs: with a draft to send it sends, and
                  with an empty composer it offers the mic instead. Nothing is
                  typed, so nothing is lost by giving the slot away. */}
                {input.trim() || busy ? (
                  <Tap
                    disabled={!canSend}
                    onPress={() => submit(input)}
                    scale={0.92}
                  >
                    <Box
                      align="center"
                      bg={canSend ? t.accent : t.line}
                      height={38}
                      justify="center"
                      rounded={19}
                      width={38}
                    >
                      <IconSend
                        color={canSend ? t.onAccent : t.sub}
                        size={16}
                      />
                    </Box>
                  </Tap>
                ) : (
                  <>
                    {/* Two ways to talk, and the difference is who ends the
                        turn. The mic drafts what you said into the composer so
                        you can read it before it goes; this one hands the whole
                        exchange over and answers you out loud. Only offered on
                        a real document — the scripted reader has no voice. */}
                    {book ? (
                      <Tap onPress={startLive} scale={0.92}>
                        <Box
                          align="center"
                          bg={t.accentSoft}
                          borderColor={t.accentMid}
                          borderWidth={1}
                          height={38}
                          justify="center"
                          rounded={19}
                          width={38}
                        >
                          <IconWave color={t.accent} size={18} />
                        </Box>
                      </Tap>
                    ) : null}
                    <Tap onPress={startVoice} scale={0.92}>
                      <Box
                        align="center"
                        bg={t.chip}
                        borderColor={t.line}
                        borderWidth={1}
                        height={38}
                        justify="center"
                        rounded={19}
                        width={38}
                      >
                        <IconMic color={t.sub} size={17} />
                      </Box>
                    </Tap>
                  </>
                )}
              </Box>
            )}
          </Reanimated.View>
        </Reanimated.View>
      </Reanimated.View>

      {/* CenterModal paints its own white card, so the surface is restyled to
          the reader's theme rather than left light in dark mode. */}
      <CenterModal
        containerStyle={{
          backgroundColor: t.card,
          borderColor: t.line,
          borderWidth: 1,
          padding: 0,
        }}
        marginHorizontal={24}
        onClose={() => (clearing ? undefined : setConfirmClear(false))}
        visible={confirmClear}
      >
        <Box gap={8} paddingTop={22} paddingX={22}>
          <Text size={16} weight="700">
            Clear this conversation?
          </Text>
          <Text color={t.sub} lh={20} size={13}>
            {book
              ? "Everything you and Liqrai have said about this document goes, on this device and on your other ones. What Liqrai has learned about how you like to be explained things stays."
              : "This sample conversation will be cleared."}
          </Text>
        </Box>
        <Box
          direction="row"
          gap={10}
          justify="end"
          paddingBottom={18}
          paddingTop={20}
          paddingX={18}
        >
          <Tap
            disabled={clearing}
            onPress={() => setConfirmClear(false)}
            scale={0.96}
          >
            <Box bg={t.chip} paddingX={16} paddingY={11} rounded={12}>
              <Text size={13.5} weight="600">
                Keep it
              </Text>
            </Box>
          </Tap>
          <Tap disabled={clearing} onPress={clearThread} scale={0.96}>
            <Box
              bg={palette.danger}
              paddingX={16}
              paddingY={11}
              rounded={12}
              style={{ opacity: clearing ? 0.6 : 1 }}
            >
              <Text color="#FFFFFF" size={13.5} weight="600">
                {clearing ? "Clearing…" : "Clear"}
              </Text>
            </Box>
          </Tap>
        </Box>
      </CenterModal>
    </>
  );
}
