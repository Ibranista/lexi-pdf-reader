import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, Text } from "@/components/atoms";
import { HeaderButton, IconBack } from "@/components/lexi-components";
import { useRecentsStore } from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";

const PROGRESS_STEPS = 100;

/**
 * A lightweight reader for documents that already contain plain UTF-8 text.
 * Unlike PDFs, no renderer or network-backed extraction is required.
 */
export default function TextViewerScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { uri, name, ext = "TXT" } = useLocalSearchParams<{
    uri: string;
    name?: string;
    ext?: string;
  }>();
  const scrollRef = useRef<ScrollView>(null);
  const [contents, setContents] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const savedProgress = useRecentsStore
    .getState()
    .recents.find((doc) => doc.uri === uri)?.page;

  useEffect(() => {
    if (!uri) return;
    let active = true;
    new File(uri)
      .text()
      .then((text) => {
        if (!active) return;
        setError(null);
        setContents(text.replace(/^\uFEFF/, ""));
      })
      .catch(() => {
        if (active) setError("This text file couldn't be read.");
      });
    return () => {
      active = false;
    };
  }, [uri]);

  useEffect(() => {
    if (!uri) return;
    useRecentsStore
      .getState()
      .recordOpen({ uri, name: name ?? "Text document", ext });
  }, [uri, name, ext]);

  useEffect(() => {
    if (!contentHeight || !viewportHeight || !savedProgress) return;
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: maxOffset * ((savedProgress - 1) / (PROGRESS_STEPS - 1)),
        animated: false,
      });
    });
  }, [contentHeight, viewportHeight, savedProgress]);

  const recordProgress = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!uri) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const maxOffset = contentSize.height - layoutMeasurement.height;
      const ratio = maxOffset > 0 ? contentOffset.y / maxOffset : 0;
      const position = Math.max(
        1,
        Math.min(PROGRESS_STEPS, Math.round(ratio * (PROGRESS_STEPS - 1)) + 1),
      );
      useRecentsStore
        .getState()
        .recordProgress(uri, position, PROGRESS_STEPS);
    },
    [uri],
  );

  if (!uri) {
    return (
      <Box align="center" bg={t.page} flex={1} justify="center">
        <Text color={t.sub} size={13}>No document selected.</Text>
      </Box>
    );
  }

  return (
    <Box bg={t.page} flex={1} style={{ paddingTop: insets.top }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Box align="center" direction="row" gap={12} padding={16}>
        <HeaderButton onPress={() => router.back()}>
          <IconBack color={t.ink} size={18} />
        </HeaderButton>
        <Box flex={1}>
          <Text numberOfLines={1} serif size={18} weight="600">
            {name ?? "Text document"}
          </Text>
          <Text color={t.sub} size={11} upper weight="600">
            {ext} document
          </Text>
        </Box>
      </Box>

      {contents === null && !error ? (
        <Box align="center" flex={1} gap={12} justify="center">
          <ActivityIndicator color={t.accent} size="large" />
          <Text color={t.sub} size={13}>Opening text document…</Text>
        </Box>
      ) : error ? (
        <Box align="center" flex={1} gap={8} justify="center" paddingX={32}>
          <Text align="center" size={15} weight="600">Couldn&apos;t open this document</Text>
          <Text align="center" color={t.sub} lh={20} size={13}>{error}</Text>
        </Box>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 40 }}
          onContentSizeChange={(_width, height) => setContentHeight(height)}
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
          onMomentumScrollEnd={recordProgress}
          onScrollEndDrag={recordProgress}
          ref={scrollRef}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <Text color={t.readerInk} lh={29} serif size={18} selectable>
            {contents}
          </Text>
        </ScrollView>
      )}
    </Box>
  );
}
