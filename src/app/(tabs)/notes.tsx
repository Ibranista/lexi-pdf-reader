import { router } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Card,
  Cover,
  HeaderButton,
  IconBack,
  IconCards,
  IconGraph,
  IconPencil,
  ProtoScreen,
  Text,
  Segmented,
  Tap,
} from "@/components/lexi-components";
import { BOOK_TITLE, chapterOf } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

type NotesTab = "bm" | "high" | "notes";

const TAB_ITEMS: { key: NotesTab; label: string }[] = [
  { key: "high", label: "Highlights" },
  { key: "notes", label: "Notes" },
  { key: "bm", label: "Bookmarks" },
];

export default function NotesScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const items = useAppStore((s) => s.items);
  const bookmarks = useAppStore((s) => s.bookmarks);
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const [tab, setTab] = useState<NotesTab>("high");

  const hlColor = (color: "amber" | "green") =>
    color === "green" ? "#8FD9BE" : t.dark ? "#8A6A4F" : "#EFC9A0";

  const jump = (p: number) => {
    setPage(p);
    router.back();
    showToast(`Jumped to page ${p}`);
  };

  const noteList = tab === "notes" ? items.filter((n) => !!n.note) : items;
  const bms = [...bookmarks].sort((a, b) => a - b);

  return (
    <ProtoScreen>
      <Box
        align="center"
        direction="row"
        gap={12}
        paddingLeft={20}
        paddingRight={20}
        paddingTop={8}
      >
        <HeaderButton onPress={() => router.back()}>
          <IconBack color={t.ink} size={18} />
        </HeaderButton>
        <Box>
          <Text serif size={20} weight="600">
            My Notes
          </Text>
          <Text color={t.sub} size={12}>
            {BOOK_TITLE}
          </Text>
        </Box>
        <Box flex={1} />
        <HeaderButton onPress={() => router.push("/review")}>
          <IconCards color={t.ink} size={18} />
        </HeaderButton>
        <HeaderButton onPress={() => router.push("/graph")}>
          <IconGraph color={t.ink} size={18} />
        </HeaderButton>
      </Box>

      <Box marginTop={14} paddingLeft={20} paddingRight={20}>
        <Segmented items={TAB_ITEMS} onChange={setTab} size={13} value={tab} />
      </Box>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 18,
          paddingBottom: 30 + insets.bottom,
          gap: 12,
        }}
        style={{ flex: 1 }}
      >
        {tab === "bm" ? (
          <>
            {bms.map((p) => {
              const current = p === page;
              const ch = chapterOf(p);
              return (
                <Tap key={p} onPress={() => jump(p)}>
                  <Box align="center" direction="row" gap={16}>
                    <Box align="end" width={44}>
                      <Text
                        color={current ? t.accentText : t.faint}
                        mono
                        size={12}
                        weight="600"
                      >
                        p. {p}
                      </Text>
                    </Box>
                    <Box
                      bg={current ? t.accent : t.faint}
                      height={8}
                      rounded={4}
                      style={
                        current
                          ? {
                              shadowColor: t.accent,
                              shadowOpacity: 0.4,
                              shadowRadius: 4,
                              elevation: 2,
                            }
                          : undefined
                      }
                      width={8}
                    />
                    <Box flex={1}>
                      <Box
                        align="center"
                        bg={t.card}
                        borderColor={current ? t.accentMid : t.line}
                        borderWidth={1}
                        direction="row"
                        gap={12}
                        padding={12}
                        rounded={14}
                      >
                        <Cover height={52} label="page" width={40} />
                        <Box flex={1}>
                          <Text size={13.5} weight="600">
                            Ch. {ch.n} · {ch.t}
                          </Text>
                          <Text
                            color={current ? t.accentText : t.sub}
                            size={11.5}
                            style={{ marginTop: 3 }}
                          >
                            {current
                              ? "Current page"
                              : `${Math.abs(p - page)} pages ${p < page ? "back" : "ahead"}`}
                          </Text>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Tap>
              );
            })}
            {bms.length === 0 ? (
              <Box paddingX={20} paddingY={40}>
                <Text align="center" color={t.sub} size={13}>
                  No bookmarks yet — tap the bookmark icon while reading.
                </Text>
              </Box>
            ) : null}
          </>
        ) : (
          noteList.map((n, i) => (
            <Tap key={`${n.p}-${i}`} onPress={() => jump(n.p)} scale={0.985}>
              <Card gap={10}>
                <Box align="center" direction="row" justify="between">
                  <Text color={t.faint} mono size={11} weight="600">
                    PAGE {n.p} · CH. {n.ch}
                  </Text>
                  <Text color={t.faint} size={11}>
                    {n.when}
                  </Text>
                </Box>
                <Box
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: hlColor(n.color),
                    paddingLeft: 12,
                  }}
                >
                  <Text lh={22} serif size={14}>
                    {n.text}
                  </Text>
                </Box>
                {n.note ? (
                  <Box
                    bg={t.chip}
                    direction="row"
                    gap={8}
                    paddingX={12}
                    paddingY={10}
                    rounded={10}
                  >
                    <Box paddingTop={2}>
                      <IconPencil color={t.accentText} size={13} />
                    </Box>
                    <Box flex={1}>
                      <Text color={t.sub} lh={19} size={12.5}>
                        {n.note}
                      </Text>
                    </Box>
                  </Box>
                ) : null}
              </Card>
            </Tap>
          ))
        )}
      </ScrollView>
    </ProtoScreen>
  );
}
