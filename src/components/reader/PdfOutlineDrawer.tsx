import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Backdrop,
  IconBookmark,
  SectionLabel,
  Segmented,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

import type { PdfOutlineEntry } from "./PdfReflowView";

type DrawerTab = "bookmarks" | "contents";

export function PdfOutlineDrawer({
  bookmarks,
  entries,
  onClose,
  onGoPage,
  onRemoveBookmark,
  page,
  title,
}: {
  bookmarks: number[];
  entries: PdfOutlineEntry[];
  onClose: () => void;
  onGoPage: (page: number) => void;
  onRemoveBookmark?: (page: number) => void;
  page: number;
  title: string;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<DrawerTab>("contents");
  const tabbed = entries.length > 0 && bookmarks.length > 0;
  const active: DrawerTab = tabbed
    ? tab
    : entries.length
      ? "contents"
      : "bookmarks";

  let currentIdx = -1;
  entries.forEach((e, i) => {
    if (e.page <= page) currentIdx = i;
  });

  const sectionOf = (target: number) => {
    let found: PdfOutlineEntry | null = null;
    for (const e of entries) {
      if (e.page > target) break;
      found = e;
    }
    return found?.title;
  };

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
          <SectionLabel>
            {tabbed ? "Jump to" : entries.length ? "Contents" : "Bookmarks"}
          </SectionLabel>
          <Text
            numberOfLines={2}
            serif
            size={18}
            style={{ marginTop: 6 }}
            weight="600"
          >
            {title}
          </Text>
          {tabbed ? (
            <Box marginTop={13}>
              <Segmented
                items={[
                  { key: "contents" as const, label: "Contents" },
                  {
                    key: "bookmarks" as const,
                    label: `Bookmarks · ${bookmarks.length}`,
                    flex: 1.3,
                  },
                ]}
                onChange={setTab}
                size={11.5}
                value={active}
              />
            </Box>
          ) : null}
        </Box>

        <ScrollView
          contentContainerStyle={{
            padding: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 28,
          }}
          style={{ flex: 1 }}
        >
          {active === "contents"
            ? entries.map((e, i) => {
                const on = i === currentIdx;
                return (
                  <Tap key={`${e.page}-${i}`} onPress={() => onGoPage(e.page)}>
                    <Box
                      align="center"
                      bg={on ? t.accentSoft : "transparent"}
                      direction="row"
                      gap={10}
                      paddingY={13}
                      rounded={12}
                      style={{
                        paddingLeft: 12 + e.level * 14,
                        paddingRight: 12,
                      }}
                    >
                      <Box flex={1}>
                        <Text
                          color={on ? t.accentText : e.level ? t.sub : t.ink}
                          numberOfLines={2}
                          size={e.level ? 13 : 14}
                          weight={on ? "600" : "500"}
                        >
                          {e.title}
                        </Text>
                      </Box>
                      <Text
                        color={on ? t.accentText : t.faint}
                        mono
                        size={12}
                        weight="500"
                      >
                        {e.page}
                      </Text>
                    </Box>
                  </Tap>
                );
              })
            : bookmarks.map((bp) => {
                const on = bp === page;
                const where = sectionOf(bp);
                return (
                  <Tap key={`bm-${bp}`} onPress={() => onGoPage(bp)}>
                    <Box
                      align="center"
                      bg={on ? t.accentSoft : "transparent"}
                      direction="row"
                      gap={10}
                      paddingX={12}
                      paddingY={12}
                      rounded={12}
                    >
                      <IconBookmark
                        color={on ? t.accentText : t.accent}
                        fill={on ? t.accentText : t.accent}
                        size={14}
                      />
                      <Box flex={1}>
                        <Text
                          color={on ? t.accentText : t.ink}
                          size={14}
                          weight={on ? "600" : "500"}
                        >
                          Page {bp}
                        </Text>
                        {where ? (
                          <Text
                            color={on ? t.accentText : t.faint}
                            numberOfLines={1}
                            size={11.5}
                            style={{ marginTop: 2 }}
                          >
                            {where}
                          </Text>
                        ) : null}
                      </Box>
                      {onRemoveBookmark ? (
                        <Tap
                          onPress={() => onRemoveBookmark(bp)}
                          scale={0.86}
                          style={{ padding: 6 }}
                        >
                          <Text color={t.faint} size={15}>
                            ✕
                          </Text>
                        </Tap>
                      ) : null}
                    </Box>
                  </Tap>
                );
              })}

          {!entries.length && !bookmarks.length ? (
            <Box align="center" gap={8} paddingX={20} paddingY={40}>
              <IconBookmark color={t.faint} size={22} />
              <Text align="center" color={t.sub} lh={19} size={13}>
                No contents or bookmarks yet. Tap the bookmark icon while
                reading to mark a page.
              </Text>
            </Box>
          ) : null}
        </ScrollView>
      </Box>
    </>
  );
}
