import * as NavigationBar from "expo-navigation-bar";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Box, Text } from "@/components/atoms";
import {
  HeaderButton,
  IconBack,
  IconType,
} from "@/components/lexi-components";
import type { BottomSheetModalReference } from "@/components/modals/BottomSheetModal/BottomSheetModal";
import { AnnotateBar, PdfOutlineDrawer } from "@/components/reader";
import type { PdfOutlineEntry } from "@/components/reader/PdfReflowView";
import { ReaderSettingsSheet } from "@/components/reader/ReaderSettingsSheet";
import { bookDocUri } from "@/hooks/use-book-suggestions";
import { useCachedBook } from "@/hooks/use-cached-book";
import { LINE_SPACING, useAppStore } from "@/stores/app-store";
import { useRecentsStore } from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";
import {
  fontStack,
  READ_WIDTH_PX,
  softInk,
} from "@/utils/reader-typography";

interface ReaderStyle {
  bg: string;
  faint: string;
  ff: string;
  fg: string;
  fs: number;
  lh: number;
  link: string;
  px: number;
}

function readerCss(s: ReaderStyle): string {
  return `
  /* Must stay the first rule — an @import anywhere else is dropped. Without
     it the reader's chosen typeface silently fell back to whatever the device
     happened to have, so picking Atkinson Hyperlegible here did nothing. */
  @import url('https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&family=Hanken+Grotesk:wght@400;500;600&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Comic+Relief:wght@400;700&display=swap');
  html { -webkit-text-size-adjust: 100%; }
  html, body {
    background: ${s.bg} !important;
    margin: 0 !important;
    width: auto !important;
    max-width: none !important;
  }
  body {
    color: ${s.fg} !important;
    font-family: ${s.ff} !important;
    font-size: ${s.fs}px !important;
    line-height: ${s.lh} !important;
    /* Top padding clears the floating header, and --lexi-top is what moves
       when you enter full screen. Animating the padding rather than resizing
       the WebView means the text slides up without the book re-laying out. */
    padding: var(--lexi-top, 64px) ${s.px}px 96px !important;
    text-align: left !important;
    transition: padding-top 380ms cubic-bezier(0.33, 0.01, 0.2, 1);
    -webkit-user-select: text;
    user-select: text;
  }
  /* Gutenberg wraps chapters in width-pinned containers; let them collapse. */
  body > div, body > section, .chapter, #pg-machine-header {
    width: auto !important;
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  p, div, li, td, th, blockquote, span {
    font-size: inherit !important;
    line-height: inherit !important;
    color: inherit !important;
    background: transparent !important;
  }
  p {
    margin: 0 0 1.05em !important;
    text-indent: 0 !important;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 {
    color: ${s.fg} !important;
    line-height: 1.3 !important;
    margin: 1.6em 0 .6em !important;
  }
  /* Poetry and plain-text blocks are <pre> on Gutenberg — the one tag that
     would still refuse to wrap once everything else does. */
  pre {
    white-space: pre-wrap !important;
    word-break: break-word !important;
    font-family: inherit !important;
    font-size: inherit !important;
  }
  img {
    display: block;
    height: auto !important;
    max-width: 100% !important;
    max-height: 78vh;
    margin: 1.2em auto !important;
    border-radius: 4px;
  }
  table { width: auto !important; max-width: 100% !important; border-collapse: collapse; }
  a { color: ${s.link} !important; text-decoration: none !important; }
  hr { border: 0; border-top: 1px solid ${s.faint}; margin: 1.6em 0; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }`;
}

function styleScript(s: ReaderStyle): string {
  return `(function(){
    var vp = document.querySelector('meta[name=viewport]');
    if (!vp) {
      vp = document.createElement('meta');
      vp.setAttribute('name','viewport');
      (document.head || document.documentElement).appendChild(vp);
    }
    vp.setAttribute('content','width=device-width, initial-scale=1');
    var el = document.getElementById('lexi-reflow');
    if (!el) {
      el = document.createElement('style');
      el.id = 'lexi-reflow';
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = ${JSON.stringify(readerCss(s))};
  })(); true;`;
}

function chromeScript(padTop: number): string {
  return `document.documentElement.style.setProperty('--lexi-top','${padTop}px'); true;`;
}

