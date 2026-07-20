import * as NavigationBar from "expo-navigation-bar";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Platform,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Pdf from "react-native-pdf";
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
import type { BottomSheetModalReference } from "@/components/modals/BottomSheetModal/BottomSheetModal";
import {
  FocusChrome,
  LexiBubble,
  LexiSheet,
  PdfSearchPanel,
  SummarizeSheet,
} from "@/components/reader";
import { PdfReflowView } from "@/components/reader/PdfReflowView";
import { ReaderSettingsSheet } from "@/components/reader/ReaderSettingsSheet";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useFocusStore } from "@/stores/focus-store";
import { useProtoTheme } from "@/theme/proto";

type ViewMode = "page" | "reflow";

export default function PdfViewerScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { uri, name } = useLocalSearchParams<{ uri: string; name?: string }>();
  const zoom = useAppStore((s) => s.zoom);
  const aiOn = useAppStore((s) => s.aiOn);
  const bookmarks = useAppStore((s) => s.bookmarks);
  const setApp = useAppStore((s) => s.set);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const showToast = useToastStore((s) => s.showToast);

  const focusOn = useFocusStore((s) => s.active);
  const startFocus = useFocusStore((s) => s.start);
  const exitFocus = useFocusStore((s) => s.exit);

  const [mode, setMode] = useState<ViewMode>("page");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    import("@/components/reader/PdfReflowView").PdfSearchResult[]
  >([]);
  const [indexed, setIndexed] = useState(false);
  const [highlight, setHighlight] = useState<{
    query: string;
    index: number;
    seq: number;
  } | null>(null);
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [chapters, setChapters] = useState<{ title: string; page: number }[]>(
    [],
  );
  const [pageMarker, setPageMarker] = useState<{
    page: number;
    boxes: { x0: number; y0: number; x1: number; y1: number }[];
    seq: number;
  } | null>(null);
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
  const [lexiOpen, setLexiOpen] = useState(false);
  const [summary, setSummary] = useState<"closed" | "done" | "loading">(
    "closed",
  );
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const [pdfPage, setPdfPage] = useState(1);
  const [reflowGoto, setReflowGoto] = useState({ page: 1, seq: 0 });
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

  const switchTo = (next: ViewMode) => {
    if (next === mode) return;
    if (next === "page") {
      setPdfPage(page);
    } else {
      setReflowGoto((g) => ({ page, seq: g.seq + 1 }));
    }
    setMode(next);
  };

  const clampPage = (n: number) =>
    pageCount ? Math.max(1, Math.min(n, pageCount)) : Math.max(1, n);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

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

  let chapter: { title: string; page: number } | null = null;
  for (const c of chapters) {
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
                  setChapters(
                    toc
                      .map((c) => ({
                        title: (c.title ?? "").trim(),
                        page: (c.pageIdx ?? 0) + 1,
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
              focusMode={focusOn}
              gotoPage={reflowGoto}
              highlight={highlight ?? undefined}
              initialPage={reflowGoto.page}
              key={uri}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                setApp({ page: nextPage });
              }}
              onIndexed={() => setIndexed(true)}
              onSearchResults={setSearchResults}
              onSingleTap={() => setImmersive((v) => !v)}
              searchQuery={searchQuery}
              topInset={insets.top}
              uri={uri}
            />
          </Box>
        ) : null}
      </Box>

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
          <Box flex={1}>
            <Text numberOfLines={1} serif size={16} weight="600">
              {name ?? "Document"}
            </Text>
            {chapter ? (
              <Text
                color={t.sub}
                numberOfLines={1}
                size={12}
                style={{ marginTop: 2 }}
              >
                {chapter.title}
              </Text>
            ) : null}
          </Box>
          <Box direction="row" gap={2}>
            <HeaderButton
              onPress={() => switchTo(mode === "reflow" ? "page" : "reflow")}
            >
              <IconReflow
                color={mode === "reflow" ? t.accent : t.ink}
                size={18}
              />
            </HeaderButton>
            <HeaderButton onPress={openSummary}>
              <IconSpark color={t.accent} size={18} />
            </HeaderButton>
            <HeaderButton onPress={toggleFocus}>
              <IconFocus color={focusOn ? t.accent : t.ink} size={18} />
            </HeaderButton>
            <HeaderButton onPress={() => setSearchOpen(true)}>
              <IconSearch color={t.ink} size={18} />
            </HeaderButton>
            <HeaderButton onPress={() => router.push("/notes")}>
              <IconPencil color={t.ink} size={18} />
            </HeaderButton>
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
        focusMode={focusOn}
        onClose={() => setSettingsOpen(false)}
        onToggleFocusMode={toggleFocus}
        onViewModeChange={switchTo}
        ref={sheetRef}
        viewMode={mode}
      />

      <FocusChrome onExit={toggleFocus} pillVisible={immersive} />

      {!immersive && !focusOn && !searchOpen && summary === "closed" && !lexiOpen ? (
        <LexiBubble
          onPress={() => {
            if (!aiOn) {
              showToast("AI is off — enable it in Reading settings");
              return;
            }
            setLexiOpen(true);
          }}
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
      {lexiOpen ? <LexiSheet onClose={() => setLexiOpen(false)} /> : null}
    </Box>
  );
}
