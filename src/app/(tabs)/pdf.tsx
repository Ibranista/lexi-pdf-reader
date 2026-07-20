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

  const [pdfPage, setPdfPage] = useState(1);
  const [reflowGoto, setReflowGoto] = useState({ page: 1, seq: 0 });
  const [reflowMounted, setReflowMounted] = useState(false);

  const [bar] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.timing(bar, {
      toValue: immersive ? 0 : 1,
      duration: immersive ? 320 : 240,
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

  const smartScale = Math.max(1.25, zoom / 100);

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
            mode === "page"
              ? { flex: 1 }
              : ({ display: "none" } as const),
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