function bootScript(s: ReaderStyle, padTop: number): string {
  return `${styleScript(s)}
  ${chromeScript(padTop)}
  (function(){
    if (window.lexiBooted) return;
    window.lexiBooted = true;

    function post(o){
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(o));
      }
    }

    function pageOf(y){
      return Math.floor(y / Math.max(1, window.innerHeight)) + 1;
    }

    function pageCount(){
      var h = document.documentElement.scrollHeight || 0;
      return Math.max(1, Math.ceil(h / Math.max(1, window.innerHeight)));
    }

    /* Headings become the Contents list. Gutenberg marks chapters up as plain
       h1/h2/h3 with no ids, so we assign our own and report the page each one
       lands on — which is what the drawer jumps to. */
    window.lexiScan = function(){
      var nodes = document.querySelectorAll('h1, h2, h3, h4');
      var found = [];
      var minLevel = 9;
      for (var i = 0; i < nodes.length; i++){
        var text = (nodes[i].textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.length > 120) continue;
        var level = parseInt(nodes[i].tagName.slice(1), 10);
        if (level < minLevel) minLevel = level;
        found.push({ el: nodes[i], title: text, level: level });
      }
      var entries = [];
      for (var j = 0; j < found.length && j < 400; j++){
        var top = found[j].el.getBoundingClientRect().top + window.scrollY;
        entries.push({
          title: found[j].title,
          // the drawer indents one level; anything deeper reads as nesting soup
          level: Math.min(1, found[j].level - minLevel),
          page: pageOf(top)
        });
      }
      post({ type: 'outline', entries: entries, pageCount: pageCount() });
    };

    window.lexiGoToPage = function(n){
      window.scrollTo({ top: (n - 1) * window.innerHeight, behavior: 'auto' });
    };

    function apply(){ ${styleScript(s)} }
    function refresh(){ apply(); window.lexiScan(); }
    document.addEventListener('DOMContentLoaded', refresh);
    window.addEventListener('load', refresh);
    window.addEventListener('resize', function(){ window.lexiScan(); });

    var ticking = false;
    window.addEventListener('scroll', function(){
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        ticking = false;
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        post({ type: 'scroll', y: y, page: pageOf(y), pageCount: pageCount() });
      });
    }, { passive: true });

    /* Single tap toggles full-screen reading. A touch only counts as a tap if
       the finger barely moved and lifted quickly — otherwise every scroll
       flick would hide the header. Same slop/timing as the PDF reflow view. */
    var TAP_SLOP = 10, TAP_TIME = 250;
    var startX = 0, startY = 0, startT = 0, moved = true;

    document.addEventListener('touchstart', function(e){
      if (e.touches.length !== 1) { moved = true; return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      moved = false;
    }, { passive: true });

    document.addEventListener('touchmove', function(e){
      if (moved || !e.touches.length) return;
      if (Math.abs(e.touches[0].clientX - startX) > TAP_SLOP ||
          Math.abs(e.touches[0].clientY - startY) > TAP_SLOP) {
        moved = true;
      }
    }, { passive: true });

    document.addEventListener('touchend', function(e){
      if (moved) return;                            // was a scroll
      if (Date.now() - startT > TAP_TIME) return;   // was a long press
      try { if (window.getSelection().toString() !== '') return; } catch (err) {}
      // let footnote and chapter links do their own thing
      if (e.target && e.target.closest && e.target.closest('a')) return;
      post({ type: 'tap' });
    }, { passive: true });

    /* ---- selection ----
       Reported on settle rather than on every change: Android fires
       selectionchange for each handle movement, and the annotate bar shouldn't
       flicker while the handles are being dragged. */
    var selTimer = null, lastSel = '';
    document.addEventListener('selectionchange', function(){
      clearTimeout(selTimer);
      selTimer = setTimeout(function(){
        var sel = window.getSelection();
        var text = sel ? sel.toString().trim() : '';
        if (text === lastSel) return;
        lastSel = text;
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        post({ type: 'selection', text: text, page: pageOf(y) });
      }, 320);
    });

    window.lexiClearSelection = function(){
      try { window.getSelection().removeAllRanges(); } catch (e) {}
      lastSel = '';
      post({ type: 'selection', text: '', page: 0 });
    };

  })(); true;`;
}

