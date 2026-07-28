import { router } from "expo-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  Card,
  IconHighlighter,
  IconNoteDoc,
  IconSpark,
  Segmented,
  Tap,
  Text,
} from "@/components/lexi-components";
import { LANG_NAMES } from "@/constants/library";
import {
  HIGHLIGHT_FILL,
  useAnnotationsStore,
} from "@/stores/annotations-store";
import {
  useAppStore,
  useReaderJumpStore,
  useToastStore,
} from "@/stores/app-store";
import { useRecentsStore } from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";

type Section = "highlights" | "notes" | "vocab";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today" / "Yesterday" / a date — matches the notes screen. */
function whenLabel(ms: number): string {
  const days = Math.floor((Date.now() - ms) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * Everything you've saved while reading, across every document — saved words,
 * highlights and notes. The per-document view of the same annotations lives in
 * the reader's own notes screen; this is the library-wide one, which is why it
 * doesn't try to link back into a document.
 */
export function NotesTab({ openReader }: { openReader: () => void }) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const [section, setSection] = useState<Section>("vocab");

  const vocab = useAppStore((s) => s.vocab);
  const setPage = useAppStore((s) => s.setPage);
  const showToast = useToastStore((s) => s.showToast);
  const annotations = useAnnotationsStore((s) => s.items);
  const recents = useRecentsStore((s) => s.recents);

  /** Document behind each annotation, for its name and how to reopen it. */
  const docs = useMemo(() => {
    const byUri = new Map<string, { ext: string; name: string }>();
    for (const r of recents) byUri.set(r.uri, { ext: r.ext, name: r.name });
    return byUri;
  }, [recents]);

  /**
   * Opens the document this passage came from, on its page. The reader picks
   * the page up on focus (see the jump store) rather than through a param,
   * which is the same path the in-reader notes screen uses.
   *
   * Passages saved in the web reader have no document to open — their url is
   * not a stable key — so those cards stay inert.
   */
  const jumpTo = (uri: string | undefined, page: number) => {
    const doc = uri ? docs.get(uri) : undefined;
    if (!uri || !doc) {
      // A saved word/passage whose document is no longer on the recents list
      // (or was saved in the web reader) has nothing to reopen — say so rather
      // than swallowing the tap.
      showToast(tr("library.notes.reopenUnavailable"));
      return;
    }
    useReaderJumpStore.getState().request(uri, page);
    if (doc.ext === "PDF") {
      // Reflow, not page view: the highlight is drawn into the reflowed text,
      // so the page bitmap would open with nothing marked on it.
      router.push({
        params: { name: doc.name, uri, view: "reflow" },
        pathname: "/pdf",
      });
      showToast(tr("library.notes.jumpedToast", { page }));
      return;
    }
    router.push({
      params: { ext: doc.ext, name: doc.name, uri },
      pathname: "/text",
    });
  };

  // Newest first — library-wide there's no document order to follow.
  const { highlights, notes } = useMemo(() => {
    const sorted = [...annotations].sort((a, b) => b.createdAt - a.createdAt);
    return {
      highlights: sorted.filter((a) => !a.note.trim()),
      notes: sorted.filter((a) => a.note.trim()),
    };
  }, [annotations]);

  const counts = {
    highlights: highlights.length,
    notes: notes.length,
    vocab: vocab.length,
  };

  return (
    <>
      <Box paddingBottom={12}>
        <Segmented
          items={[
            { key: "vocab" as const, label: `Words · ${counts.vocab}` },
            {
              key: "highlights" as const,
              label: `Highlights · ${counts.highlights}`,
              flex: 1.25,
            },
            { key: "notes" as const, label: `Notes · ${counts.notes}` },
          ]}
          onChange={setSection}
          size={11.5}
          value={section}
        />
      </Box>

      {section === "vocab" ? (
        <Box gap={12}>
          {vocab.map((v) => (
            <Tap
              key={v.word}
              onPress={() => {
                // A word saved while reading a real document reopens that
                // document on its page — the same path highlights and notes
                // take. Only the seeded demo words (no uri) fall back to the
                // prototype reader.
                if (v.uri) {
                  jumpTo(v.uri, v.p);
                } else {
                  setPage(v.p);
                  openReader();
                  showToast(tr("library.vocab.jumpedToast", { page: v.p }));
                }
              }}
              scale={0.985}
            >
              <Card gap={10}>
                <Box
                  direction="row"
                  gap={10}
                  style={{ alignItems: "baseline" }}
                >
                  <Text serif size={18} weight="600">
                    {v.word}
                  </Text>
                  <Box bg={t.chip} paddingX={8} paddingY={3} rounded={12}>
                    <Text color={t.sub} size={10.5} weight="500">
                      {v.pos}
                    </Text>
                  </Box>
                  <Box flex={1} />
                  <Text color={t.faint} mono size={11} weight="600">
                    {tr("library.vocab.pageAbbrev", { page: v.p })}
                  </Text>
                </Box>
                <Box
                  direction="row"
                  gap={8}
                  wrap="wrap"
                  style={{ alignItems: "baseline" }}
                >
                  <Text color={t.accentText} size={17} weight="600">
                    {v.tr}
                  </Text>
                  <Text color={t.sub} size={12}>
                    {tr("library.vocab.translitLine", {
                      lang: LANG_NAMES[v.lang] ?? v.lang,
                      translit: v.translit,
                    })}
                  </Text>
                </Box>
                <Box direction="row" gap={9}>
                  <Box bg={t.accent} rounded={2} width={4} />
                  <Box flex={1}>
                    <Text color={t.readerInk} lh={20} size={13}>
                      {v.s1}
                    </Text>
                  </Box>
                </Box>
                <Box direction="row" gap={9}>
                  <Box bg={t.accentSoft} rounded={2} width={4} />
                  <Box flex={1}>
                    <Text color={t.sub} lh={20} size={13}>
                      {v.s2}
                    </Text>
                  </Box>
                </Box>
                {v.example ? (
                  <Box bg={t.chip} paddingX={10} paddingY={8} rounded={9}>
                    <Text color={t.sub} lh={19} serif size={12.5}>
                      “{v.example}”
                    </Text>
                  </Box>
                ) : null}
              </Card>
            </Tap>
          ))}

          {vocab.length === 0 ? (
            <Empty
              icon={<IconSpark color={t.faint} size={26} />}
              text={tr("library.vocab.emptyState")}
            />
          ) : null}
        </Box>
      ) : null}

      {section !== "vocab" ? (
        <Box gap={12}>
          {(section === "highlights" ? highlights : notes).map((a) => {
            const doc = docs.get(a.uri);
            const card = (
              <Card gap={10}>
                <Box align="center" direction="row" gap={8}>
                  <Box
                    bg={HIGHLIGHT_FILL[a.color]}
                    height={10}
                    rounded={3}
                    width={10}
                  />
                  <Box flex={1}>
                    <Text
                      color={doc ? t.accentText : t.sub}
                      numberOfLines={1}
                      size={11.5}
                      weight={doc ? "600" : "400"}
                    >
                      {doc?.name ?? a.source ?? tr("library.notes.fromDocument")}
                    </Text>
                  </Box>
                  {doc ? (
                    <Text color={t.faint} mono size={11} weight="600">
                      {tr("library.vocab.pageAbbrev", { page: a.page })}
                    </Text>
                  ) : null}
                  <Text color={t.faint} size={11}>
                    {whenLabel(a.createdAt)}
                  </Text>
                </Box>

                <Box direction="row" gap={9}>
                  <Box bg={HIGHLIGHT_FILL[a.color]} rounded={2} width={4} />
                  <Box flex={1}>
                    <Text
                      color={t.readerInk}
                      lh={20}
                      numberOfLines={5}
                      size={13}
                    >
                      {a.text}
                    </Text>
                  </Box>
                </Box>

                {a.note.trim() ? (
                  <Box bg={t.chip} gap={6} padding={10} rounded={10}>
                    <Text color={t.faint} ls={0.6} size={10} upper weight="600">
                      {tr("library.notes.noteLabel")}
                    </Text>
                    <Text lh={19} size={13}>
                      {a.note}
                    </Text>
                  </Box>
                ) : null}
              </Card>
            );

            // No document behind it (saved in the web reader) — nothing to open.
            return doc ? (
              <Tap key={a.id} onPress={() => jumpTo(a.uri, a.page)} scale={0.985}>
                {card}
              </Tap>
            ) : (
              <Box key={a.id}>{card}</Box>
            );
          })}

          {(section === "highlights" ? highlights : notes).length === 0 ? (
            <Empty
              icon={
                section === "highlights" ? (
                  <IconHighlighter color={t.faint} size={24} />
                ) : (
                  <IconNoteDoc color={t.faint} size={24} />
                )
              }
              text={
                section === "highlights"
                  ? tr("library.notes.emptyHighlights")
                  : tr("library.notes.emptyNotes")
              }
            />
          ) : null}
        </Box>
      ) : null}
    </>
  );
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  const t = useProtoTheme();
  return (
    <Box align="center" gap={10} paddingX={24} paddingY={48}>
      {icon}
      <Text align="center" color={t.sub} lh={21} size={13}>
        {text}
      </Text>
    </Box>
  );
}
