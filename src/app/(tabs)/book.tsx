import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Animated, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box, Text } from "@/components/atoms";
import { HeaderButton, IconBack, IconSync } from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

/**
 * Full-book web reader. Opens the readable HTML page for a suggested book (see
 * use-book-suggestions) inside the app, so a public-domain classic reads like
 * any other document rather than kicking out to the system browser.
 *
 * Pull down from the top to reload. The WebView is sized to the viewport and
 * scrolls internally (nestedScrollEnabled) while the surrounding ScrollView
 * owns the RefreshControl — the cross-platform way to get pull-to-refresh,
 * since react-native-webview's own pullToRefreshEnabled is iOS-only.
 */
export default function BookReaderScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  // Height available for the WebView (viewport minus the header), so it can be
  // a fixed-height child of the ScrollView that hosts the RefreshControl.
  const [bodyH, setBodyH] = useState(0);
  // Load progress for the bottom filler bar. Starts at a visible sliver so
  // there's immediate feedback, then tracks the WebView's real progress.
  const [progress] = useState(() => new Animated.Value(0.08));

  const reload = () => {
    setRefreshing(true);
    setFailed(false);
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

  return (
    <Box bg={t.page} flex={1}>
      <StatusBar animated style={t.dark ? "light" : "dark"} />

      {/* Header — mirrors the PDF reader's back-button + title bar. */}
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
        <Text numberOfLines={1} serif size={16} style={{ flex: 1 }} weight="600">
          {title ?? "Reading"}
        </Text>
        {url ? (
          <HeaderButton onPress={reload}>
            <IconSync color={t.ink} size={18} />
          </HeaderButton>
        ) : null}
      </Box>

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
                colors={[t.accent]}
                onRefresh={reload}
                progressBackgroundColor={t.card}
                refreshing={refreshing}
                tintColor={t.sub}
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
                javaScriptEnabled
                nestedScrollEnabled
                onError={() => {
                  setFailed(true);
                  onDone();
                }}
                onHttpError={onDone}
                onLoadEnd={onDone}
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
                source={{ uri: url }}
                style={{ height: bodyH, backgroundColor: t.page }}
              />
            ) : null}
          </ScrollView>

          {/* Filler progress bar pinned to the very bottom edge — fills as the
              page loads, then disappears, so nothing overlaps the reading. */}
          {loading ? (
            <Box
              pointerEvents="none"
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3 }}
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
        </Box>
      )}
    </Box>
  );
}
