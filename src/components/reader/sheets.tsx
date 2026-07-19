import { useState } from "react";

import { Box } from "@/components/atoms";
import {
  Backdrop,
  BottomSheet,
  Cover,
  IconBookmark,
  IconChevron,
  IconClose,
  IconGlobe,
  IconHighlighter,
  IconNoteDoc,
  IconPencil,
  IconSpark,
  ProgressBar,
  PText,
  SectionLabel,
  Segmented,
  Tap,
} from "@/components/lexi-components";
import {
  BOOK_PAGES,
  BOOK_TITLE,
  chapterOf,
  DICT,
  EXPLAIN_BODIES,
  LANG_NAMES,
  SUMMARY_POINTS,
} from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export function SummarizeSheet({
  loading,
  onClose,
}: {
  loading: boolean;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const app = useAppStore();
  const ch = chapterOf(app.page);
  const summLang = { am: "ወደ አማርኛ", ar: "إلى العربية", en: "Simplify" }[
    app.lang
  ];

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.38} />
      <BottomSheet paddingX={22}>
        <Box
          align="center"
          direction="row"
          gap={10}
          marginBottom={14}
          marginTop={6}
        >
          <Box
            align="center"
            bg={t.accentSoft}
            height={36}
            justify="center"
            rounded={11}
            width={36}
          >
            <IconSpark color={t.accent} size={18} />
          </Box>
          <Box flex={1}>
            <PText size={15} weight="600">
              Page {app.page} — Summary
            </PText>
            <PText color={t.sub} size={11}>
              Generated on device · this page only
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
              <IconClose color={t.sub} size={16} />
            </Box>
          </Tap>
        </Box>

        {loading ? (
          <Box
            bg={t.bg}
            borderColor={t.line}
            borderWidth={1}
            gap={14}
            padding={18}
            rounded={16}
          >
            {["92%", "78%", "85%"].map((w) => (
              <Box
                bg={t.chip}
                height={13}
                key={w}
                rounded={7}
                style={{ width: w as `${number}%` }}
              />
            ))}
            <PText color={t.sub} size={12}>
              Reading page {app.page}…
            </PText>
          </Box>
        ) : (
          <>
            <Box
              bg={t.bg}
              borderColor={t.line}
              borderWidth={1}
              gap={12}
              padding={18}
              rounded={16}
            >
              {SUMMARY_POINTS.map((point, i) => (
                <Box direction="row" gap={10} key={i}>
                  <Box
                    bg={[t.accent, t.accentMid, t.accentSoft][i]}
                    rounded={3}
                    width={5}
                  />
                  <Box flex={1}>
                    <PText lh={22} size={14}>
                      {point}
                    </PText>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box direction="row" gap={10} marginTop={14}>
              <Tap
                onPress={() => showToast("Summary copied")}
                scale={0.96}
                style={{ flex: 1 }}
              >
                <Box align="center" bg={t.chip} paddingY={12} rounded={12}>
                  <PText size={13} weight="600">
                    Copy
                  </PText>
                </Box>
              </Tap>
              <Tap
                onPress={() =>
                  showToast(`Translating summary to ${LANG_NAMES[app.lang]}…`)
                }
                scale={0.96}
                style={{ flex: 1 }}
              >
                <Box align="center" bg={t.chip} paddingY={12} rounded={12}>
                  <PText size={13} weight="600">
                    {summLang}
                  </PText>
                </Box>
              </Tap>
              <Tap
                onPress={() => {
                  app.addNote({
                    p: app.page,
                    ch: ch.n,
                    text: '"Edison ultimately sold reclaimed time, not light."',
                    color: "amber",
                    note: `Saved from AI summary of page ${app.page}.`,
                    when: "Today",
                  });
                  onClose();
                  showToast("Saved to My Notes");
                }}
                scale={0.96}
                style={{ flex: 1 }}
              >
                <Box align="center" bg={t.pill} paddingY={12} rounded={12}>
                  <PText color={t.pillText} size={13} weight="600">
                    Save note
                  </PText>
                </Box>
              </Tap>
            </Box>
          </>
        )}
      </BottomSheet>
    </>
  );
}

export function WordPopover({
  onClose,
  word,
}: {
  onClose: () => void;
  word: string;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const app = useAppStore();
  const d = DICT[word];
  if (!d) return null;

  const [tr, translit] = d[app.lang];
  const langName = LANG_NAMES[app.lang];
  const ch = chapterOf(app.page);

  const saveWord = () =>
    app.addVocab({
      word,
      pos: d.pos,
      tr,
      translit,
      lang: app.lang,
      p: app.page,
      s1: d.s1,
      s2: d.s2,
    });

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.22} />
      <Box
        bg={t.card}
        borderColor={t.line}
        borderWidth={1}
        padding={20}
        rounded={20}
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          top: "32%",
          zIndex: 39,
          shadowColor: "#14100C",
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.35,
          shadowRadius: 60,
          elevation: 24,
        }}
      >
        <Box
          direction="row"
          justify="between"
          marginBottom={4}
          style={{ alignItems: "baseline" }}
        >
          <PText serif size={20} weight="600">
            {word}
          </PText>
          <Box bg={t.chip} paddingX={9} paddingY={3} rounded={14}>
            <PText color={t.sub} size={11} weight="500">
              {d.pos}
            </PText>
          </Box>
        </Box>
        <Box
          align="center"
          direction="row"
          gap={8}
          marginBottom={14}
          wrap="wrap"
        >
          <PText color={t.accentText} size={22} weight="600">
            {tr}
          </PText>
          <PText color={t.sub} size={12}>
            · {translit} · {langName}
          </PText>
        </Box>
        <Box bg={t.line} height={1} marginBottom={14} />
        <Box direction="row" gap={9} marginBottom={10}>
          <Box paddingTop={2}>
            <IconSpark color={t.accent} size={14} />
          </Box>
          <Box flex={1}>
            <PText lh={21} size={13.5}>
              {d.s1}
            </PText>
          </Box>
        </Box>
        <Box direction="row" gap={9} marginBottom={16}>
          <Box paddingTop={2}>
            <IconSpark color={t.accentMid} size={14} />
          </Box>
          <Box flex={1}>
            <PText lh={21} size={13.5}>
              {d.s2}
            </PText>
          </Box>
        </Box>
        <Box direction="row" gap={8}>
          <Tap onPress={() => showToast(`🔊 ${tr}`)} scale={0.95}>
            <Box bg={t.chip} paddingX={14} paddingY={9} rounded={11}>
              <PText size={12} weight="600">
                Hear it
              </PText>
            </Box>
          </Tap>
          <Tap
            onPress={() => {
              saveWord();
              onClose();
              showToast(`“${word}” saved to vocabulary`);
            }}
            scale={0.95}
          >
            <Box bg={t.chip} paddingX={14} paddingY={9} rounded={11}>
              <PText size={12} weight="600">
                Save word
              </PText>
            </Box>
          </Tap>
          <Tap
            onPress={() => {
              saveWord();
              app.addNote({
                p: app.page,
                ch: ch.n,
                text: `"…the ${word} city carried a cost…"`,
                color: "green",
                note: `${tr} — ${translit}`,
                when: "Today",
              });
              onClose();
              showToast("Highlighted + saved to vocabulary");
            }}
            scale={0.95}
          >
            <Box bg={t.accentSoft} paddingX={14} paddingY={9} rounded={11}>
              <PText color={t.accentText} size={12} weight="600">
                Highlight
              </PText>
            </Box>
          </Tap>
        </Box>
      </Box>
    </>
  );
}

