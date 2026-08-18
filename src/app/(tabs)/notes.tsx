/**
 * My Notes — highlights, notes and bookmarks for one document.
 *
 * Reached from the reader's pencil button, which passes the document it's
 * showing. Highlights and notes are two views of the same annotation list (a
 * note is a highlight with something written on it); bookmarks come from the
 * document's own entry in recents. Tapping any row sends the reader back to
 * that page via the jump store.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  Card,
  HeaderButton,
  IconBack,
  IconBookmark,
  IconCards,
  IconClose,
  IconGraph,
  IconHighlighter,
  IconPencil,
  ProtoScreen,
  Segmented,
  Tap,
  Text,
} from "@/components/lexi-components";
import { CenterModal } from "@/components/modals";
import {
  HIGHLIGHT_FILL,
  useAnnotationsStore,
} from "@/stores/annotations-store";
import { useReaderJumpStore, useToastStore } from "@/stores/app-store";
import { useRecentsStore } from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";

type NotesTab = "bm" | "high" | "notes";

const TAB_ITEMS: { key: NotesTab; label: string }[] = [
  { key: "high", label: "Highlights" },
  { key: "notes", label: "Notes" },
  { key: "bm", label: "Bookmarks" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lines shown on a card before it's cut off behind "See more". */
const PASSAGE_LINES = 4;
const NOTE_LINES = 3;

