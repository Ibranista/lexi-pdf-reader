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
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

type Section = "highlights" | "notes" | "vocab";

const DAY_MS = 24 * 60 * 60 * 1000;

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

export function NotesTab({ openReader }: { openReader: () => void }) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const [section, setSection] = useState<Section>("vocab");

  const vocab = useAppStore((s) => s.vocab);
  const setPage = useAppStore((s) => s.setPage);
  const showToast = useToastStore((s) => s.showToast);
  const annotations = useAnnotationsStore((s) => s.items);

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
                setPage(v.p);
                openReader();
                showToast(tr("library.vocab.jumpedToast", { page: v.p }));
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
          {(section === "highlights" ? highlights : notes).map((a) => (
            <Card gap={10} key={a.id}>
              <Box align="center" direction="row" gap={8}>
                <Box
                  bg={HIGHLIGHT_FILL[a.color]}
                  height={10}
                  rounded={3}
                  width={10}
                />
                <Box flex={1}>
                  <Text color={t.sub} numberOfLines={1} size={11.5}>
                    {a.source ?? tr("library.notes.fromDocument")}
                  </Text>
                </Box>
                <Text color={t.faint} size={11}>
                  {whenLabel(a.createdAt)}
                </Text>
              </Box>

              <Box direction="row" gap={9}>
                <Box bg={HIGHLIGHT_FILL[a.color]} rounded={2} width={4} />
                <Box flex={1}>
                  <Text color={t.readerInk} lh={20} numberOfLines={5} size={13}>
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
          ))}

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
