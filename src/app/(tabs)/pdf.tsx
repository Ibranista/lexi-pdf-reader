import * as NavigationBar from "expo-navigation-bar";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Easing,
  Platform,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Pdf from "react-native-pdf";
import Reanimated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, Text } from "@/components/atoms";
import {
  HeaderButton,
  IconBack,
  IconBookmark,
  IconFocus,
  IconPencil,
  IconReflow,
  IconSearch,
  IconSpark,
  Tap,
} from "@/components/lexi-components";
import { CollectionPicker } from "@/components/library/CollectionPicker";
import type { BottomSheetModalReference } from "@/components/modals/BottomSheetModal/BottomSheetModal";
import {
  AnnotateBar,
  FocusChrome,
  LexiBubble,
  LexiSheet,
  PdfOutlineDrawer,
  PdfSearchPanel,
  SummarizeSheet,
} from "@/components/reader";
import { SignInWall } from "@/components/auth/SignInWall";
import { NoteCard } from "@/components/reader/NoteCard";
import type { PdfOutlineEntry } from "@/components/reader/PdfReflowView";
import { PdfReflowView } from "@/components/reader/PdfReflowView";
import { ReaderSettingsSheet } from "@/components/reader/ReaderSettingsSheet";
import type { TranslateTarget } from "@/components/reader/TranslateCard";
import { TranslateCard } from "@/components/reader/TranslateCard";
import { uploadContext } from "@/services/lexi-ai";
import { useAnnotationsStore } from "@/stores/annotations-store";
import {
  useAppStore,
  useReaderJumpStore,
  useToastStore,
} from "@/stores/app-store";
import { useCollectionsStore } from "@/stores/collections-store";
import { useFocusStore } from "@/stores/focus-store";
import { useRecentsStore } from "@/stores/recents-store";
import NetInfo from "@react-native-community/netinfo";

import { isOnline } from "@/utils/connectivity";
import { useDocKey } from "@/utils/doc-key";
import { useProtoTheme } from "@/theme/proto";
import { expectedReadingMs } from "@/utils/reading-progress";

type ViewMode = "page" | "reflow";

const EMPTY_BOOKMARKS: number[] = [];

const TITLE_SWAP = LinearTransition.duration(260);

function savedPageFor(uri: string | undefined): number {
  if (!uri) return 1;
  const state = useRecentsStore.getState();
  const saved =
    state.positions[uri] ??
    state.recents.find((r) => r.uri === uri)?.page;
  return saved && saved > 0 ? saved : 1;
}

