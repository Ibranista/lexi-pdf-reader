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
import { HeaderButton, IconBack, Tap } from "@/components/lexi-components";
import type { BottomSheetModalReference } from "@/components/modals/BottomSheetModal/BottomSheetModal";
import { PdfReflowView } from "@/components/reader/PdfReflowView";
import { ReaderSettingsSheet } from "@/components/reader/ReaderSettingsSheet";
import { useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

type ViewMode = "page" | "reflow";

export default function PdfViewerScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { uri, name } = useLocalSearchParams<{ uri: string; name?: string }>();
  const zoom = useAppStore((s) => s.zoom);

  const [mode, setMode] = useState<ViewMode>("page");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);

  // Page view opens at whatever page reflow left off on, and vice versa.
  const [pdfPage, setPdfPage] = useState(1);
  const [reflowGoto, setReflowGoto] = useState({ page: 1, seq: 0 });
  // Reflow is mounted on first use and then kept alive, so toggling back
  // doesn't re-extract the document or lose the scroll position.
  const [reflowMounted, setReflowMounted] = useState(false);

  // The toolbar floats above the document and fades/slides, rather than
  // unmounting — unmounting resized the content and forced the PDF and
  // WebView to re-layout on every toggle, which felt stuck.
  const [bar] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: immersive ? 0 : 1,
      // slightly longer hide with a gentle ease reads as a glide instead of
      // a blink; the reveal is a touch quicker so the UI feels responsive
      duration: immersive ? 320 : 240,
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

  const switchTo = (next: ViewMode) => {
    if (next === mode) return;
    if (next === "page") {
      setPdfPage(page);
    } else {
      setReflowMounted(true);
      setReflowGoto((g) => ({ page, seq: g.seq + 1 }));
    }
    setMode(next);
  };

  // Smart Zoom (100–200%) caps how far the page view zooms.
  const smartScale = Math.max(1.25, zoom / 100);

  // Measured toolbar height. The page view is pushed down by exactly this
  // much via a native-driver transform (never a layout change, which is what
  // made toggling feel stuck), so the toolbar never covers the document.
  const [barH, setBarH] = useState(insets.top + 56);
  const pageShift = bar.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barH],
  });

  // Settings sheet: opened by the grabber, or by swiping up from the very
  // bottom edge (which works in distraction-free mode too, where the
  // grabber is hidden). Closing is gorhom's — drag down or tap the backdrop.
  const sheetRef = useRef<BottomSheetModalReference>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);

  // present via an effect — the ref must not be read during render
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

      {/* Document surfaces fill the screen and never resize. Both stay
          mounted; the inactive one is hidden. */}
      <Box flex={1}>
        <Animated.View
          style={[
            mode === "page"
              ? { flex: 1 }
              : ({ display: "none" } as const),
            // shift down so the toolbar sits above the page, not on it;
            // the extra height keeps the bottom from being clipped
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
              onLoadComplete={(numberOfPages) => setPageCount(numberOfPages)}
              onPageChanged={(p) => setPage(p)}
              onPageSingleTap={() => setImmersive((v) => !v)}
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
        </Animated.View>

        {reflowMounted ? (
          <Box
            flex={mode === "reflow" ? 1 : undefined}
            style={mode === "reflow" ? undefined : { display: "none" }}
          >
            {/* reflow keeps its own top padding inside the page, so text
                clears the toolbar without resizing the WebView */}
            <PdfReflowView
              chromeOffset={immersive ? 0 : barH}
              gotoPage={reflowGoto}
              initialPage={reflowGoto.page}
              key={uri}
              onPageChange={setPage}
              onSingleTap={() => setImmersive((v) => !v)}
              topInset={insets.top}
              uri={uri}
            />
          </Box>
        ) : null}
      </Box>

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
          bg={t.bg}
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
            {mode === "page" && pageCount > 0 ? (
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Page {page} of {pageCount}
              </Text>
            ) : mode === "reflow" ? (
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Reflow · double-tap to zoom to {zoom}%
              </Text>
            ) : null}
          </Box>

          {/* Page ⇄ Reflow toggle */}
          <Box bg={t.chip} direction="row" gap={2} padding={3} rounded={10}>
            {(["page", "reflow"] as const).map((m) => (
              <Tap key={m} onPress={() => switchTo(m)} scale={0.95}>
                <Box
                  bg={mode === m ? t.accent : "transparent"}
                  paddingX={11}
                  paddingY={6}
                  rounded={8}
                >
                  <Text
                    color={mode === m ? t.onAccent : t.sub}
                    size={12}
                    weight="600"
                  >
                    {m === "page" ? "Page" : "Reflow"}
                  </Text>
                </Box>
              </Tap>
            ))}
          </Box>
        </Box>
      </Animated.View>

      {/* Grabber — visible with the chrome, fades out in reading mode.
          It rides the same animation value as the toolbar. */}
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
        <Tap onPress={openSettings} scale={0.9}>
          <Box paddingX={22} paddingY={10}>
            <Box bg={t.faint} height={5} rounded={3} width={44} />
          </Box>
        </Tap>
      </Animated.View>

      {/* Always-on swipe-up catcher at the very bottom edge — works in
          distraction-free mode too, where the grabber is hidden. */}
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
        focusMode={immersive}
        onClose={() => setSettingsOpen(false)}
        onToggleFocusMode={() => setImmersive((v) => !v)}
        ref={sheetRef}
      />
    </Box>
  );
}
