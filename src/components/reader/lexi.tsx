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
  LiveWave,
  SpeakingWave,
  Tap,
  Text,
} from "@/components/lexi-components";
import { CenterModal } from "@/components/modals";
import { palette } from "@/constants/colors";
import { LEXI_SEED } from "@/constants/library";
import { useVoiceInput } from "@/hooks/use-voice-input";
import {
  AiQuotaError,
  cachedChatHistory,
  clearChatHistory,
  fetchChatHistory,
  speakText,
  streamChat,
} from "@/services/lexi-ai";
import {
  useAnnotationsStore,
  type Annotation,
} from "@/stores/annotations-store";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { sansFamily } from "@/theme/app-fonts";
import { useProtoTheme } from "@/theme/proto";

interface LexiMsg {
  role: "lexi" | "user";
  kind: "drift" | "normal" | "recap" | "error";
  text: string;
  cite?: { page: number; text: string };
}

const INPUT_MIN = 22;
const INPUT_MAX = 112;
const SCROLL_TO_TOP_REVEAL_DISTANCE = 120;

const ZERO_SIZE = {
  position: "absolute",
  width: 0,
  height: 0,
  opacity: 0,
} as const;

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

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

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

function keyWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

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

export interface LexiBook {
  title: string;
  author?: string;
  docKey: string;
  page: number;
  chapter?: string;
  excerpt?: string;
  uri?: string;
}

export function LexiSheet({
  book,
  onClose,
}: {
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

  const waveBars = Math.floor(width / 6);

  const anim = useSharedValue(0);
  const kb = useReanimatedKeyboardAnimation();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - anim.value) * panelWidth }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: anim.value }));
  const contentStyle = useAnimatedStyle(() => ({
    paddingBottom: -kb.height.value,
  }));
  const composerStyle = useAnimatedStyle(() => ({
    paddingBottom: 10 + insets.bottom * (1 - kb.progress.value),
  }));

  const sessionId = book?.docKey ?? "";

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

  const subtitle = book
    ? [`Page ${book.page}`, book.chapter?.trim() || null]
        .filter(Boolean)
        .join(" · ")
    : "Chapter 3";

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
  const [messages, setMessages] = useState<LexiMsg[]>(
    () =>
      initialHistory?.map((m) => ({
        role: m.role === "user" ? "user" : "lexi",
        kind: m.kind,
        text: m.content,
      })) ?? greeting,
  );
  const [historyReady, setHistoryReady] = useState(
    !book || initialHistory !== undefined,
  );
  const [historyVisible, setHistoryVisible] = useState(!book);
  const [input, setInput] = useState("");
  const [inputH, setInputH] = useState(INPUT_MIN);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
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
  const accRef = useRef("");
  const notesRef = useRef(docNotes);
  useEffect(() => {
    notesRef.current = docNotes;
  }, [docNotes]);

  useEffect(() => {
    if (!book || !sessionId) return;
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
        if (cancelled || !history) return;
        setMessages(
          history.length
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
  }, [book, greeting, sessionId]);

  useEffect(() => () => abortRef.current?.(), []);

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

  const [voice, setVoice] = useState<{
    key: number;
    seq: number;
    url?: string;
  } | null>(null);

  const audioNode = useMemo(() => {
    if (!voice?.url) return null;
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><audio id="a" autoplay playsinline src="${voice.url}"></audio><script>var a=document.getElementById('a');var done=function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ended')};a.addEventListener('ended',done);a.addEventListener('error',done);</script></body></html>`;
    return (
      <WebView
        allowsInlineMediaPlayback
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

  const toggleVoice = async (key: number, text: string) => {
    if (voice?.key === key) {
      setVoice(null);
      return;
    }
    const seq = (voice?.seq ?? 0) + 1;
    setVoice({ key, seq });
    const url = await speakText(text);
    setVoice((cur) =>
      cur && cur.seq === seq ? (url ? { ...cur, url } : null) : cur,
    );
  };

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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          scrollToEnd();
        },
        onError: (error) => {
          abortRef.current = null;
          setStreaming(null);
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
  const canClear = messages.length > 1 && !busy;

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
    setMessages((prev) =>
      prev.length && prev[prev.length - 1].kind === "error"
        ? prev.slice(0, -1)
        : prev,
    );
    void runChat(lastQuestion.current);
  };

  const mic = useVoiceInput(showToast);

  const finishVoice = async () => {
    try {
      const text = await mic.stop();
      if (!text) return;
      setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
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

  const renderMessage = (m: LexiMsg, i: number): ReactNode => {
    const user = m.role === "user";
    const special = m.kind === "drift" || m.kind === "recap";
    const isError = m.kind === "error";
    const armed = voice?.key === i;
    const playing = armed && Boolean(voice?.url);
    const loading = armed && !playing;
    return (
      <Box key={i} paddingY={5}>
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
          <Text color={user ? t.pill : t.ink} lh={21} size={13.5}>
            {m.text}
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
          {!user && !isError ? (
            <Tap
              onPress={() => toggleVoice(i, m.text)}
              scale={0.88}
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

          <Reanimated.View style={[composerStyle, { paddingTop: 6 }]}>
            {!busy && !input.trim() && mic.phase === "idle" ? (
              <Box
                direction="row"
                gap={7}
                paddingBottom={9}
                paddingX={14}
                wrap="wrap"
              >
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

            {mic.phase !== "idle" ? (
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
                )}
              </Box>
            )}
          </Reanimated.View>
        </Reanimated.View>
      </Reanimated.View>

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