const STANDALONE_URI = "lexi:standalone";

export default function BookReaderScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { cover, url, title } = useLocalSearchParams<{
    cover?: string;
    url: string;
    title?: string;
  }>();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [bodyH, setBodyH] = useState(0);
  const [progress] = useState(() => new Animated.Value(0.08));
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [outline, setOutline] = useState<PdfOutlineEntry[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sheetRef = useRef<BottomSheetModalReference>(null);
  const bright = useAppStore((s) => s.bright);
  const [immersive, setImmersive] = useState(false);
  const [headerH, setHeaderH] = useState(0);
  const padTop = immersive ? 12 : headerH + 8;
  const [selection, setSelection] = useState<{
    page: number;
    text: string;
  } | null>(null);
  const [composing, setComposing] = useState(false);

  const docUri = useMemo(
    () => (url ? bookDocUri({ coverUrl: cover, readUrl: url }) : ""),
    [cover, url],
  );

  const book = useCachedBook(url);

  const reload = () => {
    setRefreshing(true);
    setFailed(false);
    book.refresh();
    webRef.current?.reload();
  };

  const onStart = () => {
    setLoading(true);
    progress.setValue(0.08);
  };

  const onDone = () => {
    setLoading(false);
    setRefreshing(false);
  };

  const textSize = useAppStore((s) => s.textSize);
  const lineSp = useAppStore((s) => s.lineSp);
  const fontFam = useAppStore((s) => s.fontFam);
  const readWidth = useAppStore((s) => s.readWidth);
  const contrast = useAppStore((s) => s.contrast);

  const style: ReaderStyle = useMemo(
    () => ({
      bg: t.page,
      faint: t.faint,
      ff: fontStack(fontFam),
      fg: contrast === "soft" ? softInk(t.readerInk, t.page, 0.16) : t.readerInk,
      fs: textSize,
      lh: LINE_SPACING[lineSp] ?? 1.75,
      link: t.accentText,
      px: READ_WIDTH_PX[readWidth] ?? READ_WIDTH_PX.comfort,
    }),
    [
      contrast,
      fontFam,
      lineSp,
      readWidth,
      textSize,
      t.accentText,
      t.faint,
      t.page,
      t.readerInk,
    ],
  );

  useEffect(() => {
    webRef.current?.injectJavaScript(
      `${styleScript(style)} if (window.lexiScan) window.lexiScan(); true;`,
    );
  }, [style]);

  useEffect(() => {
    if (!docUri) return;
    useRecentsStore
      .getState()
      .recordOpen({ uri: docUri, name: title ?? "Book", ext: "BOOK" });
  }, [docUri, title]);

  useEffect(() => {
    if (!docUri) return;
    useRecentsStore
      .getState()
      .recordProgress(docUri, page, pageCount || undefined);
  }, [docUri, page, pageCount]);

  useEffect(() => {
    if (settingsOpen) sheetRef.current?.present();
  }, [settingsOpen]);

  useEffect(() => {
    webRef.current?.injectJavaScript(chromeScript(padTop));
  }, [padTop]);


  const [bar] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: immersive ? 0 : 1,
      duration: 380,
      easing: Easing.bezier(0.33, 0.01, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [bar, immersive]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync(immersive ? "hidden" : "visible");
    return () => {
      NavigationBar.setVisibilityAsync("visible");
    };
  }, [immersive]);

  const swipeUpFromBottom = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationY < -30) setSettingsOpen(true);
    });

  const goToPage = (target: number) => {
    webRef.current?.injectJavaScript(
      `if (window.lexiGoToPage) window.lexiGoToPage(${target}); true;`,
    );
    setPage(target);
  };

  return (
    <Box bg={t.page} flex={1}>
      <StatusBar animated hidden={immersive} style={t.dark ? "light" : "dark"} />

      <Animated.View
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
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
              {title ?? "Reading"}
            </Text>
            {pageCount > 0 ? (
              <Text color={t.sub} size={11}>
                {page} of {pageCount}
              </Text>
            ) : null}
          </Box>
          {url ? (
            <HeaderButton onPress={() => setSettingsOpen(true)}>
              <IconType color={t.ink} size={18} />
            </HeaderButton>
          ) : null}
        </Box>
      </Animated.View>

      {!url ? (
        <Box align="center" flex={1} justify="center">
          <Text color={t.sub} size={13}>
            No book selected.
          </Text>
        </Box>
      ) : (
        <Box
          flex={1}
          onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}
          style={{ overflow: "hidden" }}
        >
          <ScrollView
            refreshControl={
              <RefreshControl
                colors={["transparent"]}
                enabled={atTop}
                onRefresh={reload}
                progressBackgroundColor="transparent"
                refreshing={refreshing}
                tintColor="transparent"
              />
            }
            style={{ flex: 1 }}
          >
            {failed ? (
              <Box
                align="center"
                gap={8}
                justify="center"
                paddingX={32}
                style={{ height: bodyH || 300 }}
              >
                <Text align="center" size={15} weight="600">
                  Couldn&apos;t open this book
                </Text>
                <Text align="center" color={t.sub} lh={20} size={13}>
                  Pull down to try again, or check your connection.
                </Text>
              </Box>
            ) : bodyH > 0 ? (
              <WebView
                allowsBackForwardNavigationGestures
                androidLayerType="hardware"
                domStorageEnabled
                injectedJavaScript={styleScript(style)}
                injectedJavaScriptBeforeContentLoaded={bootScript(style, padTop)}
                javaScriptEnabled
                nestedScrollEnabled
                onError={() => {
                  setFailed(true);
                  onDone();
                }}
                onHttpError={onDone}
                onLoadEnd={onDone}
                onMessage={({ nativeEvent }) => {
                  try {
                    const msg = JSON.parse(nativeEvent.data);
                    if (msg.type === "tap") {
                      setImmersive((v) => !v);
                    } else if (msg.type === "selection") {
                      if (msg.text) setSelection({ page: msg.page, text: msg.text });
                      else if (!composing) setSelection(null);
                    } else if (msg.type === "scroll") {
                      setAtTop(msg.y <= 0);
                      setPage(msg.page);
                      setPageCount(msg.pageCount);
                    } else if (msg.type === "outline") {
                      setOutline(msg.entries);
                      setPageCount(msg.pageCount);
                    }
                  } catch {}
                }}
                onLoadProgress={({ nativeEvent }) => {
                  Animated.timing(progress, {
                    toValue: Math.max(0.08, nativeEvent.progress),
                    duration: 120,
                    useNativeDriver: false,
                  }).start();
                }}
                onLoadStart={onStart}
                originWhitelist={["*"]}
                ref={webRef}
                allowFileAccess
                source={{ uri: book.uri ?? url }}
                style={{ height: bodyH, backgroundColor: t.page }}
              />
            ) : null}
          </ScrollView>

          {loading ? (
            <Box
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: insets.bottom,
                height: 3,
              }}
            >
              <Animated.View
                style={{
                  height: 3,
                  backgroundColor: t.accent,
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                }}
              />
            </Box>
          ) : null}

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
        </Box>
      )}

      <ReaderSettingsSheet
        onClose={() => setSettingsOpen(false)}
        ref={sheetRef}
        showSmartZoom={false}
        showViewModes={false}
        viewMode="reflow"
      />

      {selection ? (
        <AnnotateBar
          onClose={() => {
            setComposing(false);
            setSelection(null);
            webRef.current?.injectJavaScript(
              "if (window.lexiClearSelection) window.lexiClearSelection(); true;",
            );
          }}
          onComposingChange={setComposing}
          page={selection.page}
          source={title ?? "Book"}
          text={selection.text}
          uri={STANDALONE_URI}
        />
      ) : null}

      {outline.length || outlineOpen ? (
        <PdfOutlineDrawer
          bookmarks={[]}
          entries={outline}
          handleVisible={!immersive}
          hintKey={STANDALONE_URI}
          onClose={() => setOutlineOpen(false)}
          onGoPage={(target) => {
            setOutlineOpen(false);
            goToPage(target);
          }}
          onOpen={() => setOutlineOpen(true)}
          open={outlineOpen}
          page={page}
          title={title ?? "Book"}
        />
      ) : null}
    </Box>
  );
}
