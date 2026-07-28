/**
 * "Hey Lexi" — the reading companion bubble and chat sheet, with the
 * prototype's drift / rabbit-hole redirection behavior.
 *
 * The sheet is a @gorhom/bottom-sheet modal so it inherits real keyboard
 * avoidance: `keyboardBehavior="interactive"` lifts the whole sheet with the
 * keyboard, keeping the composer and the latest replies visible. On Android's
 * edge-to-edge window the OS no longer resizes anything, so this is the only
 * thing that keeps the input off the keyboard.
 */
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

import { Box } from "@/components/atoms";
import {
  IconClose,
  IconSend,
  IconSpark,
  Text,
  Tap,
} from "@/components/lexi-components";
import { LEXI_SEED } from "@/constants/library";
import { useLexiChat } from "@/hooks/use-lexi-ai";
import { AiQuotaError } from "@/services/lexi-ai";
import { useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";
import { getApiErrorMessage } from "@/utils/axios";

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
  const ask = useLexiChat();

  const sheetRef = useRef<GorhomBottomSheetModal>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  // A fixed height (not dynamic sizing) so the messages list can flex and the
  // composer sits at the bottom, where `keyboardBehavior` can lift it.
  const snapPoints = useMemo(() => ["86%"], []);

  const [messages, setMessages] = useState<LexiMsg[]>(() =>
    book
      ? [
          {
            role: "lexi",
            kind: "normal",
            text: `I've got ${book.title} open in front of me. Ask me anything about it — what a passage means, why it matters, where an argument is going.`,
          },
        ]
      : LEXI_SEED,
  );
  const [input, setInput] = useState("");
  const rabbitCount = useRef(0);
  const replyIdx = useRef(0);
  // One conversation per open document, so follow-ups keep their thread. Minted
  // on the first send rather than during render — a render must stay pure.
  const sessionId = useRef("");
  // The last question actually sent, so an error bubble can offer to retry it.
  const lastQuestion = useRef("");

  // Present on mount; `onClose` runs from onDismiss so the pan-down gesture,
  // the backdrop tap and the ✕ all funnel through the same teardown.
  useEffect(() => {
    sheetRef.current?.present();
  }, []);

  const close = useCallback(() => sheetRef.current?.dismiss(), []);

  const push = (msg: LexiMsg) => setMessages((prev) => [...prev, msg]);
  const scrollToEnd = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const runChat = async (q: string) => {
    if (!sessionId.current) {
      sessionId.current = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    }
    try {
      const answer = await ask.mutateAsync({
        author: book!.author,
        docKey: book!.docKey,
        excerpt: book!.excerpt,
        message: q,
        page: book!.page,
        sessionId: sessionId.current,
        style: explStyle,
        title: book!.title,
      });
      push({ role: "lexi", kind: answer.kind, text: answer.reply });
    } catch (error) {
      // The hook has already banked the quota and raised the wall; the sheet
      // just gets out of the way so the wall is what you're looking at.
      if (error instanceof AiQuotaError) {
        close();
        return;
      }
      // Anything else is a real failure the reader can act on. Surface the
      // server's own message when it sent one (e.g. "AI is not configured on
      // this server.") rather than a single canned line, and offer a retry —
      // a professional error says what happened and what to do about it.
      push({
        role: "lexi",
        kind: "error",
        text: getApiErrorMessage(error),
      });
    } finally {
      scrollToEnd();
    }
  };

  const send = () => {
    const q = input.trim();
    if (!q || ask.isPending) return;
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
    if (!book || ask.isPending || !lastQuestion.current) return;
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
                </Box>
              </Box>
            );
          })}

          {ask.isPending ? (
            <Box direction="row" justify="start" paddingY={5}>
              <Box bg={t.chip} paddingX={14} paddingY={10} rounded={16}>
                <Text color={t.sub} size={13.5}>
                  Reading that back…
                </Text>
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