/** "Today" / "Yesterday" / a date — matches the prototype's `when` line. */
function whenLabel(ms: number): string {
  const days = Math.floor((Date.now() - ms) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function NotesScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const { focus, name, uri } = useLocalSearchParams<{
    focus?: string;
    name?: string;
    uri?: string;
  }>();
  const [tab, setTab] = useState<NotesTab>("high");
  // The entry opened in full; null when nothing is expanded.
  const [expanded, setExpanded] = useState<string | null>(null);
  // The note being edited, and its working copy.
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  /**
   * Ids whose text didn't fit. Measured rather than estimated from character
   * counts — the first version guessed at ~42 chars a line and was wrong
   * often enough that "See more" simply never appeared.
   */
  const [clipped, setClipped] = useState<Record<string, boolean>>({});

  const all = useAnnotationsStore((s) => s.items);
  const remove = useAnnotationsStore((s) => s.remove);
  const setNote = useAnnotationsStore((s) => s.setNote);
  const requestJump = useReaderJumpStore((s) => s.request);

  const doc = useRecentsStore((s) => s.recents.find((r) => r.uri === uri));
  const bookmarks = useMemo(() => doc?.bookmarks ?? [], [doc?.bookmarks]);
  const page = doc?.page ?? 1;

  // Ordered by page rather than by when they were made, so the list reads
  // like the document instead of like an activity log.
  const annotations = useMemo(
    () => all.filter((a) => a.uri === uri).sort((a, b) => a.page - b.page),
    [all, uri],
  );
  const noteList =
    tab === "notes" ? annotations.filter((a) => a.note.trim()) : annotations;

  const jump = (p: number, flash?: string) => {
    // `flash` briefly lights the passage up in the reader on arrival.
    if (uri) requestJump(uri, p, flash);
    router.back();
    showToast(`Jumped to page ${p}`);
  };

  /**
   * Flags an id as clipped when fewer characters were laid out than the
   * source holds — which is exactly what truncation means, on either
   * platform, without a second off-screen copy to measure against.
   */
  const noteLayout =
    (id: string, source: string) =>
    (event: { nativeEvent: { lines: { text: string }[] } }) => {
      const shown = event.nativeEvent.lines
        .map((l) => l.text)
        .join("")
        .replaceAll(/\s/gu, "").length;
      if (shown >= source.replaceAll(/\s/gu, "").length) return;
      setClipped((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    };

  const openEntry = annotations.find((a) => a.id === expanded) ?? null;

  const empty = (message: string) => (
    <Box align="center" gap={10} paddingX={24} paddingY={48}>
      {tab === "bm" ? (
        <IconBookmark color={t.faint} size={24} />
      ) : (
        <IconHighlighter color={t.faint} size={24} />
      )}
      <Text align="center" color={t.sub} lh={20} size={13}>
        {message}
      </Text>
    </Box>
  );

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
        <Box flex={1}>
          <Text serif size={20} weight="600">
            Notes
          </Text>
          <Text color={t.sub} numberOfLines={1} size={12}>
            {name ?? "This document"}
          </Text>
        </Box>
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
            {bookmarks.map((p) => {
              const current = p === page;
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
                        padding={14}
                        rounded={14}
                      >
                        <IconBookmark
                          color={t.accent}
                          fill={t.accent}
                          size={15}
                        />
                        <Box flex={1}>
                          <Text size={13.5} weight="600">
                            Page {p}
                          </Text>
                          <Text
                            color={current ? t.accentText : t.sub}
                            size={11.5}
                            style={{ marginTop: 3 }}
                          >
                            {current
                              ? "Where you left off"
                              : `${Math.abs(p - page)} pages ${p < page ? "back" : "ahead"}`}
                          </Text>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Tap>
              );
            })}
            {bookmarks.length === 0
              ? empty("No bookmarks yet — tap the bookmark icon while reading.")
              : null}
          </>
        ) : (
          <>
            {noteList.map((a) => (
              <Tap
                key={a.id}
                onPress={() => jump(a.page, a.text)}
                scale={0.985}
              >
                {/* The one you tapped in the text is ringed, so arriving here
                    from a highlight doesn't mean hunting for it in the list. */}
                <Card
                  gap={10}
                  style={
                    a.id === focus
                      ? { borderColor: t.accent, borderWidth: 1.5 }
                      : undefined
                  }
                >
                  <Box align="center" direction="row" justify="between">
                    <Text color={t.faint} mono size={11} weight="600">
                      PAGE {a.page}
                    </Text>
                    <Box align="center" direction="row" gap={12}>
                      <Text color={t.faint} size={11}>
                        {whenLabel(a.createdAt)}
                      </Text>
                      <Tap
                        onPress={() => {
                          remove(a.id);
                          showToast("Removed");
                        }}
                        scale={0.86}
                      >
                        <Text color={t.faint} size={14}>
                          ✕
                        </Text>
                      </Tap>
                    </Box>
                  </Box>
                  <Box
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: HIGHLIGHT_FILL[a.color],
                      paddingLeft: 12,
                    }}
                  >
                    <Text
                      lh={22}
                      numberOfLines={PASSAGE_LINES}
                      onTextLayout={noteLayout(a.id, a.text)}
                      serif
                      size={14}
                    >
                      {a.text}
                    </Text>
                  </Box>
                  {a.note ? (
                    <Box
                      bg={t.chip}
                      direction="row"
                      gap={8}
                      paddingX={12}
                      paddingY={10}
                      rounded={10}
                    >
                      {/* A 40px target rather than a 13px glyph — this is the
                          only way in to editing a note. */}
                      <Tap
                        onPress={() => {
                          setEditDraft(a.note);
                          setEditing(a.id);
                        }}
                        scale={0.9}
                      >
                        <Box
                          align="center"
                          height={40}
                          justify="center"
                          style={{ marginLeft: -8, marginVertical: -8 }}
                          width={40}
                        >
                          <IconPencil color={t.accentText} size={16} />
                        </Box>
                      </Tap>
                      <Box flex={1}>
                        <Text
                          color={t.sub}
                          lh={19}
                          numberOfLines={NOTE_LINES}
                          onTextLayout={noteLayout(a.id, a.note)}
                          size={12.5}
                        >
                          {a.note}
                        </Text>
                      </Box>
                    </Box>
                  ) : null}
                  {clipped[a.id] ? (
                    <Tap onPress={() => setExpanded(a.id)} scale={0.97}>
                      <Text color={t.accentText} size={12} weight="600">
                        See more
                      </Text>
                    </Tap>
                  ) : null}
                </Card>
              </Tap>
            ))}
            {noteList.length === 0
              ? empty(
                  tab === "notes"
                    ? "No notes yet — highlight a passage in Reflow, then choose Note."
                    : "No highlights yet — select text in Reflow to highlight it.",
                )
              : null}
          </>
        )}
      </ScrollView>

      {/* CenterModal paints its own white card, so the surface is restyled to
          the reader's theme rather than left light in dark mode. */}
      <CenterModal
        containerStyle={{
          backgroundColor: t.card,
          borderColor: t.line,
          borderWidth: 1,
          maxHeight: "78%",
          padding: 0,
        }}
        marginHorizontal={4}
        onClose={() => setExpanded(null)}
        visible={openEntry !== null}
      >
        {openEntry ? (
          <>
            <Box
              align="center"
              direction="row"
              gap={10}
              paddingBottom={12}
              paddingTop={18}
              paddingX={18}
            >
              <Box flex={1}>
                <Text color={t.faint} mono size={11} weight="600">
                  PAGE {openEntry.page}
                </Text>
              </Box>
              <Tap onPress={() => setExpanded(null)} scale={0.9}>
                <IconClose color={t.sub} size={17} />
              </Tap>
            </Box>

            <ScrollView
              contentContainerStyle={{ padding: 18, paddingTop: 0, gap: 14 }}
              style={{ flexGrow: 0 }}
            >
              <Box
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: HIGHLIGHT_FILL[openEntry.color],
                  paddingLeft: 12,
                }}
              >
                <Text lh={23} serif size={14.5}>
                  {openEntry.text}
                </Text>
              </Box>
              {openEntry.note ? (
                <Box
                  bg={t.chip}
                  direction="row"
                  gap={8}
                  paddingX={12}
                  paddingY={12}
                  rounded={10}
                >
                  <Box paddingTop={2}>
                    <IconPencil color={t.accentText} size={13} />
                  </Box>
                  <Box flex={1}>
                    <Text color={t.sub} lh={20} size={13}>
                      {openEntry.note}
                    </Text>
                  </Box>
                </Box>
              ) : null}
            </ScrollView>

            <Box paddingBottom={18} paddingTop={4} paddingX={18}>
              <Tap
                onPress={() => {
                  setExpanded(null);
                  jump(openEntry.page, openEntry.text);
                }}
                scale={0.97}
              >
                <Box align="center" bg={t.accent} paddingY={12} rounded={12}>
                  <Text color={t.onAccent} size={13.5} weight="600">
                    Go to page {openEntry.page}
                  </Text>
                </Box>
              </Tap>
            </Box>
          </>
        ) : null}
      </CenterModal>

      {/* Anchored to the top so the keyboard has somewhere to go — a centred
          card with a focused input ends up half-covered on a short screen. */}
      <CenterModal
        containerStyle={{
          backgroundColor: t.card,
          borderColor: t.line,
          borderWidth: 1,
          padding: 18,
        }}
        marginHorizontal={4}
        onClose={() => setEditing(null)}
        position="top"
        visible={editing !== null}
      >
        <Box gap={12}>
          <Box align="center" direction="row" gap={10}>
            <IconPencil color={t.accentText} size={15} />
            <Box flex={1}>
              <Text size={14} weight="600">
                Edit note
              </Text>
            </Box>
            <Tap onPress={() => setEditing(null)} scale={0.9}>
              <IconClose color={t.sub} size={17} />
            </Tap>
          </Box>

          <TextInput
            autoFocus
            backgroundColor={t.chip}
            borderColor={t.line}
            borderWidth={1}
            fontSize={14}
            multiline
            onChangeText={setEditDraft}
            placeholder="What did you make of it?"
            placeholderTextColor={t.faint}
            rounded={12}
            style={{ minHeight: 120, maxHeight: 220, textAlignVertical: "top" }}
            textColor={t.ink}
            value={editDraft}
          />

          <Tap
            onPress={() => {
              if (editing) setNote(editing, editDraft.trim());
              setEditing(null);
              showToast("Note updated");
            }}
            scale={0.97}
          >
            <Box align="center" bg={t.accent} paddingY={12} rounded={12}>
              <Text color={t.onAccent} size={13.5} weight="600">
                Save
              </Text>
            </Box>
          </Tap>
        </Box>
      </CenterModal>
    </ProtoScreen>
  );
}
