import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { Animated, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box, Text } from "@/components/atoms";
import { HeaderButton, IconBack, IconSync } from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

export default function BookReaderScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bodyH, setBodyH] = useState(0);
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
