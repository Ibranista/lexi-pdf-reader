import { useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  Backdrop,
  IconClose,
  IconSend,
  IconSpark,
  PText,
  Tap,
} from "@/components/lexi-components";
import { LEXI_SEED } from "@/constants/library";
import { useProtoTheme } from "@/theme/proto";

interface LexiMsg {
  role: "lexi" | "user";
  kind: "drift" | "normal" | "recap";
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
        <PText size={13} weight="600">
          Hey Lexi
        </PText>
      </Box>
    </Tap>
  );
}

export function LexiSheet({ onClose }: { onClose: () => void }) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<LexiMsg[]>(LEXI_SEED);
  const [input, setInput] = useState("");
  const rabbitCount = useRef(0);
  const replyIdx = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    const isDoc = DOC_WORDS.some((w) => lower.includes(w));

    let reply: LexiMsg;
    if (!isDoc) {
      rabbitCount.current = 0;
      reply = {
        role: "lexi",
        kind: "drift",
        text: "Happy to chat, but let's park that for later — you were doing great on Chapter 3. Want to continue?",
      };
    } else {
      rabbitCount.current += 1;
      if (rabbitCount.current >= 3) {
        rabbitCount.current = 0;
        reply = {
          role: "lexi",
          kind: "recap",
          text: "Short answer: it comes back to cheap, constant light. We've covered this point well — the core idea is that electricity turned night into usable time. Ready for the next section?",
        };
      } else {
        replyIdx.current += 1;
        reply = {
          role: "lexi",
          kind: "normal",
          text: REPLY_POOL[replyIdx.current % REPLY_POOL.length],
        };
      }
    }

    setMessages([
      ...messages,
      { role: "user", kind: "normal", text: q },
      reply,
    ]);
    setInput("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.35} />
      <Box
        bg={t.card}
        height={590}
        roundedTopLeft={24}
        roundedTopRight={24}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 39,
          shadowColor: "#14100C",
          shadowOffset: { width: 0, height: -12 },
          shadowOpacity: 0.35,
          shadowRadius: 48,
          elevation: 24,
        }}
      >
        <Box paddingTop={10} paddingX={20}>
          <Box
            bg={t.line}
            height={4}
            rounded={2}
            style={{ alignSelf: "center" }}
            width={40}
          />
        </Box>

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
            <PText size={15} weight="600">
              Lexi
            </PText>
            <PText color={t.sub} numberOfLines={1} size={11}>
              Your reading companion · Ch. 3
            </PText>
          </Box>
          <Box bg={t.calmSoft} paddingX={10} paddingY={4} rounded={12}>
            <PText color={t.calm} size={11} weight="600">
              You’re on track ✓
            </PText>
          </Box>
          <Tap onPress={onClose}>
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

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
          ref={scrollRef}
          style={{ flex: 1 }}
        >
          {messages.map((m, i) => {
            const user = m.role === "user";
            const special = m.kind === "drift" || m.kind === "recap";
            return (
              <Box
                direction="row"
                justify={user ? "end" : "start"}
                key={i}
                paddingY={5}
              >
                <Box
                  bg={user ? t.pill : t.chip}
                  borderColor={special ? t.calmLine : "transparent"}
                  borderWidth={1}
                  gap={8}
                  maxWidth={300}
                  paddingX={14}
                  paddingY={10}
                  rounded={16}
                  style={{ maxWidth: "80%" }}
                >
                  <PText color={user ? t.pillText : t.ink} lh={20} size={13.5}>
                    {m.text}
                  </PText>
                  {m.kind === "drift" ? (
                    <Tap
                      onPress={onClose}
                      scale={0.95}
                      style={{ alignSelf: "flex-start" }}
                    >
                      <Box
                        bg={t.calmSoft}
                        paddingX={12}
                        paddingY={8}
                        rounded={10}
                      >
                        <PText color={t.calm} size={12} weight="600">
                          Back to reading
                        </PText>
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
                      <PText color={t.calm} size={10.5} weight="600">
                        You’re on track ✓
                      </PText>
                    </Box>
                  ) : null}
                </Box>
              </Box>
            );
          })}
        </ScrollView>

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
            <TextInput
              backgroundColor="transparent"
              borderColor="transparent"
              borderWidth={0}
              fontSize={14}
              onChangeText={setInput}
              onSubmitEditing={send}
              placeholder="Hey Lexi… ask about this document"
              placeholderTextColor={t.faint}
              pl={0}
              py={10}
              returnKeyType="send"
              rounded={0}
              style={{ flex: 1, height: undefined, minWidth: 0 }}
              textColor={t.ink}
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
      </Box>
    </>
  );
}
