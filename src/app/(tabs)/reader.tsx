import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, Text } from "@/components/atoms";
import { Tap } from "@/components/lexi-components";
import {
  BreakCard,
  ExplainSheet,
  FocusPill,
  LexiBubble,
  LexiSheet,
  NextSectionPill,
  ReaderControlsSheet,
  ReaderTopBar,
  SearchPanel,
  SelectionMenu,
  SmartReturnSheet,
  SummarizeSheet,
  TocDrawer,
  WordPopover,
} from "@/components/reader";
import { BOOK_PAGES, chapterOf, PARAGRAPHS } from "@/constants/library";
import { LINE_SPACING, useAppStore, useToastStore } from "@/stores/app-store";
import { serifFamily } from "@/theme/app-fonts";
import { useProtoTheme } from "@/theme/proto";

export default function ReaderScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ focus?: string; resume?: string }>();
  const showToast = useToastStore((s) => s.showToast);
  const app = useAppStore();

  const [controls, setControls] = useState(false);
  const [toc, setToc] = useState(false);
  const [search, setSearch] = useState(false);
  const [summ, setSumm] = useState<"closed" | "done" | "loading">("closed");
  const [popWord, setPopWord] = useState<string | null>(null);
  const [sel, setSel] = useState(false);
  const [expl, setExpl] = useState(false);
  const [lexiOpen, setLexiOpen] = useState(false);
  const [smartReturn, setSmartReturn] = useState(params.resume === "1");
  const [focusMode, setFocusMode] = useState(params.focus === "1");
  const [focusPara, setFocusPara] = useState(0);
  const [understood, setUnderstood] = useState<number[]>([]);
  const [sessionSec, setSessionSec] = useState(0);
  const [breakOn, setBreakOn] = useState(false);
  const breakDone = useRef(false);
  const suppressTap = useRef(false);
  const summTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const scrollRef = useRef<ScrollView>(null);

  const ch = chapterOf(app.page);
  const isBookmarked = app.bookmarks.includes(app.page);
  const overlayOpen =
    controls ||
    toc ||
    search ||
    summ !== "closed" ||
    !!popWord ||
    sel ||
    expl ||
    lexiOpen ||
    smartReturn ||
    breakOn;

  // Focus-session timer (prototype demo timing: break suggestion at 45s).
  useEffect(() => {
    if (!focusMode || !app.fmTimer) return;
    const id = setInterval(() => {
      setSessionSec((s) => {
        const next = s + 1;
        if (next === 45 && !breakDone.current && app.focusRem) {
          breakDone.current = true;
          setBreakOn(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [focusMode, app.fmTimer, app.focusRem]);

  useEffect(() => () => clearTimeout(summTimer.current), []);

  const toggleFocusMode = () => {
    const on = !focusMode;
    setFocusMode(on);
    setSessionSec(0);
    setBreakOn(false);
    breakDone.current = false;
    setControls(false);
    showToast(
      on ? "Focus mode — your paragraph stays bright" : "Focus mode off",
    );
  };

  const openSummarize = () => {
    if (!app.aiOn) {
      showToast("AI is off — enable it in Settings");
      return;
    }
    setControls(false);
    setSumm("loading");
    clearTimeout(summTimer.current);
    summTimer.current = setTimeout(() => setSumm("done"), 1300);
  };

  const openWord = (word: string) => {
    suppressTap.current = true;
    if (!app.aiOn) {
      showToast("AI is off — enable it in Settings");
      return;
    }
    setControls(false);
    setPopWord(word);
  };

  const openSelection = () => {
    suppressTap.current = true;
    setControls(false);
    setSel(true);
  };

  const goPage = (p: number) => {
    app.set({ page: p });
    setToc(false);
    setSearch(false);
  };

  const nextSection = () => {
    const marked = understood.includes(focusPara)
      ? understood
      : [...understood, focusPara];
    if (focusPara < PARAGRAPHS.length - 1) {
      setUnderstood(marked);
      setFocusPara(focusPara + 1);
    } else {
      setUnderstood([]);
      setFocusPara(0);
      app.set({ page: app.page + 1 });
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      showToast(`Page ${app.page + 1} — fresh start 🌿`);
    }
  };

  const segColor = (i: number) =>
    understood.includes(i)
      ? t.calm
      : focusMode && i === focusPara
        ? t.accent
        : t.chip;

  const lineHeight = app.textSize * (LINE_SPACING[app.lineSp] ?? 1.75);
  const readerFamily = app.fontFam === "serif" ? serifFamily : undefined;
  const contentPadX =
    app.readWidth === "narrow" ? 44 : app.readWidth === "full" ? 20 : 32;

  return (
    <Box bg={t.page} flex={1}>
      {/* momentum ribbon */}
      <Box
        direction="row"
        gap={5}
        pointerEvents="none"
        style={{
          position: "absolute",
          top: insets.top + 3,
          left: 26,
          right: 26,
          zIndex: 25,
        }}
      >
        {PARAGRAPHS.map((_, i) => (
          <Box bg={segColor(i)} flex={1} height={3} key={i} rounded={2} />
        ))}
      </Box>

      {/* page content */}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 28,
          paddingBottom: 60,
          paddingHorizontal: contentPadX,
        }}
        ref={scrollRef}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={() => {
            if (suppressTap.current) {
              suppressTap.current = false;
              return;
            }
            setControls((c) => !c);
          }}
        >
          <Text
            color={t.faint}
            ls={1.1}
            size={11}
            style={{ marginBottom: 18 }}
            upper
            weight="600"
          >
            Chapter {ch.n} · {ch.t}
          </Text>

          {PARAGRAPHS.map((para, i) => (
            <Text
              key={i}
              style={{
                fontSize: app.textSize,
                lineHeight,
                color: t.readerInk,
                marginBottom: i === PARAGRAPHS.length - 1 ? 240 : 20,
                opacity: focusMode ? (i === focusPara ? 1 : 0.27) : 1,
                ...(readerFamily ? { fontFamily: readerFamily } : {}),
              }}
            >
              {para.map((seg, j) => {
                if (seg.kind === "word") {
                  return (
                    <Text
                      key={j}
                      onPress={() => openWord(seg.word)}
                      style={{
                        fontSize: app.textSize,
                        lineHeight,
                        color: t.readerInk,
                        textDecorationLine: "underline",
                        textDecorationStyle: "dotted",
                        textDecorationColor: t.accent,
                        ...(readerFamily ? { fontFamily: readerFamily } : {}),
                      }}
                    >
                      {seg.text}
                    </Text>
                  );
                }
                if (seg.kind === "select") {
                  return (
                    <Text
                      key={j}
                      onPress={openSelection}
                      style={{
                        fontSize: app.textSize,
                        lineHeight,
                        color: t.readerInk,
                        backgroundColor: sel ? t.hl : "transparent",
                        ...(readerFamily ? { fontFamily: readerFamily } : {}),
                      }}
                    >
                      {seg.text}
                    </Text>
                  );
                }
                return seg.text;
              })}
            </Text>
          ))}
        </Pressable>
      </ScrollView>

      {/* page indicator */}
      <Box
        align="center"
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 20 + insets.bottom,
          paddingTop: 12,
        }}
      >
        <Text color={t.faint} size={12}>
          {app.page} of {BOOK_PAGES}
        </Text>
      </Box>

      {/* edge handles */}
      {!focusMode && !overlayOpen ? (
        <>
          <Tap
            onPress={() => setToc(true)}
            style={{ position: "absolute", left: 0, top: "46%", zIndex: 20 }}
          >
            <Box
              align="center"
              bg={t.chip}
              height={64}
              justify="center"
              roundedBottomRight={10}
              roundedTopRight={10}
              width={18}
            >
              <Box bg={t.faint} height={26} rounded={2} width={3} />
            </Box>
          </Tap>
          <Tap
            onPress={() => setSearch(true)}
            style={{ position: "absolute", right: 0, top: "46%", zIndex: 20 }}
          >
            <Box
              align="center"
              bg={t.chip}
              height={64}
              justify="center"
              roundedBottomLeft={10}
              roundedTopLeft={10}
              width={18}
            >
              <Box bg={t.faint} height={26} rounded={2} width={3} />
            </Box>
          </Tap>
        </>
      ) : null}

      {/* controls */}
      {controls ? (
        <>
          <ReaderTopBar
            chapterLabel={`Chapter ${ch.n} · ${ch.t}`}
            isBookmarked={isBookmarked}
            onBack={() => router.back()}
            onBookmark={() => {
              app.toggleBookmark(app.page);
              showToast(
                isBookmarked
                  ? "Bookmark removed"
                  : `Page ${app.page} bookmarked`,
              );
            }}
            onFocus={toggleFocusMode}
            onNotes={() => {
              setControls(false);
              router.push("/notes");
            }}
            onSearch={() => {
              setControls(false);
              setSearch(true);
            }}
            onSummarize={openSummarize}
          />
          <ReaderControlsSheet
            focusMode={focusMode}
            onClose={() => setControls(false)}
            onToggleFocusMode={toggleFocusMode}
          />
        </>
      ) : null}

      {/* focus chrome */}
      {focusMode ? (
        <FocusPill
          onExit={() => setFocusMode(false)}
          sessionSec={sessionSec}
          timerOn={app.fmTimer}
        />
      ) : null}
      {focusMode && !controls ? (
        <NextSectionPill onPress={nextSection} />
      ) : null}
      {breakOn ? (
        <BreakCard
          onSkip={() => setBreakOn(false)}
          onTake={() => {
            setBreakOn(false);
            showToast("Enjoy 3 minutes 🌿 I'll hold your place");
          }}
        />
      ) : null}

      {/* Hey Liqrai */}
      {!overlayOpen && !focusMode && app.aiOn ? (
        <LexiBubble
          onPress={() => {
            setLexiOpen(true);
          }}
        />
      ) : null}
      {lexiOpen && app.aiOn ? (
        <LexiSheet onClose={() => setLexiOpen(false)} />
      ) : null}

      {/* drawers & sheets */}
      {toc ? (
        <TocDrawer onClose={() => setToc(false)} onGoPage={goPage} />
      ) : null}
      {search ? (
        <SearchPanel onClose={() => setSearch(false)} onGoPage={goPage} />
      ) : null}
      {summ !== "closed" ? (
        <SummarizeSheet
          loading={summ === "loading"}
          onClose={() => setSumm("closed")}
        />
      ) : null}
      {popWord ? (
        <WordPopover onClose={() => setPopWord(null)} word={popWord} />
      ) : null}
      {sel ? (
        <SelectionMenu
          onAskAI={() => {
            setSel(false);
            setExpl(true);
          }}
          onClose={() => setSel(false)}
        />
      ) : null}
      {expl ? <ExplainSheet onClose={() => setExpl(false)} /> : null}
      {smartReturn ? (
        <SmartReturnSheet
          onClose={() => setSmartReturn(false)}
          onFresh={() => {
            setSmartReturn(false);
            app.set({ page: 1 });
            showToast("Starting from page 1");
          }}
        />
      ) : null}
    </Box>
  );
}