export default function PdfViewerScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { uri, name, view } = useLocalSearchParams<{
    uri: string;
    name?: string;
    view?: ViewMode;
  }>();
  const docKey = useDocKey(uri, name);
  const zoom = useAppStore((s) => s.zoom);
  const aiOn = useAppStore((s) => s.aiOn);
  const bright = useAppStore((s) => s.bright);
  const setApp = useAppStore((s) => s.set);
  const bookmarks = useRecentsStore(
    (s) => s.recents.find((r) => r.uri === uri)?.bookmarks ?? EMPTY_BOOKMARKS,
  );
  const toggleBookmark = (target: number) =>
    useRecentsStore.getState().toggleBookmark(uri, target);
  const showToast = useToastStore((s) => s.showToast);

  const [titleOpen, setTitleOpen] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const toggleTitle = () => {
    clearTimeout(titleTimer.current);
    setTitleOpen((open) => {
      if (open) return false;
      titleTimer.current = setTimeout(() => setTitleOpen(false), 4000);
      return true;
    });
  };
  useEffect(() => () => clearTimeout(titleTimer.current), []);

  const focusOn = useFocusStore((s) => s.active);
  const startFocus = useFocusStore((s) => s.start);
  const exitFocus = useFocusStore((s) => s.exit);

  const defaultReader = useAppStore((s) => s.defaultReader);
  const [mode, setMode] = useState<ViewMode>(
    view === "page"
      ? "page"
      : view === "reflow"
        ? "reflow"
        : !isOnline()
          ? "page"
          : defaultReader,
  );
  const userPickedView = useRef(false);
  const [page, setPage] = useState(() => savedPageFor(uri));
  const [pageCount, setPageCount] = useState(0);
  const readingVisit = useRef({ uri, page: savedPageFor(uri), startedAt: 0 });
  const appIsActive = useRef(AppState.currentState === "active");
  const [error, setError] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    import("@/components/reader/PdfReflowView").PdfSearchResult[]
  >([]);
  const [indexed, setIndexed] = useState(false);
  const contextSent = useRef<string | null>(null);
  const [highlight, setHighlight] = useState<{
    query: string;
    index: number;
    seq: number;
    page?: number;
  } | null>(null);
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [nativeOutline, setNativeOutline] = useState<PdfOutlineEntry[]>([]);
  const [reflowOutline, setReflowOutline] = useState<PdfOutlineEntry[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const outline =
    reflowOutline.length > nativeOutline.length ? reflowOutline : nativeOutline;
  const [selection, setSelection] = useState<{
    text: string;
    page: number;
  } | null>(null);
  const [clearSelSeq, setClearSelSeq] = useState(0);
  const [translating, setTranslating] = useState<TranslateTarget | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const annotations = useAnnotationsStore((s) => s.items);
  const highlights = useMemo(
    () =>
      annotations
        .filter((a) => a.uri === uri)
        .map((a) => ({ id: a.id, page: a.page, text: a.text, color: a.color })),
    [annotations, uri],
  );
  const openNote = useMemo(
    () => annotations.find((a) => a.id === openNoteId) ?? null,
    [annotations, openNoteId],
  );
  const [pageMarker, setPageMarker] = useState<{
    page: number;
    boxes: { x0: number; y0: number; x1: number; y1: number }[];
    seq: number;
  } | null>(null);

  const recordCurrentReadingTime = useCallback(() => {
    const current = readingVisit.current;
    if (!current.uri) return;
    const now = Date.now();
    if (!current.startedAt) {
      current.startedAt = now;
      return;
    }
    const elapsed = now - current.startedAt;
    if (elapsed > 0) {
      useRecentsStore
        .getState()
        .recordReadingTime(current.uri, current.page, elapsed);
    }
    readingVisit.current.startedAt = now;
  }, []);

  useEffect(() => {
    if (
      readingVisit.current.uri === uri &&
      readingVisit.current.page !== page
    ) {
      recordCurrentReadingTime();
    }
    readingVisit.current = { uri, page, startedAt: Date.now() };
  }, [uri, page, recordCurrentReadingTime]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        appIsActive.current = true;
        readingVisit.current.startedAt = Date.now();
      } else if (appIsActive.current) {
        recordCurrentReadingTime();
        appIsActive.current = false;
      }
    });
    return () => {
      subscription.remove();
      if (appIsActive.current) recordCurrentReadingTime();
    };
  }, [recordCurrentReadingTime]);
  const [markerFade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!pageMarker) return;
    markerFade.setValue(0);
    Animated.sequence([
      Animated.timing(markerFade, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.delay(1900),
      Animated.timing(markerFade, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setPageMarker(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMarker]);
  const [filingOpen, setFilingOpen] = useState(false);
  const filedSomewhere = useCollectionsStore((s) =>
    Object.values(s.items).some((shelf) => shelf.some((d) => d.uri === uri)),
  );
  const [lexiOpen, setLexiOpen] = useState(false);
  const [summary, setSummary] = useState<"closed" | "done" | "loading">(
    "closed",
  );
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const [pdfPage, setPdfPage] = useState(() => savedPageFor(uri));
  const [reflowGoto, setReflowGoto] = useState(() => ({
    page: savedPageFor(uri),
    seq: 0,
  }));
  const [reflowMounted] = useState(true);

  const [bar] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: immersive ? 0 : 1,
      duration: 380,
      easing: Easing.bezier(0.33, 0.01, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [immersive, bar]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync(immersive ? "hidden" : "visible");
    return () => {
      NavigationBar.setVisibilityAsync("visible");
    };
  }, [immersive]);

  const toggleFocus = () => {
    if (focusOn) {
      exitFocus();
      setImmersive(false);
      showToast("Focus mode off");
    } else {
      startFocus();
      setImmersive(true);
      showToast("Focus mode — your paragraph stays bright");
    }
  };

  useEffect(() => () => useFocusStore.getState().exit(), []);

  useEffect(() => {
    if (!uri) return;
    useRecentsStore
      .getState()
      .recordOpen({ uri, name: name ?? "Document", ext: "PDF" });
  }, [uri, name]);

  useEffect(() => {
    if (!uri) return;
    useRecentsStore
      .getState()
      .recordProgress(uri, page, pageCount || undefined);
  }, [uri, page, pageCount]);

  const switchTo = (next: ViewMode) => {
    if (next === mode) return;
    userPickedView.current = true;
    if (next === "page") {
      setPdfPage(page);
    } else {
      setReflowGoto((g) => ({ page, seq: g.seq + 1 }));
    }
    setMode(next);
  };

  useEffect(() => {
    if (view || userPickedView.current) return;
    let cancelled = false;
    NetInfo.fetch()
      .then((state) => {
        const offline =
          state.isConnected === false || state.isInternetReachable === false;
        if (!cancelled && offline && !userPickedView.current) {
          setMode((current) => (current === "reflow" ? "page" : current));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [view]);

  const clampPage = (n: number) =>
    pageCount ? Math.max(1, Math.min(n, pageCount)) : Math.max(1, n);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const goToPage = (requestedPage: number) => {
    const nextPage = clampPage(requestedPage);
    setPage(nextPage);
    setApp({ page: nextPage });
    if (mode === "page") {
      setPdfPage(nextPage);
    } else {
      setReflowGoto((current) => ({ page: nextPage, seq: current.seq + 1 }));
    }
  };

  useFocusEffect(
    useCallback(() => {
      const jump = useReaderJumpStore.getState().consume(uri);
      if (!jump) return;
      const nextPage = clampPage(jump.page);
      setPage(nextPage);
      setApp({ page: nextPage });
      if (jump.flash) {
        setMode("reflow");
        setReflowGoto((g) => ({ page: nextPage, seq: g.seq + 1 }));
        setHighlight((h) => ({
          query: jump.flash as string,
          index: 0,
          page: nextPage,
          seq: (h?.seq ?? 0) + 1,
        }));
      } else if (mode === "page") {
        setPdfPage(nextPage);
      } else {
        setReflowGoto((g) => ({ page: nextPage, seq: g.seq + 1 }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uri]),
  );

  const goToSearchResult = (requestedPage: number, index: number) => {
    const query = searchQuery.trim();
    const nextPage = clampPage(requestedPage);
    const result = searchResults[index];
    setPage(nextPage);
    setApp({ page: nextPage });
    if (mode === "page") {
      setPdfPage(nextPage);
      const boxes = result?.boxes?.length
        ? result.boxes
        : typeof result?.ny0 === "number" && result.ny0 >= 0
          ? [
              {
                x0: 0.04,
                x1: 0.96,
                y0: result.ny0,
                y1: result.ny1 ?? result.ny0 + 0.03,
              },
            ]
          : null;
      if (boxes) {
        setPageMarker((m) => ({
          page: nextPage,
          boxes,
          seq: (m?.seq ?? 0) + 1,
        }));
      }
    } else {
      setReflowGoto((current) => ({ page: nextPage, seq: current.seq + 1 }));
    }
    if (query) {
      setHighlight((h) => ({ query, index, seq: (h?.seq ?? 0) + 1 }));
    }
    closeSearch();
  };

  const openSummary = () => {
    if (!aiOn) {
      showToast("AI is off — enable it in Reading settings");
      return;
    }
    setSummary("loading");
    clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(() => setSummary("done"), 900);
  };

  useEffect(() => () => clearTimeout(summaryTimer.current), []);

  const smartScale = Math.max(1.25, zoom / 100);

  let chapter: PdfOutlineEntry | null = null;
  for (const c of outline) {
    if (c.page > page) break;
    chapter = c;
  }

  const [barH, setBarH] = useState(insets.top + 56);
  const pageShift = bar.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barH],
  });

  const sheetRef = useRef<BottomSheetModalReference>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);

  useEffect(() => {
    if (settingsOpen) sheetRef.current?.present();
  }, [settingsOpen]);

  const swipeUpFromBottom = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationY < -30) setSettingsOpen(true);
    });

  const swipeFromLeftEdge = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX > 30) setOutlineOpen(true);
    });

  const swipeFromRightEdge = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -30) setSearchOpen(true);
    });

  if (!uri) {
    return (
      <Box align="center" bg={t.page} flex={1} justify="center">
        <Text color={t.sub} size={13}>
          No document selected.
        </Text>
      </Box>
    );
  }

  return (
    <Box bg={t.page} flex={1}>
      <StatusBar animated hidden={immersive} />

      <Box flex={1}>
        <Animated.View
          style={[
            mode === "page" ? { flex: 1 } : ({ display: "none" } as const),
            { marginBottom: -barH, transform: [{ translateY: pageShift }] },
          ]}
        >
          {error ? (
            <Box align="center" flex={1} gap={8} justify="center" paddingX={32}>
              <Text align="center" size={15} weight="600">
                Couldn&apos;t open this document
              </Text>
              <Text align="center" color={t.sub} lh={20} size={13}>
                {error}
              </Text>
            </Box>
          ) : (
            <Pdf
              enableAntialiasing
              enablePaging={false}
              maxScale={Math.max(3, smartScale)}
              minScale={1}
              onError={(err) =>
                setError((err as { message?: string })?.message ?? String(err))
              }
              onLoadComplete={(numberOfPages, _path, size, toc) => {
                setPageCount(numberOfPages);
                if (size?.width && size?.height)
                  setPageDims({ w: size.width, h: size.height });
                if (toc?.length) {
                  setNativeOutline(
                    toc
                      .map((c) => ({
                        title: (c.title ?? "").trim(),
                        page: (c.pageIdx ?? 0) + 1,
                        level: 0,
                      }))
                      .filter((c) => c.title)
                      .sort((a, b) => a.page - b.page),
                  );
                }
              }}
              onPageChanged={(p) => {
                setPage(p);
                setApp({ page: p });
                setPageMarker((m) => (m && m.page !== p ? null : m));
              }}
              onPageSingleTap={() => setImmersive((v) => !v)}
              onScaleChanged={() => setPageMarker(null)}
              page={pdfPage}
              renderActivityIndicator={() => (
                <ActivityIndicator color={t.accent} size="large" />
              )}
              scale={1}
              source={{ uri, cache: true }}
              spacing={8}
              style={{
                flex: 1,
                width: Dimensions.get("window").width,
                backgroundColor: t.page,
              }}
              trustAllCerts={false}
            />
          )}
          {(() => {
            if (!pageMarker || !pageDims || error) return null;
            const winW = Dimensions.get("window").width;
            const winH = Dimensions.get("window").height;
            const dispH = winW * (pageDims.h / pageDims.w);
            const topMost = Math.min(...pageMarker.boxes.map((b) => b.y0));
            if (topMost * dispH > winH - barH - 48) {
              return (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: 96 + insets.bottom,
                    alignSelf: "center",
                    opacity: markerFade,
                  }}
                >
                  <Box
                    bg={t.card}
                    borderColor={t.line}
                    borderWidth={1}
                    paddingX={14}
                    paddingY={8}
                    rounded={999}
                    style={{ elevation: 6 }}
                  >
                    <Text color={t.sub} size={12} weight="600">
                      Match lower on this page ↓
                    </Text>
                  </Box>
                </Animated.View>
              );
            }
            return pageMarker.boxes.map((b, i) => (
              <Animated.View
                key={`${pageMarker.seq}-${i}`}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: b.x0 * winW - 3,
                  top: b.y0 * dispH - 2,
                  width: Math.max(18, (b.x1 - b.x0) * winW + 6),
                  height: Math.max(14, (b.y1 - b.y0) * dispH + 4),
                  borderRadius: 4,
                  backgroundColor: t.hl,
                  opacity: markerFade.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.45],
                  }),
                }}
              />
            ));
          })()}
        </Animated.View>

        {reflowMounted ? (
          <Box
            style={
              mode === "reflow"
                ? { flex: 1 }
                : // Keep off-screen instead of display:none so the WebView
                  {
                    position: "absolute",
                    width: 1,
                    height: 1,
                    top: -9999,
                    left: -9999,
                    opacity: 0,
                    pointerEvents: "none",
                  }
            }
          >
            <PdfReflowView
              chromeOffset={immersive ? 0 : barH}
              clearSelectionSeq={clearSelSeq}
              highlights={highlights}
              onHighlightPress={setOpenNoteId}
              focusMode={focusOn}
              gotoPage={reflowGoto}
              highlight={highlight ?? undefined}
              initialPage={reflowGoto.page}
              key={uri}
              onPageChange={(nextPage) => {
                if (mode !== "reflow") return;
                setPage(nextPage);
                setApp({ page: nextPage });
              }}
              onIndexed={() => setIndexed(true)}
              onContext={
                aiOn && docKey
                  ? (pages, done) => {
                      if (contextSent.current === docKey) return;
                      if (done) contextSent.current = docKey;
                      if (!pages.length) return;
                      void uploadContext({
                        author: undefined,
                        docKey,
                        pageCount,
                        pages,
                        title: name ?? "Document",
                      });
                    }
                  : undefined
              }
              onOutline={setReflowOutline}
              onWordCounts={(counts) => {
                useRecentsStore.getState().setReadingPlan(
                  uri,
                  counts.map((count) => expectedReadingMs(count || 275)),
                );
              }}
              onSearchResults={setSearchResults}
              onSelection={(text, selPage) => {
                if (composing) return;
                setSelection(text ? { text, page: selPage || page } : null);
              }}
              onSingleTap={() => setImmersive((v) => !v)}
              onSwitchToPage={() => switchTo("page")}
              searchQuery={searchQuery}
              topInset={insets.top}
              uri={uri}
            />
          </Box>
        ) : null}
      </Box>

      {bright < 100 ? (
        <Box
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 8,
            backgroundColor: "#000",
            opacity: ((100 - bright) / 100) * 0.7,
          }}
        />
      ) : null}

      <Animated.View
        pointerEvents={immersive ? "none" : "auto"}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          opacity: bar,
          transform: [
            {
              translateY: bar.interpolate({
                inputRange: [0, 1],
                outputRange: [-(insets.top + 64), 0],
              }),
            },
          ],
        }}
      >
        <Box
          align="center"
          bg={t.glass}
          direction="row"
          gap={12}
          onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
          paddingLeft={14}
          paddingRight={14}
          style={{
            paddingTop: insets.top + 6,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: t.line,
          }}
        >
          <HeaderButton onPress={() => router.back()}>
            <IconBack color={t.ink} size={18} />
          </HeaderButton>
          <Reanimated.View layout={TITLE_SWAP} style={{ flex: 1 }}>
            <Tap onPress={toggleTitle} scale={0.99}>
              <Text
                numberOfLines={titleOpen ? 4 : 1}
                serif
                size={16}
                weight="600"
              >
                {name ?? "Document"}
              </Text>
              {chapter ? (
                <Text
                  color={t.sub}
                  numberOfLines={titleOpen ? 2 : 1}
                  size={12}
                  style={{ marginTop: 2 }}
                >
                  {chapter.title}
                </Text>
              ) : null}
            </Tap>
          </Reanimated.View>
          {titleOpen ? null : (
            <Reanimated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              layout={TITLE_SWAP}
            >
              <Box direction="row" gap={2}>
                <HeaderButton
                  onPress={() =>
                    switchTo(mode === "reflow" ? "page" : "reflow")
                  }
                >
                  <IconReflow
                    color={mode === "reflow" ? t.accent : t.ink}
                    size={18}
                  />
                </HeaderButton>
                <HeaderButton
                  onPress={() => {
                    const next = !aiOn;
                    setApp({ aiOn: next });
                    showToast(next ? "AI companion on" : "AI companion off");
                  }}
                >
                  <IconSpark color={aiOn ? t.accent : t.ink} size={18} />
                </HeaderButton>
                <HeaderButton onPress={toggleFocus}>
                  <IconFocus color={focusOn ? t.accent : t.ink} size={18} />
                </HeaderButton>
                <HeaderButton onPress={() => setSearchOpen(true)}>
                  <IconSearch color={t.ink} size={18} />
                </HeaderButton>
                {mode === "reflow" ? (
                  <HeaderButton
                    onPress={() =>
                      router.push({
                        pathname: "/notes",
                        params: { uri, name: name ?? "Document" },
                      })
                    }
                  >
                    <IconPencil color={t.ink} size={18} />
                  </HeaderButton>
                ) : null}
                <HeaderButton
                  onPress={() => {
                    toggleBookmark(page);
                    showToast(
                      bookmarks.includes(page)
                        ? "Bookmark removed"
                        : `Page ${page} bookmarked`,
                    );
                  }}
                >
                  <IconBookmark
                    color={bookmarks.includes(page) ? t.accent : t.ink}
                    fill={bookmarks.includes(page) ? t.accent : "none"}
                    size={18}
                  />
                </HeaderButton>
              </Box>
            </Reanimated.View>
          )}
        </Box>
      </Animated.View>

      <Animated.View
        pointerEvents={immersive ? "none" : "auto"}
        style={{
          position: "absolute",
          bottom: insets.bottom + 8,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 10,
          opacity: bar,
          transform: [
            {
              translateY: bar.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        }}
      >
        <Tap onPress={openSettings} scale={0.96}>
          <Box paddingX={22} paddingY={10}>
            <Text color={t.faint} size={12}>
              {page} of {pageCount > 0 ? pageCount : "…"}
            </Text>
          </Box>
        </Tap>
      </Animated.View>

      {(outline.length || bookmarks.length) && !outlineOpen && !searchOpen ? (
        <GestureDetector gesture={swipeFromLeftEdge}>
          <Box
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 24,
              zIndex: 9,
            }}
          >
            {!immersive ? (
              <Tap
                onPress={() => setOutlineOpen(true)}
                style={{ position: "absolute", left: 0, top: "46%" }}
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
            ) : null}
          </Box>
        </GestureDetector>
      ) : null}

      {!outlineOpen && !searchOpen ? (
        <GestureDetector gesture={swipeFromRightEdge}>
          <Box
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 24,
              zIndex: 9,
            }}
          />
        </GestureDetector>
      ) : null}

      <GestureDetector gesture={swipeUpFromBottom}>
        <Box
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: insets.bottom + 28,
            zIndex: 9,
          }}
        />
      </GestureDetector>

      <ReaderSettingsSheet
        filed={filedSomewhere}
        focusMode={focusOn}
        onClose={() => setSettingsOpen(false)}
        onOpenCollections={() => {
          sheetRef.current?.dismiss();
          setSettingsOpen(false);
          setFilingOpen(true);
        }}
        onToggleFocusMode={toggleFocus}
        onViewModeChange={switchTo}
        ref={sheetRef}
        viewMode={mode}
      />

      <FocusChrome onExit={toggleFocus} pillVisible={immersive} />

      {!immersive &&
      !focusOn &&
      !searchOpen &&
      summary === "closed" &&
      !lexiOpen &&
      aiOn ? (
        <LexiBubble
          onPress={() => {
            setLexiOpen(true);
          }}
        />
      ) : null}
      {outlineOpen ? (
        <PdfOutlineDrawer
          bookmarks={bookmarks}
          entries={outline}
          onClose={() => setOutlineOpen(false)}
          onGoPage={(target) => {
            setOutlineOpen(false);
            goToPage(target);
          }}
          onRemoveBookmark={toggleBookmark}
          page={page}
          title={name ?? "Document"}
        />
      ) : null}
      {searchOpen ? (
        <PdfSearchPanel
          indexed={indexed}
          onClose={closeSearch}
          onGoPage={goToSearchResult}
          onSearch={setSearchQuery}
          results={searchResults}
        />
      ) : null}
      {summary !== "closed" ? (
        <SummarizeSheet
          loading={summary === "loading"}
          onClose={() => setSummary("closed")}
        />
      ) : null}
      {lexiOpen && aiOn && docKey ? (
        <LexiSheet
          book={{ docKey, page, title: name ?? "Document" }}
          onClose={() => setLexiOpen(false)}
        />
      ) : null}
      {filingOpen ? (
        <CollectionPicker
          doc={{ uri, name: name ?? "Document", ext: "PDF" }}
          onClose={() => setFilingOpen(false)}
        />
      ) : null}
      {selection && mode === "reflow" && !translating ? (
        <AnnotateBar
          onBookmark={() => {
            toggleBookmark(selection.page);
            showToast(`Page ${selection.page} bookmarked`);
          }}
          onComposingChange={setComposing}
          onClose={() => {
            setComposing(false);
            setSelection(null);
            setClearSelSeq((n) => n + 1);
          }}
          onTranslate={() => {
            if (!docKey) {
              showToast("One moment — still opening this document");
              return;
            }
            setTranslating({
              docKey,
              page: selection.page,
              source: name ?? "Document",
              text: selection.text,
              uri,
            });
            setClearSelSeq((n) => n + 1);
          }}
          page={selection.page}
          source={name ?? "Document"}
          text={selection.text}
          uri={uri}
        />
      ) : null}

      {translating ? (
        <TranslateCard
          onClose={() => {
            setTranslating(null);
            setSelection(null);
            setClearSelSeq((n) => n + 1);
          }}
          onHighlight={(result) => {
            useAnnotationsStore.getState().add({
              color: "sage",
              note: `${result.tr} — ${result.translit ?? result.langName}`,
              page: translating.page,
              source: name ?? "Document",
              text: translating.text,
              uri,
            });
          }}
          target={translating}
        />
      ) : null}

      {openNote ? (
        <NoteCard annotation={openNote} onClose={() => setOpenNoteId(null)} />
      ) : null}

      <SignInWall />
    </Box>
  );
}