const SEL_COLORS = [
  { name: "Amber", bg: "#EFC57E" },
  { name: "Sage", bg: "#B4D4B4" },
  { name: "Sky", bg: "#AECBE8" },
  { name: "Rose", bg: "#E8B8B4" },
];

export function SelectionMenu({
  onAskAI,
  onClose,
}: {
  onAskAI: () => void;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const app = useAppStore();

  const act = (message: string) => () => {
    onClose();
    showToast(message);
  };

  return (
    <>
      <Backdrop onPress={onClose} opacity={0} />
      <Box
        gap={10}
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          top: "36%",
          zIndex: 39,
        }}
      >
        <Box
          bg="#201B15"
          direction="row"
          padding={6}
          rounded={16}
          style={{
            shadowColor: "#201B15",
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.4,
            shadowRadius: 44,
            elevation: 20,
          }}
        >
          <SelAction
            highlight
            icon={<IconHighlighter color="#E8B778" size={16} />}
            label="Highlight"
            onPress={act("Highlighted ✓ — find it in My Notes")}
          />
          <SelAction
            icon={<IconNoteDoc color="#F6F3EE" size={16} />}
            label="Note"
            onPress={act("Note added to this passage")}
          />
          <SelAction
            icon={<IconBookmark color="#F6F3EE" size={16} />}
            label="Bookmark"
            onPress={() => {
              app.addBookmark(app.page);
              onClose();
              showToast(`Page ${app.page} bookmarked`);
            }}
          />
          <SelAction
            icon={<IconGlobe color="#F6F3EE" size={16} />}
            label="Translate"
            onPress={act("Translated inline — tap the passage to toggle")}
          />
          <SelAction
            icon={<IconSpark color="#D98E4A" size={16} />}
            label="Ask AI"
            onPress={onAskAI}
          />
        </Box>

        <Box
          bg={t.card}
          borderColor={t.line}
          borderWidth={1}
          direction="row"
          justify="between"
          paddingX={16}
          paddingY={14}
          rounded={16}
          style={{
            shadowColor: "#201B15",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.18,
            shadowRadius: 36,
            elevation: 12,
          }}
        >
          {SEL_COLORS.map((c, i) => (
            <Tap
              key={c.name}
              onPress={act(`${c.name} highlight ✓`)}
              scale={0.93}
            >
              <Box align="center" gap={6}>
                <Box
                  bg={c.bg}
                  height={34}
                  rounded={17}
                  style={
                    i === 0
                      ? { borderWidth: 2.5, borderColor: t.accent }
                      : undefined
                  }
                  width={34}
                />
                <PText color={t.sub} size={10} weight="500">
                  {c.name}
                </PText>
              </Box>
            </Tap>
          ))}
        </Box>
      </Box>
    </>
  );
}

