/**
 * Tapping a highlight in the reflowed text opens it here — the passage, its
 * note, and the few things you'd want to do to it.
 *
 * A centred card, deliberately: the note belongs to a sentence you can still
 * see behind it. Sending the reader off to the Notes screen for one note (which
 * is what tapping used to do) loses the page you were on.
 */
import { useState } from "react";

import { Box, TextInput } from "@/components/atoms";
import {
  Backdrop,
  IconClose,
  IconNoteDoc,
  Tap,
  Text,
} from "@/components/lexi-components";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_FILL,
  useAnnotationsStore,
  type Annotation,
} from "@/stores/annotations-store";
import { useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export function NoteCard({
  annotation,
  onClose,
}: {
  annotation: Annotation;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const setNote = useAnnotationsStore((s) => s.setNote);
  const setColor = useAnnotationsStore((s) => s.setColor);
  const remove = useAnnotationsStore((s) => s.remove);

  // A highlight with no note opens straight into the composer — there'd be
  // nothing to read otherwise, and "add one" is the only thing to do here.
  const [editing, setEditing] = useState(!annotation.note.trim());
  const [draft, setDraft] = useState(annotation.note);

  const save = () => {
    setNote(annotation.id, draft.trim());
    setEditing(false);
    showToast(draft.trim() ? "Note saved" : "Note cleared");
    if (!draft.trim()) onClose();
  };

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.28} />
      <Box
        bg={t.card}
        borderColor={t.line}
        borderWidth={1}
        gap={14}
        padding={20}
        rounded={20}
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          top: "26%",
          zIndex: 41,
          shadowColor: "#14100C",
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.35,
          shadowRadius: 60,
          elevation: 24,
        }}
      >
        <Box align="center" direction="row" gap={10}>
          <IconNoteDoc color={t.accentText} size={15} />
          <Box flex={1}>
            <Text size={13} weight="600">
              Page {annotation.page}
            </Text>
          </Box>
          <Tap onPress={onClose} scale={0.9}>
            <IconClose color={t.sub} size={16} />
          </Tap>
        </Box>

        {/* the passage, edged in its own highlight colour */}
        <Box
          style={{
            borderLeftWidth: 3,
            borderLeftColor: HIGHLIGHT_FILL[annotation.color],
            paddingLeft: 10,
          }}
        >
          <Text color={t.sub} lh={19} numberOfLines={4} serif size={13}>
            {annotation.text}
          </Text>
        </Box>

        {editing ? (
          <TextInput
            autoFocus
            backgroundColor={t.chip}
            borderColor={t.line}
            borderWidth={1}
            fontSize={14}
            multiline
            onChangeText={setDraft}
            placeholder="What did you make of it?"
            placeholderTextColor={t.faint}
            rounded={12}
            style={{ height: 104, textAlignVertical: "top" }}
            textColor={t.ink}
            value={draft}
          />
        ) : (
          <Text lh={21} size={14}>
            {annotation.note}
          </Text>
        )}

        {/* recolour in place — the mark in the text follows immediately */}
        <Box align="center" direction="row" gap={10}>
          {HIGHLIGHT_COLORS.map((c) => (
            <Tap key={c.key} onPress={() => setColor(annotation.id, c.key)} scale={0.9}>
              <Box
                bg={HIGHLIGHT_FILL[c.key]}
                borderColor={annotation.color === c.key ? t.ink : "transparent"}
                borderWidth={2}
                height={26}
                rounded={13}
                width={26}
              />
            </Tap>
          ))}
        </Box>

        <Box direction="row" gap={10}>
          <Tap
            onPress={() => {
              remove(annotation.id);
              onClose();
              showToast("Highlight removed");
            }}
            scale={0.96}
          >
            <Box bg={t.chip} paddingX={16} paddingY={12} rounded={12}>
              <Text color={t.sub} size={13} weight="600">
                Delete
              </Text>
            </Box>
          </Tap>
          <Tap
            onPress={editing ? save : () => setEditing(true)}
            scale={0.97}
            style={{ flex: 1 }}
          >
            <Box align="center" bg={t.accent} paddingY={12} rounded={12}>
              <Text color={t.onAccent} size={13} weight="600">
                {editing ? "Save note" : "Edit note"}
              </Text>
            </Box>
          </Tap>
        </Box>
      </Box>
    </>
  );
}
