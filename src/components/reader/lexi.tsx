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
  Animated,
  Easing as RNEasing,
  Keyboard,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box, TextInput } from "@/components/atoms";
import {
  IconClose,
  IconSend,
  IconSpark,
  IconSpeaker,
  IconTrash,
  Tap,
  Text,
} from "@/components/lexi-components";
import { CenterModal } from "@/components/modals";
import { palette } from "@/constants/colors";
import { LEXI_SEED } from "@/constants/library";
import {
  AiQuotaError,
  clearChatHistory,
  fetchChatHistory,
  speakText,
  streamChat,
} from "@/services/lexi-ai";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { sansFamily } from "@/theme/app-fonts";
import { type Annotation, useAnnotationsStore } from "@/stores/annotations-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProtoTheme } from "@/theme/proto";

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

/**
 * Three bars breathing — shown in place of the speaker icon while a reply is
 * being read aloud, so the bubble that is talking is obvious at a glance.
 * Tapping it is what stops playback.
 */
function SpeakingWave({ color }: { color: string }) {
  const [bars] = useState(() => [
    new Animated.Value(0.45),
    new Animated.Value(1),
    new Animated.Value(0.7),
  ]);

  useEffect(() => {
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          // Staggered, and each bar's cycle is a slightly different length, so
          // they drift apart instead of pulsing as one block.
          Animated.delay(i * 120),
          Animated.timing(bar, {
            toValue: 0.3,
            duration: 300 + i * 40,
            easing: RNEasing.inOut(RNEasing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 1,
            duration: 300 + i * 40,
            easing: RNEasing.inOut(RNEasing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [bars]);

  return (
    <Box align="center" direction="row" gap={2.5} height={14}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 2.5,
            height: 14,
            borderRadius: 1.5,
            backgroundColor: color,
            transform: [{ scaleY: bar }],
          }}
        />
      ))}
    </Box>
  );
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
  book,
  onClose,
}: {
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
  const showToast = useToastStore((s) => s.showToast);
  const setQuota = useAuthStore((s) => s.setQuota);
  const openWall = useAuthStore((s) => s.openWall);
  const annotations = useAnnotationsStore((s) => s.items);

  const scrollRef = useRef<ScrollView>(null);
  const panelWidth = Math.min(width * 0.9, 420);

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

  const [messages, setMessages] = useState<LexiMsg[]>(greeting);
  const [input, setInput] = useState("");
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
    let cancelled = false;
    void fetchChatHistory(sessionId).then((history) => {
      if (cancelled || !history.length) return;
      setMessages(
        history.map((m) => ({
          role: m.role === "user" ? "user" : "lexi",
          kind: m.kind,
          text: m.content,
        })),
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
    });
    return () => {
      cancelled = true;
    };
  }, [book, sessionId]);

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
  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  // ── read a reply aloud ─────────────────────────────────────────
  // Same off-screen WebView trick as the word card: no native audio module, so
  // it works without a rebuild. `key` is the bubble being read (so only that
  // one shows a stop button) and `seq` replays the same bubble on a re-tap.
  const [voice, setVoice] = useState<{
    key: number;
    seq: number;
    url?: string;
  } | null>(null);

  const audioNode = useMemo(() => {
    if (!voice?.url) return null;
    // The clip reports back when it runs out, which is what flips the bubble's
    // stop button back to a speaker without the reader having to touch it.
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><audio id="a" autoplay playsinline src="${voice.url}"></audio><script>var a=document.getElementById('a');var done=function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ended')};a.addEventListener('ended',done);a.addEventListener('error',done);</script></body></html>`;
    return (
      <WebView
        allowsInlineMediaPlayback
        // Both styles matter: the container defaults to `flex: 1`, which would
        // otherwise eat half the panel's column height.
        containerStyle={ZERO_SIZE}
        key={voice.seq}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        onMessage={() => setVoice(null)}
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
    const url = await speakText(text);
    // A stop, or a tap on another bubble, happened while the clip was being
    // fetched — that newer intent wins.
    setVoice((cur) =>
      cur && cur.seq === seq ? (url ? { ...cur, url } : null) : cur,
    );
  };

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
          `- p.${a.page} "${a.text}"${a.note.trim() ? ` — their note: ${a.note.trim()}` : ""}`,
      );
    if (!lines.length) return book.excerpt;
    return [book.excerpt, `The reader's highlights:\n${lines.join("\n")}`]
      .filter(Boolean)
      .join("\n\n");
  };

  const runChat = async (q: string) => {
    accRef.current = "";
    setStreaming("");
    abortRef.current = await streamChat(
      {
        author: book!.author,
        docKey: book!.docKey,
        excerpt: readerContext(),
        message: q,
        page: book!.page,
        sessionId,
        style: explStyle,
        title: book!.title,
      },
      {
        onToken: (token) => {
          accRef.current += token;
          setStreaming(accRef.current);
          scrollToEnd();
        },
        onDone: ({ kind, quota }) => {
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
        },
        onError: (error) => {
          abortRef.current = null;
          setStreaming(null);
          // Out of credits: bank it, raise the wall, and get out of the way.
          if (error instanceof AiQuotaError) {
            setQuota(error.quota);
            if (error.requiresAuth) openWall("quota");
            close();
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
        },
      },
    );
  };

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
    void runChat(q);
  };

  const retry = () => {
    if (!book || busy || !lastQuestion.current) return;
    // Drop the error bubble it's attached to, then ask again.
    setMessages((prev) =>
      prev.length && prev[prev.length - 1].kind === "error"
        ? prev.slice(0, -1)
        : prev,
    );
    void runChat(lastQuestion.current);
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
    return (
      <Box key={i} paddingY={5}>
        <Box
          bg={user ? t.pill : isError ? t.accentSoft : t.card}
          borderColor={
            isError ? t.accentMid : special ? t.calmLine : user ? "transparent" : t.line
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
          <Text color={user ? t.pillText : t.ink} lh={21} size={13.5}>
            {m.text}
          </Text>
          {isError ? (
            <Tap onPress={retry} scale={0.95} style={{ alignSelf: "flex-start" }}>
              <Box bg={t.accentSoft} paddingX={12} paddingY={8} rounded={10}>
                <Text color={t.accent} size={12} weight="600">
                  Try again
                </Text>
              </Box>
            </Tap>
          ) : null}
          {m.kind === "drift" ? (
            <Tap onPress={close} scale={0.95} style={{ alignSelf: "flex-start" }}>
              <Box bg={t.calmSoft} paddingX={12} paddingY={8} rounded={10}>
                <Text color={t.calm} size={12} weight="600">
                  Back to reading
                </Text>
              </Box>
            </Tap>
          ) : null}
          {m.kind === "recap" ? (
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
          ) : null}
          {/* Read aloud in Liqrai's voice — bottom right of the bubble. While
              this is the reply speaking it waves; tapping it stops. */}
          {!user && !isError ? (
            <Tap
              onPress={() => toggleVoice(i, m.text)}
              scale={0.88}
              // Tucked into the bubble's own padding: a full 32pt tap target
              // that doesn't make every reply that much taller.
              style={{ alignSelf: "flex-end", marginBottom: -5, marginRight: -5 }}
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
                ) : (
                  <IconSpeaker color={armed ? t.accent : t.sub} size={16} />
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

          <Box align="center" direction="row" gap={11} paddingX={16} paddingY={14}>
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
              <Box align="center" height={32} justify="center" rounded={10} width={32}>
                <IconClose color={t.sub} size={15} />
              </Box>
            </Tap>
          </Box>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: false })
            }
            ref={scrollRef}
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
                    <Text color={t.ink} lh={21} size={13.5}>
                      {streaming}
                    </Text>
                  ) : (
                    <Text color={t.sub} size={13.5}>
                      Reading that back…
                    </Text>
                  )}
                </Box>
              </Box>
            ) : null}
          </ScrollView>

          {/* Sticky footer: openers while idle, then the composer. */}
          <Reanimated.View style={[composerStyle, { paddingTop: 6 }]}>
            {!busy && !input.trim() ? (
              <Box direction="row" gap={7} paddingBottom={9} paddingX={14} wrap="wrap">
                {/* An opener is a draft, not a send — it lands in the composer
                    so it can be edited before it goes anywhere. */}
                {STARTERS.map((s) => (
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
              <Tap disabled={!canSend} onPress={() => submit(input)} scale={0.92}>
                <Box
                  align="center"
                  bg={canSend ? t.accent : t.line}
                  height={38}
                  justify="center"
                  rounded={19}
                  width={38}
                >
                  <IconSend color={canSend ? t.onAccent : t.sub} size={16} />
                </Box>
              </Tap>
            </Box>
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