function SelAction({
  highlight,
  icon,
  label,
  onPress,
}: {
  highlight?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} scale={0.94} style={{ flex: 1 }}>
      <Box
        align="center"
        bg={highlight ? "rgba(246,243,238,.1)" : "transparent"}
        gap={5}
        paddingY={10}
        rounded={11}
      >
        {icon}
        <PText color="#F6F3EE" size={10.5} weight="500">
          {label}
        </PText>
      </Box>
    </Tap>
  );
}

type ExplainLevel = "advanced" | "beginner" | "simply";

const EXPL_ITEMS: { key: ExplainLevel; label: string }[] = [
  { key: "simply", label: "Simply" },
  { key: "beginner", label: "Beginner" },
  { key: "advanced", label: "Advanced" },
];

export function ExplainSheet({ onClose }: { onClose: () => void }) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const [level, setLevel] = useState<ExplainLevel>("simply");
  const [ask, setAsk] = useState<"connect" | "example" | null>(null);

  const body = ask ? EXPLAIN_BODIES[ask] : EXPLAIN_BODIES[level];

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.35} />
      <BottomSheet paddingX={24}>
        <Box
          align="center"
          direction="row"
          gap={10}
          marginBottom={14}
          marginTop={8}
        >
          <Box
            align="center"
            bg={t.accentSoft}
            height={36}
            justify="center"
            rounded={11}
            width={36}
          >
            <IconSpark color={t.accent} size={18} />
          </Box>
          <Box flex={1}>
            <PText size={15} weight="600">
              Explain this
            </PText>
            <PText color={t.sub} size={11}>
              Knows this page, your highlights & notes
            </PText>
          </Box>
          <Tap onPress={onClose}>
            <Box align="center" height={34} justify="center" width={34}>
              <IconClose color={t.sub} size={18} />
            </Box>
          </Tap>
        </Box>

        <Box
          marginBottom={16}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: "#EFC57E",
            paddingLeft: 12,
          }}
        >
          <PText color={t.sub} italic lh={20} serif size={13}>
            “Gas companies collapsed within a decade, taking whole neighborhoods
            of lamplighters with them…”
          </PText>
        </Box>

        <Box marginBottom={14}>
          <Segmented
            items={EXPL_ITEMS}
            onChange={(key) => {
              setLevel(key);
              setAsk(null);
            }}
            size={12.5}
            value={ask ? null : level}
          />
        </Box>

        <Box
          bg={t.bg}
          borderColor={t.line}
          borderWidth={1}
          minHeight={96}
          padding={18}
          rounded={16}
        >
          <PText lh={23} size={14}>
            {body}
          </PText>
        </Box>

        <Box align="center" direction="row" gap={8} marginTop={14}>
          <Tap onPress={() => setAsk("example")} scale={0.96}>
            <Box bg={t.chip} paddingX={14} paddingY={9} rounded={11}>
              <PText size={12} weight="600">
                Give an example
              </PText>
            </Box>
          </Tap>
          <Tap onPress={() => setAsk("connect")} scale={0.96}>
            <Box bg={t.chip} paddingX={14} paddingY={9} rounded={11}>
              <PText size={12} weight="600">
                Connect to Ch. 2
              </PText>
            </Box>
          </Tap>
          <Box flex={1} />
          <Tap
            onPress={() => {
              onClose();
              showToast("Saved to My Notes ✓");
            }}
            scale={0.96}
          >
            <Box bg={t.accent} paddingX={14} paddingY={9} rounded={11}>
              <PText color={t.onAccent} size={12} weight="600">
                Save note
              </PText>
            </Box>
          </Tap>
        </Box>
      </BottomSheet>
    </>
  );
}

