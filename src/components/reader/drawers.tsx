import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  Backdrop,
  IconBookmark,
  IconSearch,
  IconSpark,
  PText,
  SectionLabel,
  Tap,
} from "@/components/lexi-components";
import { BOOK_TITLE, chapterOf, CHAPTERS, CORPUS } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export function TocDrawer({
  onClose,
  onGoPage,
}: {
  onClose: () => void;
  onGoPage: (page: number) => void;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const page = useAppStore((s) => s.page);
  const bookmarks = useAppStore((s) => s.bookmarks);
  const current = chapterOf(page);

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.32} />
      <Box
        bg={t.card}
        roundedBottomRight={20}
        roundedTopRight={20}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 302,
          zIndex: 39,
          shadowColor: "#14100C",
          shadowOffset: { width: 12, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 40,
          elevation: 24,
        }}
      >
        <Box
          paddingBottom={16}
          paddingX={24}
          style={{
            paddingTop: insets.top + 14,
            borderBottomWidth: 1,
            borderBottomColor: t.line,
          }}
        >
          <SectionLabel>Contents</SectionLabel>
          <PText serif size={18} style={{ marginTop: 6 }} weight="600">
            {BOOK_TITLE}
          </PText>
        </Box>

        <ScrollView
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          style={{ flex: 1 }}
        >
          {CHAPTERS.map((c) => {
            const on = c.n === current.n;
            return (
              <Tap key={c.n} onPress={() => onGoPage(c.p)}>
                <Box
                  align="center"
                  bg={on ? t.accentSoft : "transparent"}
                  direction="row"
                  gap={10}
                  paddingX={12}
                  paddingY={13}
                  rounded={12}
                >
                  <Box flex={1}>
                    <PText
                      color={on ? t.accentText : t.ink}
                      size={14}
                      weight={on ? "600" : "500"}
                    >
                      {c.n} · {c.t}
                    </PText>
                  </Box>
                  <PText
                    color={on ? t.accentText : t.faint}
                    mono
                    size={12}
                    weight="500"
                  >
                    {c.p}
                  </PText>
                </Box>
              </Tap>
            );
          })}
        </ScrollView>

        <Box
          align="center"
          direction="row"
          gap={8}
          paddingTop={16}
          paddingX={24}
          style={{
            paddingBottom: 26 + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: t.line,
          }}
        >
          <IconBookmark color={t.sub} size={14} />
          <PText color={t.sub} size={12}>
            {bookmarks.length} bookmarks in this document
          </PText>
        </Box>
      </Box>
    </>
  );
}

export function SearchPanel({
  onClose,
  onGoPage,
}: {
  onClose: () => void;
  onGoPage: (page: number) => void;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const [query, setQuery] = useState("electric");

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return CORPUS.filter((c) => c.txt.toLowerCase().includes(q)).map((c) => {
      const idx = c.txt.toLowerCase().indexOf(q);
      return {
        p: c.p,
        before: c.txt.slice(Math.max(0, idx - 34), idx),
        match: c.txt.slice(idx, idx + q.length),
        after: c.txt.slice(idx + q.length, idx + q.length + 44),
      };
    });
  }, [q]);

  const pages = new Set(results.map((r) => r.p));

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.32} />
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
              onChangeText={setQuery}
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
          <Tap onPress={onClose}>
            <PText color={t.accentText} size={14} weight="500">
              Cancel
            </PText>
          </Tap>
        </Box>

        <Box paddingBottom={8} paddingX={18}>
          <PText color={t.sub} size={12} weight="500">
            {results.length
              ? `${results.length} matches · ${pages.size} pages`
              : "Type to search this document"}
          </PText>
        </Box>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4 }}
          style={{ flex: 1 }}
        >
          {results.map((r, i) => (
            <Tap
              key={`${r.p}-${i}`}
              onPress={() => {
                onGoPage(r.p);
                showToast(`Jumped to page ${r.p}`);
              }}
            >
              <Box
                bg={i === 0 ? t.accentSoft : "transparent"}
                borderColor={i === 0 ? t.accentMid : "transparent"}
                borderWidth={1}
                marginBottom={6}
                padding={12}
                rounded={12}
              >
                <PText
                  color={i === 0 ? t.accentText : t.faint}
                  mono
                  size={11}
                  weight="600"
                >
                  PAGE {r.p}
                </PText>
                <PText lh={21} serif size={13} style={{ marginTop: 5 }}>
                  …{r.before}
                  <PText
                    lh={21}
                    serif
                    size={13}
                    style={{ backgroundColor: t.hl }}
                  >
                    {r.match}
                  </PText>
                  {r.after}…
                </PText>
              </Box>
            </Tap>
          ))}
          {q.length > 0 && results.length === 0 ? (
            <Box paddingX={12} paddingY={32}>
              <PText align="center" color={t.sub} size={13}>
                No matches for “{query}”
              </PText>
            </Box>
          ) : null}
        </ScrollView>

        <Tap onPress={() => showToast("AI Q&A — coming in v2")}>
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
            <PText size={13} weight="500">
              Ask AI about “{query}”
            </PText>
          </Box>
        </Tap>
      </Box>
    </>
  );
}
