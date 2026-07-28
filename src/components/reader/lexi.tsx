import {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box } from "@/components/atoms";
import {
  IconClose,
  IconSend,
  IconSpark,
  IconWave,
  Text,
  Tap,
} from "@/components/lexi-components";
import { LEXI_SEED } from "@/constants/library";
import {
  AiQuotaError,
  fetchChatHistory,
  speakText,
  streamChat,
} from "@/services/lexi-ai";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useProtoTheme } from "@/theme/proto";

interface LexiMsg {
  role: "lexi" | "user";
  kind: "drift" | "normal" | "recap" | "error";
  text: string;
}

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
          Hey Lexi
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
  excerpt?: string;
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
  const explStyle = useAppStore((s) => s.explStyle);
  const setQuota = useAuthStore((s) => s.setQuota);
  const openWall = useAuthStore((s) => s.openWall);

  const sheetRef = useRef<GorhomBottomSheetModal>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const snapPoints = useMemo(() => ["86%"], []);

  const sessionId = book?.docKey ?? "";

  const greeting = useMemo<LexiMsg[]>(
    () =>
      book
        ? [
            {
              role: "lexi",
              kind: "normal",
              text: `I've got ${book.title} open in front of me. Ask me anything about it — what a passage means, why it matters, where an argument is going.`,
            },
          ]
        : LEXI_SEED,
    [book],
  );

  const [messages, setMessages] = useState<LexiMsg[]>(greeting);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const busy = streaming !== null;
  const rabbitCount = useRef(0);
  const replyIdx = useRef(0);
  const lastQuestion = useRef("");
  const abortRef = useRef<(() => void) | null>(null);
  const accRef = useRef("");

  useEffect(() => {
    sheetRef.current?.present();
  }, []);

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

  useEffect(() => () => abortRef.current?.(), []);

  const close = useCallback(() => sheetRef.current?.dismiss(), []);

  const push = (msg: LexiMsg) => setMessages((prev) => [...prev, msg]);
  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const [heard, setHeard] = useState<{ url: string; seq: number } | null>(null);
  const audioNode = useMemo(() => {
    if (!heard) return null;
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><audio autoplay playsinline src="${heard.url}"></audio></body></html>`;
    return (
      <WebView
        allowsInlineMediaPlayback
        key={heard.seq}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        pointerEvents="none"
        source={{ html }}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
      />
    );
  }, [heard]);

  const hearReply = async (text: string) => {
    const url = await speakText(text);
    if (url) setHeard((prev) => ({ url, seq: (prev?.seq ?? 0) + 1 }));
  };

  const runChat = async (q: string) => {
    accRef.current = "";
    setStreaming("");
    abortRef.current = await streamChat(
      {
        author: book!.author,
        docKey: book!.docKey,
        excerpt: book!.excerpt,
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
          if (text) push({ role: "lexi", kind, text });
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
                : "Lexi couldn't answer just then.",
          });
          scrollToEnd();
        },
      },
    );
  };

  const send = () => {
    const q = input.trim();
    if (!q || busy) return;
    push({ role: "user", kind: "normal", text: q });
    setInput("");
    scrollToEnd();

    if (!book) {
      push(scriptedReply(q, rabbitCount, replyIdx));
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

  const renderBackdrop = useCallback(
    (props: ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheetModal
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: t.card }}
      enableDynamicSizing={false}
      handleIndicatorStyle={{ backgroundColor: t.line }}
      index={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onDismiss={onClose}
      ref={sheetRef}
      snapPoints={snapPoints}
    >
      <BottomSheetView style={{ flex: 1 }}>
        {audioNode}
        <Box
          align="center"
          direction="row"
          gap={10}
          paddingX={18}
          paddingY={12}
          style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
        >
          <Box
            align="center"
            bg={t.accentSoft}
            height={36}
            justify="center"
            rounded={12}
            width={36}
          >
            <IconSpark color={t.accent} size={18} />
          </Box>
          <Box flex={1}>
            <Text size={15} weight="600">
              Lexi
            </Text>
            <Text color={t.sub} numberOfLines={1} size={11}>
              {book
                ? `${book.title} · p. ${book.page}`
                : "Your reading companion · Ch. 3"}
            </Text>
          </Box>
          <Box bg={t.calmSoft} paddingX={10} paddingY={4} rounded={12}>
            <Text color={t.calm} size={11} weight="600">
              You’re on track ✓
            </Text>
          </Box>
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

        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
          ref={scrollRef}
          style={{ flex: 1 }}
        >
          {messages.map((m, i) => {
            const user = m.role === "user";
            const special = m.kind === "drift" || m.kind === "recap";
            const isError = m.kind === "error";
            return (
              <Box
                direction="row"
                justify={user ? "end" : "start"}
                key={i}
                paddingY={5}
              >
                <Box
                  bg={user ? t.pill : isError ? t.accentSoft : t.chip}
                  borderColor={
                    isError
                      ? t.accentMid
                      : special
                        ? t.calmLine
                        : "transparent"
                  }
                  borderWidth={1}
                  gap={8}
                  maxWidth={300}
                  paddingX={14}
                  paddingY={10}
                  rounded={16}
                  style={{ maxWidth: "80%" }}
                >
                  <Text color={user ? t.pillText : t.ink} lh={20} size={13.5}>
                    {m.text}
                  </Text>
                  {isError ? (
                    <Tap
                      onPress={retry}
                      scale={0.95}
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Box
                        bg={t.accentSoft}
                        paddingX={12}
                        paddingY={8}
                        rounded={10}
                      >
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
                      <Box
                        bg={t.calmSoft}
                        paddingX={12}
                        paddingY={8}
                        rounded={10}
                      >
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
                  {!user && !isError ? (
                    <Tap
                      onPress={() => hearReply(m.text)}
                      scale={0.9}
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Box
                        align="center"
                        direction="row"
                        gap={5}
                        paddingY={2}
                      >
                        <IconWave color={t.sub} size={13} />
                        <Text color={t.sub} size={11} weight="600">
                          Hear it
                        </Text>
                      </Box>
                    </Tap>
                  ) : null}
                </Box>
              </Box>
            );
          })}

          {streaming !== null ? (
            <Box direction="row" justify="start" paddingY={5}>
              <Box
                bg={t.chip}
                paddingX={14}
                paddingY={10}
                rounded={16}
                style={{ maxWidth: "80%" }}
              >
                {streaming ? (
                  <Text color={t.ink} lh={20} size={13.5}>
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
        </BottomSheetScrollView>

        <Box
          paddingTop={12}
          paddingX={16}
          style={{
            paddingBottom: 14 + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: t.line,
          }}
        >
          <Box
            align="center"
            bg={t.chip}
            direction="row"
            gap={9}
            paddingLeft={16}
            paddingRight={5}
            paddingY={5}
            rounded={24}
          >
            <BottomSheetTextInput
              onChangeText={setInput}
              onSubmitEditing={send}
              placeholder="Hey Lexi… ask about this document"
              placeholderTextColor={t.faint}
              returnKeyType="send"
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: 10,
                fontSize: 14,
                color: t.ink,
              }}
              value={input}
            />
            <Tap onPress={send} scale={0.92}>
              <Box
                align="center"
                bg={t.accent}
                height={36}
                justify="center"
                rounded={18}
                width={36}
              >
                <IconSend color={t.onAccent} size={15} />
              </Box>
            </Tap>
          </Box>
        </Box>
      </BottomSheetView>
    </GorhomBottomSheetModal>
  );
}
