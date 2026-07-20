/**
 * Contents drawer for real PDF documents — the left-hand counterpart to the
 * search panel on the right.
 *
 * Entries come from the document itself (embedded outline, or one parsed off
 * a printed contents page), so this renders nothing unless the PDF actually
 * has an outline.
 */
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Backdrop,
  IconBookmark,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

import type { PdfOutlineEntry } from "./PdfReflowView";

export function PdfOutlineDrawer({
  entries,
  onClose,
  onGoPage,
  page,
  title,
}: {
  entries: PdfOutlineEntry[];
  onClose: () => void;
  onGoPage: (page: number) => void;
  page: number;
  title: string;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const bookmarks = useAppStore((s) => s.bookmarks);

  // the entry the reader is inside: the last one starting at or before here
  let currentIdx = -1;
  entries.forEach((e, i) => {
    if (e.page <= page) currentIdx = i;
  });

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
          <Text numberOfLines={2} serif size={18} style={{ marginTop: 6 }} weight="600">
            {title}
          </Text>
        </Box>

        <ScrollView
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          style={{ flex: 1 }}
        >
          {entries.map((e, i) => {
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
                    // nested entries sit in from their parent
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
          <Text color={t.sub} size={12}>
            {bookmarks.length} bookmark{bookmarks.length === 1 ? "" : "s"} in
            this document
          </Text>
        </Box>
      </Box>
    </>
  );
}
