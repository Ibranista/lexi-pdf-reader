/**
 * "Hey Lexi" — the reading companion bubble and chat sheet, with the
 * prototype's drift / rabbit-hole redirection behavior.
 *
 * The sheet is a @gorhom/bottom-sheet modal that opens at half height, and
 * keyboard avoidance is left entirely to the sheet — no keyboard-controller
 * padding, no sticky view. `keyboardBehavior="extend"` sends it to the top
 * detent on focus and, crucially, shortens the content area by the keyboard's
 * height, so a bottom-anchored composer lands right on top of the keyboard and
 * the message list flexes into whatever is left.
 *
 * That shortening only happens because `android_keyboardInputMode` matches the
 * manifest's real `adjustPan` (app.json `softwareKeyboardLayoutMode: "pan"`).
 * Claiming `adjustResize` makes the sheet assume the OS shrinks the window for
 * it and zero out the keyboard height — which it doesn't, under edge-to-edge.
 */
import {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import { Keyboard } from "react-native";
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
  Tap,
  Text,
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

/** The document Lexi is allowed to talk about. */
export interface LexiBook {
  title: string;
  author?: string;
  /**
   * Sync key of the document (64 hex, from `docKeyFor`), so the model can reach
   * its indexed text. Required — `/ai/chat` rejects a turn without one, so a
   * screen that hasn't derived it yet should hold the sheet closed rather than
   * open it on a document Lexi can't look up.
   */
  docKey: string;
  page: number;
  /** Text of the page in view, so answers can quote what's on screen. */
  excerpt?: string;
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
  const explStyle = useAppStore((s) => s.explStyle);
  const setQuota = useAuthStore((s) => s.setQuota);
  const openWall = useAuthStore((s) => s.openWall);

  const sheetRef = useRef<GorhomBottomSheetModal>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // Opens at a conversational half-height; dragging or focusing the composer
  // takes it to the top detent. Fixed heights (not dynamic sizing) so the
  // messages list can flex and the composer sits at the bottom.
  const snapPoints = useMemo(() => ["55%", "95%"], []);

  // The conversation is keyed to the book itself (its docKey), so reopening the
  // sheet on the same document continues the same thread rather than starting a
  // fresh one — which is what lets prior turns be loaded back below.
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
  // The reply currently streaming in, shown as a live bubble; null when idle.
  const [streaming, setStreaming] = useState<string | null>(null);
  const busy = streaming !== null;
  const rabbitCount = useRef(0);
  const replyIdx = useRef(0);
  const lastQuestion = useRef("");
  const abortRef = useRef<(() => void) | null>(null);
  // Text accumulated for the in-flight reply — read on completion, off-render.
  const accRef = useRef("");

  // Present on mount; `onClose` runs from onDismiss so the pan-down gesture,
  // the backdrop tap and the ✕ all funnel through the same teardown.
  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  // Rehydrate the book's earlier conversation, so the reader picks up where
  // they left off instead of a blank slate every time the sheet opens.
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

  // Abort any in-flight stream if the sheet unmounts mid-reply.
  useEffect(() => () => abortRef.current?.(), []);

  // The list shrinks when the keyboard opens; keep the newest replies in view.
  // When it closes, settle back to the resting half-height detent.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      scrollRef.current?.scrollToEnd({ animated: true }),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      sheetRef.current?.snapToIndex(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const close = useCallback(() => sheetRef.current?.dismiss(), []);

  const push = (msg: LexiMsg) => setMessages((prev) => [...prev, msg]);
  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  // ── read a reply aloud ─────────────────────────────────────────
  // Same off-screen WebView trick as the word card: no native audio module, so
  // it works without a rebuild. `seq` replays the same bubble on a re-tap.
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
                : "Lexi couldn't answer just then.",
          });
          scrollToEnd();
        },
      },
    );
  };

  const canSend = input.trim().length > 0 && !busy;

  const send = () => {
    const q = input.trim();
    if (!q || busy) return;
    push({ role: "user", kind: "normal", text: q });
    setInput("");
    scrollToEnd();

    // No document behind the sheet — the prototype reader's scripted path.
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
    // Drop the error bubble it's attached to, then ask again.
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
      android_keyboardInputMode="adjustPan"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: t.card }}
      enableBlurKeyboardOnGesture
      enableDynamicSizing={false}
      handleIndicatorStyle={{ backgroundColor: t.line }}
      index={0}
      keyboardBehavior="extend"
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
          <Box flex={1}>
            <Text color={t.sub} numberOfLines={1} size={11}>
              {book
                ? `${book.title} · p. ${book.page}`
                : "Your reading companion · Ch. 3"}
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
                    isError ? t.accentMid : special ? t.calmLine : "transparent"
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
                  {/* Hear the reply read aloud in Lexi's voice. */}
                  {!user && !isError ? (
                    <Tap
                      onPress={() => hearReply(m.text)}
                      scale={0.9}
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Box align="center" direction="row" gap={5} paddingY={2}>
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

          {/* The reply as it streams in — a placeholder until the first token. */}
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

        {/* Static padding only — when the keyboard is up the sheet has already
            shortened the content area by its height, so there is nothing left
            to animate around. */}
        <Box
          paddingTop={10}
          paddingX={12}
          style={{
            paddingBottom: insets.bottom + 10,
            borderTopWidth: 1,
            borderTopColor: t.line,
          }}
        >
          <Box
            align="end"
            bg={t.chip}
            direction="row"
            gap={8}
            paddingLeft={16}
            paddingRight={6}
            paddingY={6}
            rounded={24}
          >
            <BottomSheetTextInput
              multiline
              onChangeText={setInput}
              placeholder="Hey Lexi… ask about this document"
              placeholderTextColor={t.faint}
              style={{
                flex: 1,
                minWidth: 0,
                // ~5 lines, then the draft scrolls inside the pill.
                maxHeight: 104,
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 15,
                lineHeight: 20,
                color: t.ink,
              }}
              value={input}
            />
            <Tap disabled={!canSend} onPress={send} scale={0.92}>
              <Box
                align="center"
                bg={canSend ? t.accent : t.line}
                height={36}
                justify="center"
                rounded={18}
                width={36}
              >
                <IconSend color={canSend ? t.onAccent : t.sub} size={15} />
              </Box>
            </Tap>
          </Box>
        </Box>
      </BottomSheetView>
    </GorhomBottomSheetModal>
  );
}
