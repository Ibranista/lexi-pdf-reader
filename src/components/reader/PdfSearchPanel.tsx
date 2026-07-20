import { useState } from "react";
import { Keyboard, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  Backdrop,
  IconSearch,
  IconSpark,
  Text,
  Tap,
} from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

import type { PdfSearchResult } from "./PdfReflowView";

export function PdfSearchPanel({
  indexed,
  onClose,
  onGoPage,
  onSearch,
  results,
}: {
  indexed: boolean;
  onClose: () => void;
  onGoPage: (page: number, index: number) => void;
  onSearch: (query: string) => void;
  results: PdfSearchResult[];
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const handleChangeText = (text: string) => {
    setQuery(text);
    onSearch(text.trim());
  };

  const pages = new Set(results.map((r) => r.page));

  const handleGoPage = (page: number, index: number) => {
    Keyboard.dismiss();
    onGoPage(page, index);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <>
      <Backdrop onPress={handleClose} opacity={0.32} />
      <Box
        bg={t.card}
        roundedBottomLeft={20}
        roundedTopLeft={20}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 326,
          zIndex: 39,
          shadowColor: "#14100C",
          shadowOffset: { width: -12, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 40,
          elevation: 24,
        }}
      >
        <Box
          align="center"
          direction="row"
          gap={10}
          paddingBottom={12}
          paddingX={18}
          style={{ paddingTop: insets.top + 12 }}
        >
          <Box
            align="center"
            bg={t.chip}
            direction="row"
            flex={1}
            gap={9}
            paddingX={14}
            rounded={12}
          >
            <IconSearch color={t.sub} size={16} />
            <TextInput
              autoFocus
              backgroundColor="transparent"
              borderColor="transparent"
              borderWidth={0}
              fontSize={14}
              onChangeText={handleChangeText}
              placeholder="Search in document"
              placeholderTextColor={t.faint}
              pl={0}
              py={11}
              rounded={0}
              style={{ flex: 1, height: undefined }}
              textColor={t.ink}
              value={query}
            />
          </Box>
          <Tap onPress={handleClose}>
            <Text color={t.accentText} size={14} weight="500">
              Cancel
            </Text>
          </Tap>
        </Box>

        <Box paddingBottom={8} paddingX={18}>
          <Text color={t.sub} size={12} weight="500">
            {results.length
              ? `${results.length} match${results.length === 1 ? "" : "es"} · ${pages.size} page${pages.size === 1 ? "" : "s"}${indexed ? "" : " so far"}`
              : query.trim()
                ? indexed
                  ? "No matches in this document"
                  : "Still reading the document…"
                : "Type to search this document"}
          </Text>
        </Box>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4 }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
        >
          {results.map((r, i) => (
            <Tap key={`${r.page}-${i}`} onPress={() => handleGoPage(r.page, i)}>
              <Box
                bg={i === 0 ? t.accentSoft : "transparent"}
                borderColor={i === 0 ? t.accentMid : "transparent"}
                borderWidth={1}
                marginBottom={6}
                padding={12}
                rounded={12}
              >
                <Text
                  color={i === 0 ? t.accentText : t.faint}
                  mono
                  size={11}
                  weight="600"
                >
                  PAGE {r.page}
                </Text>
                <Text lh={21} serif size={13} style={{ marginTop: 5 }}>
                  …{r.before}
                  <Text
                    lh={21}
                    serif
                    size={13}
                    style={{ backgroundColor: t.hl }}
                  >
                    {r.match}
                  </Text>
                  {r.after}…
                </Text>
              </Box>
            </Tap>
          ))}
        </ScrollView>

        <Tap onPress={() => {}}>
          <Box
            align="center"
            direction="row"
            gap={8}
            paddingTop={14}
            paddingX={20}
            style={{
              paddingBottom: 28 + insets.bottom,
              borderTopWidth: 1,
              borderTopColor: t.line,
            }}
          >
            <IconSpark color={t.accent} size={15} />
            <Text size={13} weight="500">
              {query.trim()
                ? `Ask AI about "${query.trim()}"`
                : "Ask AI about this document"}
            </Text>
          </Box>
        </Tap>
      </Box>
    </>
  );
}