export function SmartReturnSheet({
  onClose,
  onFresh,
}: {
  onClose: () => void;
  onFresh: () => void;
}) {
  const t = useProtoTheme();
  const page = useAppStore((s) => s.page);
  const ch = chapterOf(page);

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.32} />
      <BottomSheet paddingX={24}>
        <Box marginTop={8}>
          <SectionLabel>You were reading</SectionLabel>
        </Box>
        <Box align="center" direction="row" gap={16} marginTop={14}>
          <Cover height={74} label="cover" rounded={8} width={56} />
          <Box flex={1}>
            <PText serif size={17} weight="600">
              {BOOK_TITLE}
            </PText>
            <PText color={t.sub} size={13} style={{ marginTop: 4 }}>
              Chapter {ch.n} · {ch.t} · Page {page} of {BOOK_PAGES}
            </PText>
            <Box marginTop={8}>
              <ProgressBar pct={(page / BOOK_PAGES) * 100} />
            </Box>
          </Box>
        </Box>

        <Box
          bg={t.accentSoft}
          direction="row"
          gap={10}
          marginTop={16}
          paddingX={16}
          paddingY={14}
          rounded={14}
        >
          <Box paddingTop={2}>
            <IconPencil color={t.accentText} size={14} />
          </Box>
          <Box flex={1}>
            <PText color={t.accentText} ls={0.7} size={11} upper weight="600">
              Your last thought
            </PText>
            <PText italic lh={21} serif size={14} style={{ marginTop: 4 }}>
              “Reread the Pearl Street section before class”
            </PText>
          </Box>
        </Box>

        <Box align="center" direction="row" gap={10} marginTop={12}>
          <Box bg={t.chip} paddingX={11} paddingY={5} rounded={14}>
            <PText color={t.sub} size={12}>
              Last highlight · p. 23
            </PText>
          </Box>
          <Box bg={t.chip} paddingX={11} paddingY={5} rounded={14}>
            <PText color={t.sub} size={12}>
              Last search · “electric”
            </PText>
          </Box>
        </Box>

        <Box direction="row" gap={10} marginTop={20}>
          <Tap onPress={onFresh} scale={0.97}>
            <Box
              align="center"
              bg={t.chip}
              justify="center"
              paddingX={20}
              rounded={14}
              style={{ height: 52 }}
            >
              <PText size={14} weight="600">
                Start fresh
              </PText>
            </Box>
          </Tap>
          <Tap onPress={onClose} scale={0.98} style={{ flex: 1 }}>
            <Box
              align="center"
              bg={t.accent}
              direction="row"
              gap={8}
              height={52}
              justify="center"
              rounded={14}
            >
              <PText color={t.onAccent} size={15} weight="600">
                Continue reading
              </PText>
              <IconChevron color={t.onAccent} size={16} strokeWidth={2} />
            </Box>
          </Tap>
        </Box>
      </BottomSheet>
    </>
  );
}
