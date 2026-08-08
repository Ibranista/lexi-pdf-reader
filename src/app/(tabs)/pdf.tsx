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
  IconFocus,
  IconSearch,
  IconSliders,
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
import { preloadChatHistory, uploadContext } from "@/services/lexi-ai";
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

/** Stable empty list, so the bookmark selector doesn't return a new array
 *  every render and re-render the whole reader. */
const EMPTY_BOOKMARKS: number[] = [];

/** Eases the title/controls trade when the title is opened out. */
const TITLE_SWAP = LinearTransition.duration(260);

/**
 * Page this document was last left on, or 1 for a document never opened.
 *
 * Persistence is MMKV-backed and therefore synchronous, so this is already
 * hydrated during the first render — which is what lets the reader open
 * *at* the saved page instead of jumping there after a frame.
 */
function savedPageFor(uri: string | undefined): number {
  if (!uri) return 1;
  const state = useRecentsStore.getState();
  // Prefer the uncapped positions cache, so a document that's dropped off the
  // recents shelf still reopens where it was left; fall back to the recents row.
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
    /** Opens straight into this view — "reflow" when arriving from My Notes. */
    view?: ViewMode;
  }>();
  // What the server calls this document. Derived once per open (one sha256) and
  // required by every AI endpoint, so the AI affordances stay closed until it
  // resolves rather than sending a key that would be rejected.
  const docKey = useDocKey(uri, name);
  const zoom = useAppStore((s) => s.zoom);
  const aiOn = useAppStore((s) => s.aiOn);
  const bright = useAppStore((s) => s.bright);
  const setApp = useAppStore((s) => s.set);
  // Bookmarks live on the document, not the app: the app-store's list belongs
  // to the demo book in /reader, so every real PDF was showing its pages.
  const bookmarks = useRecentsStore(
    (s) => s.recents.find((r) => r.uri === uri)?.bookmarks ?? EMPTY_BOOKMARKS,
  );
  const toggleBookmark = (target: number) =>
    useRecentsStore.getState().toggleBookmark(uri, target);
  const showToast = useToastStore((s) => s.showToast);

  // The chat drawer is opened on demand, so load its tiny history while this
  // document is opening. That leaves the drawer ready to render in one pass.
  useEffect(() => {
    if (docKey) preloadChatHistory(docKey);
  }, [docKey]);

  // Tapping the title opens it out to its full length; the controls shrink
  // to make room, then everything settles back on its own.
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

  // Focus session lives in its own store; the screen only starts/exits it.
  const focusOn = useFocusStore((s) => s.active);
  const startFocus = useFocusStore((s) => s.start);
  const exitFocus = useFocusStore((s) => s.exit);

  // The reader the reader prefers (Settings → Default reader), Reflow out of the
  // box. An explicit `view` (e.g. Reflow from My Notes) always wins. Reflow
  // fetches its pdf.js engine from a CDN, so with no connection it can only
  // error — fall back to the native, offline Page view then, whatever the
  // preference. Only the plain default reacts to connectivity.
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
  // Whether the reader has manually toggled the view — once they have, we never
  // move it out from under them (e.g. the late offline check below is skipped).
  const userPickedView = useRef(false);
  // Resume where this document was left off. Read as a lazy initializer, not
  // in an effect — the progress recorder below would otherwise fire first
  // with page 1 and overwrite the very position we're restoring.
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
  // Extraction finished, so an empty result set really means "no matches".
  const [indexed, setIndexed] = useState(false);
  // The docKey whose text has been uploaded, so re-extraction (a font change
  // reloads the reflow page) doesn't send the whole book up a second time.
  const contextSent = useRef<string | null>(null);
  const [highlight, setHighlight] = useState<{
    query: string;
    index: number;
    seq: number;
    /** Set when flashing a note/word from My Notes, to scope the mark to its
     *  own page rather than an earlier occurrence elsewhere. */
    page?: number;
  } | null>(null);
  // Page view's search locator. The native PDF has no text layer we can mark,
  // so a band is drawn over the page using pdf.js geometry from the reflow
  // WebView. It can't follow native scrolling/zooming (react-native-pdf never
  // reports offsets), so it flashes and fades instead of persisting.
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(
    null,
  );
  // The PDF's own outline, used like the prototype's chapter list: it names
  // the chapter in the header and fills the Contents drawer. The native
  // viewer only reports an embedded outline, so the reflow extractor's
  // version (which also parses a printed contents page) wins when richer.
  const [nativeOutline, setNativeOutline] = useState<PdfOutlineEntry[]>([]);
  const [reflowOutline, setReflowOutline] = useState<PdfOutlineEntry[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const outline =
    reflowOutline.length > nativeOutline.length ? reflowOutline : nativeOutline;
  // Text selected in Reflow, and the page it started on. Page view has no
  // text layer to select from, so this only ever fills in Reflow.
  const [selection, setSelection] = useState<{
    text: string;
    page: number;
  } | null>(null);
  // Bumped to tell the reflow page to drop its own selection.
  const [clearSelSeq, setClearSelSeq] = useState(0);
  // The passage the word card is open on, if any.
  const [translating, setTranslating] = useState<TranslateTarget | null>(null);
  // The tapped highlight, held by id so an edit to it re-renders the card.
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  // True while the note composer has the passage. Focusing its input pulls
  // focus out of the WebView, which drops the selection there and would
  // otherwise unmount the composer the instant the keyboard began to open.
  const [composing, setComposing] = useState(false);
  // Saved highlights, painted back into the reflowed text. Narrowed to what
  // the page needs so an unrelated edit (a note's wording) doesn't repaint.
  const annotations = useAnnotationsStore((s) => s.items);
  const highlights = useMemo(
    () =>
      annotations
        .filter((a) => a.uri === uri)
        .map((a) => ({ id: a.id, page: a.page, text: a.text, color: a.color })),
    [annotations, uri],
  );
  // Resolved rather than stored: editing or recolouring the note has to be
  // reflected in the open card, and deleting it has to close it.
  const openNote = useMemo(
    () => annotations.find((a) => a.id === openNoteId) ?? null,
    [annotations, openNoteId],
  );
  const [pageMarker, setPageMarker] = useState<{
    page: number;
    /** Word-accurate boxes; a single full-width entry when geometry is
     *  missing and only the paragraph band is known. */
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
    // markerFade is a stable Animated.Value — only the marker drives this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMarker]);
  // Filing the open document into a collection, without going back to the
  // library to long-press it there.
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

  // Page view opens at whatever page reflow left off on, and vice versa —
  // both start from the saved position so either view resumes correctly.
  const [pdfPage, setPdfPage] = useState(() => savedPageFor(uri));
  const [reflowGoto, setReflowGoto] = useState(() => ({
    page: savedPageFor(uri),
    seq: 0,
  }));
  // Reflow is always mounted so text extraction runs in the background even
  // in Page view — this lets search work regardless of the active view mode.
  const [reflowMounted] = useState(true);

  // The toolbar floats above the document and fades/slides, rather than
  // unmounting — unmounting resized the content and forced the PDF and
  // WebView to re-layout on every toggle, which felt stuck.
  const [bar] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: immersive ? 0 : 1,
      // Match the WebView spacer transition so the controls and document
      // travel together instead of one visibly snapping ahead of the other.
      duration: 380,
      easing: Easing.bezier(0.33, 0.01, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [immersive, bar]);

  // hide the Android system navigation bar in distraction-free mode
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync(immersive ? "hidden" : "visible");
    return () => {
      NavigationBar.setVisibilityAsync("visible");
    };
  }, [immersive]);

  // Focus mode (design: ◎ toolbar button): spotlight in reflow, chrome
  // tucked away, session pill with timer. Entering hides the toolbar too.
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

  // never leave a session ticking after the reader unmounts
  useEffect(() => () => useFocusStore.getState().exit(), []);

  // Recents are recorded here rather than at the library tap, so every way
  // into the reader (library, files, a deep link) lands on the shelf.
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

  // Connectivity can be unknown at first render (NetInfo is async); resolve it
  // once, at open, and if we're offline yet defaulted into Reflow, drop back to
  // Page view — Reflow's engine can't load without a connection. One-shot on
  // purpose: losing the connection later, after Reflow has already loaded,
  // should not yank the reader out of it. Never overrides an explicit `view`
  // param or a view the reader chose themselves.
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

  /** Plain page jump, in whichever view is active. */
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

  /**
   * Notes and bookmarks navigate by leaving a request behind rather than by
   * passing a param, because they return here with `router.back()` — there is
   * no navigation to attach a param to. Consumed on arrival so it fires once.
   */
  useFocusEffect(
    useCallback(() => {
      const jump = useReaderJumpStore.getState().consume(uri);
      if (!jump) return;
      const nextPage = clampPage(jump.page);
      setPage(nextPage);
      setApp({ page: nextPage });
      // A flash (arriving from a tapped note or saved word) always reads in
      // reflow — the page view is a bitmap with no live text to light up — and
      // briefly marks the passage so the reader sees exactly where it sits.
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
      // The store read must happen exactly once, on focus; the rest closes over
      // view state that changes every render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uri]),
  );

  // Jump to a result, staying in whichever view the reader is already in.
  // Reflow marks the exact word; page view flashes a locator band where the
  // matched paragraph sits on the page.
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
    // Marked even from page view, so it's already in place if they switch.
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

  // Smart Zoom (100–200%) caps how far the page view zooms.
  const smartScale = Math.max(1.25, zoom / 100);

  // The chapter the reader is in: the last outline entry starting at or
  // before the current page (the outline is sorted by page).
  let chapter: PdfOutlineEntry | null = null;
  for (const c of outline) {
    if (c.page > page) break;
    chapter = c;
  }

  // Keep the first page's top content below the header. The header stays
  // translucent, while no title or opening line is hidden under its controls.
  const [barH, setBarH] = useState(insets.top + 56);
  const pageShift = bar.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barH],
  });

  // Settings sheet: opened by the toolbar's options button or the page
  // indicator. The swipe-up-from-the-bottom-edge gesture that used to open it
  // was removed — it sat on the same edge as the Android system gestures and
  // fired while scrolling, so the sheet kept appearing unasked.
  // Closing is gorhom's — drag down or tap the backdrop.
  const sheetRef = useRef<BottomSheetModalReference>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);

  // present via an effect — the ref must not be read during render
  useEffect(() => {
    if (settingsOpen) sheetRef.current?.present();
  }, [settingsOpen]);

  // Swipe in from the left edge opens Contents, mirroring the search panel
  // on the right. Only armed when the document actually has an outline.
  const swipeFromLeftEdge = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX > 30) setOutlineOpen(true);
    });

  // Mirror on the right: swipe in to search. No handle tab here — the
  // toolbar's search button already advertises it.
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

      {/* Document surfaces fill the screen and never resize. Both stay
          mounted; the inactive one is hidden. */}
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
                // scrolled off the marked page — the band no longer points
                // at anything
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
            // fit-width at scale 1: page top sits at the view top after a
            // page jump, so page-space fractions map straight to view px
            const dispH = winW * (pageDims.h / pageDims.w);
            const topMost = Math.min(...pageMarker.boxes.map((b) => b.y0));
            // match sits below the fold of the jumped-to page — point at it
            // instead of drawing invisible boxes
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
            // one box per line the match touches, padded a couple px so the
            // wash reads as a marker pen pass over the word, not a censor bar
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
                  // stays live for background text extraction and search.
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
            {/* Reflow moves its internal spacer in lockstep with the same
                focus animation that moves the native PDF surface. */}
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
                // While reflow is the hidden background view, its own
                // scrolling (extraction, the initial jump) is not the
                // reader's position — only the visible view sets that.
                if (mode !== "reflow") return;
                setPage(nextPage);
                setApp({ page: nextPage });
              }}
              onIndexed={() => setIndexed(true)}
              // Hands the extracted text to the server so Liqrai answers from
              // the whole book rather than only the page in view. Batches are
              // uploaded as they arrive rather than buffered, so a long book
              // doesn't sit in memory twice; failures are the service's to
              // swallow, since chat still works off its per-turn excerpt.
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
                // One entry per page — fills the page indicator's total when
                // the native layer never got to report it (its error screen,
                // or a document only reflow could open). The native count
                // stays authoritative when it exists.
                if (counts.length) setPageCount((c) => c || counts.length);
              }}
              onSearchResults={setSearchResults}
              onSelection={(text, selPage) => {
                // The composer owns the passage once it's open; the WebView
                // losing its selection is expected, not a dismissal.
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

      {/* Page brightness — dims the reading area (both Page and Reflow), while
          the toolbar and controls (higher zIndex) stay at full brightness.
          Never intercepts touches. Skipped entirely at 100%. */}
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

      {/* floating toolbar */}
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
          {/* Layout transitions animate the give-and-take between the title
              and the controls, so neither has to be measured by hand. */}
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
          {/* Controls step aside while the title is open, then fade back. */}
          {titleOpen ? null : (
            <Reanimated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              layout={TITLE_SWAP}
            >
              {/* Search and Focus stay out here — both are reading actions
                  wanted mid-page, without a detour through a sheet. View mode,
                  AI, notes and bookmark live in the settings sheet behind the
                  options button, which is also the only way in now that the
                  swipe-up-from-the-bottom-edge gesture is gone. Focus is still
                  mirrored by the sheet's own toggle; the two share one handler,
                  so they can't disagree. */}
              <Box direction="row" gap={2}>
                <HeaderButton onPress={toggleFocus}>
                  <IconFocus color={focusOn ? t.accent : t.ink} size={18} />
                </HeaderButton>
                <HeaderButton onPress={() => setSearchOpen(true)}>
                  <IconSearch color={t.ink} size={18} />
                </HeaderButton>
                <HeaderButton onPress={openSettings}>
                  <IconSliders color={t.ink} size={18} />
                </HeaderButton>
              </Box>
            </Reanimated.View>
          )}
        </Box>
      </Animated.View>

      {/* Page indicator matches the example reader. It also opens Reading
          settings, replacing the previous bottom grabber. Unlike the rest of
          the chrome it never fully leaves: tied to `bar` it vanished the
          moment a tap cleared the toolbar, which read as the page number
          being gone — so in distraction-free reading it only dims, and taps
          pass through it to the document. */}
      <Animated.View
        pointerEvents={immersive ? "none" : "auto"}
        style={{
          position: "absolute",
          bottom: insets.bottom + 8,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 10,
          opacity: bar.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
          }),
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

      {/* Left-edge Contents affordance: a catcher for the swipe, plus the
          example's handle tab so the gesture is discoverable. Both only
          exist when the document has an outline to show. */}
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

      <ReaderSettingsSheet
        bookmarked={bookmarks.includes(page)}
        filed={filedSomewhere}
        focusMode={focusOn}
        onClose={() => setSettingsOpen(false)}
        onOpenCollections={() => {
          sheetRef.current?.dismiss();
          setSettingsOpen(false);
          setFilingOpen(true);
        }}
        // Reflow only: highlights and notes come from selecting text, which
        // Page view's bitmap can't do — same condition the toolbar button had.
        onOpenNotes={
          mode === "reflow"
            ? () => {
                sheetRef.current?.dismiss();
                setSettingsOpen(false);
                router.push({
                  pathname: "/notes",
                  params: { uri, name: name ?? "Document" },
                });
              }
            : undefined
        }
        onToggleBookmark={() => {
          toggleBookmark(page);
          showToast(
            bookmarks.includes(page)
              ? "Bookmark removed"
              : `Page ${page} bookmarked`,
          );
        }}
        onToggleFocusMode={toggleFocus}
        onViewModeChange={switchTo}
        page={page}
        ref={sheetRef}
        viewMode={mode}
      />

      {/* focus pill + break card; pill yields while the toolbar is out */}
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
            // Drop the WebView's own selection too, or the handles stay up
            // and the next selectionchange re-opens the bar.
            setClearSelSeq((n) => n + 1);
          }}
          onTranslate={() => {
            // No key yet means the hash hasn't landed; the lookup would 400.
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
            // Drop the WebView's own selection as the card opens, or Android's
            // native selection menu (Copy · Translate · …) and its handles
            // float on top of the card, over the very passage it's about.
            setClearSelSeq((n) => n + 1);
          }}
          page={selection.page}
          // Kept on the annotation itself so My Notes can still name the
          // document after it drops off the (capped) recents list.
          source={name ?? "Document"}
          text={selection.text}
          uri={uri}
        />
      ) : null}

      {/* Word card. Closing it also drops the selection, so the reader is left
          on the passage rather than with the action bar back over it. */}
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

      {/* A tapped highlight opens where it is, rather than sending the reader
          off to the Notes screen and losing the page. */}
      {openNote ? (
        <NoteCard annotation={openNote} onClose={() => setOpenNoteId(null)} />
      ) : null}

      <SignInWall />
    </Box>
  );
}
