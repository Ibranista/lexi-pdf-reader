/**
 * What you get when you select text in Reflow: the prototype's dark action
 * bar, wired to the annotations store.
 *
 * Highlight and Note write the same row — a highlight is an annotation with an
 * empty note, and Note just opens the composer on it straight away — which is
 * what lets the Notes screen present "Highlights" and "Notes" as two views of
 * one list rather than two things to keep in sync.
 */
import { useState } from "react";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import { Box, TextInput } from "@/components/atoms";
import {
  Backdrop,
  IconBookmark,
  IconClose,
  IconHighlighter,
  IconNoteDoc,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useToastStore } from "@/stores/app-store";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_FILL,
  type HighlightColor,
  useAnnotationsStore,
} from "@/stores/annotations-store";
import { useProtoTheme } from "@/theme/proto";

export function AnnotateBar({
  onBookmark,
  onClose,
  page,
  text,
  uri,
}: {
  /** Bookmarks the page the passage is on. */
  onBookmark: () => void;
  onClose: () => void;
  page: number;
  text: string;
  uri: string;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const add = useAnnotationsStore((s) => s.add);
  const setNote = useAnnotationsStore((s) => s.setNote);

  // Set once the passage has been saved, so the composer knows what to attach
  // the note to. Null means "still just a selection".
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const save = (color: HighlightColor) =>
    add({ uri, page, text, color, note: "" });

  const highlight = (color: HighlightColor) => {
    save(color);
    onClose();
    showToast("Highlighted — find it in My Notes");
  };

  if (noteFor !== null) {
    return (
      <>
        <Backdrop
          onPress={() => {
            // Backing out keeps the highlight; only the note is abandoned.
            onClose();
          }}
          opacity={0.4}
        />
        {/* KeyboardStickyView translates with the keyboard, which is the
            only thing that works on Android now that it runs edge-to-edge:
            the window no longer resizes, so RN's KeyboardAvoidingView has
            nothing to measure and the composer stayed under the keyboard. */}
        <KeyboardStickyView
          offset={{ closed: 0, opened: 12 }}
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 24,
            zIndex: 40,
          }}
        >
          <Box
            bg={t.card}
            borderColor={t.line}
            borderWidth={1}
            gap={12}
            padding={16}
            rounded={18}
            style={{ elevation: 20 }}
          >
            <Box align="center" direction="row" gap={10}>
              <IconNoteDoc color={t.accentText} size={15} />
              <Box flex={1}>
                <Text size={13} weight="600">
                  Note on page {page}
                </Text>
              </Box>
              <Tap onPress={onClose} scale={0.9}>
                <IconClose color={t.sub} size={16} />
              </Tap>
            </Box>

            <Box
              style={{
                borderLeftWidth: 3,
                borderLeftColor: HIGHLIGHT_FILL.amber,
                paddingLeft: 10,
              }}
            >
              <Text color={t.sub} lh={18} numberOfLines={3} serif size={12.5}>
                {text}
              </Text>
            </Box>

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
              style={{ minHeight: 88, textAlignVertical: "top" }}
              textColor={t.ink}
              value={draft}
            />

            <Tap
              onPress={() => {
                setNote(noteFor, draft.trim());
                onClose();
                showToast(
                  draft.trim() ? "Note saved" : "Highlighted — note left empty",
                );
              }}
              scale={0.97}
            >
              <Box align="center" bg={t.accent} paddingY={12} rounded={12}>
                <Text color={t.onAccent} size={14} weight="600">
                  Save note
                </Text>
              </Box>
            </Tap>
          </Box>
        </KeyboardStickyView>
      </>
    );
  }

  return (
    <>
      <Backdrop onPress={onClose} opacity={0} />
      <Box
        gap={10}
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 34,
          zIndex: 40,
        }}
      >
        <Box
          bg="#201B15"
          direction="row"
          padding={6}
          rounded={16}
          style={{
            shadowColor: "#201B15",
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.4,
            shadowRadius: 44,
            elevation: 20,
          }}
        >
          <SelAction
            highlight
            icon={<IconHighlighter color="#E8B778" size={16} />}
            label="Highlight"
            onPress={() => highlight("amber")}
          />
          <SelAction
            icon={<IconNoteDoc color="#F6F3EE" size={16} />}
            label="Note"
            onPress={() => {
              // Saved first so the note always has a passage to hang on,
              // even if the composer is dismissed.
              setNoteFor(save("amber"));
            }}
          />
          <SelAction
            icon={<IconBookmark color="#F6F3EE" size={16} />}
            label="Bookmark"
            onPress={() => {
              onBookmark();
              onClose();
            }}
          />
        </Box>

        <Box
          bg={t.card}
          borderColor={t.line}
          borderWidth={1}
          direction="row"
          justify="between"
          paddingX={16}
          paddingY={14}
          rounded={16}
          style={{ elevation: 12 }}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <Tap key={c.key} onPress={() => highlight(c.key)} scale={0.93}>
              <Box align="center" gap={6}>
                <Box
                  bg={HIGHLIGHT_FILL[c.key]}
                  height={34}
                  rounded={17}
                  width={34}
                />
                <Text color={t.sub} size={10} weight="500">
                  {c.label}
                </Text>
              </Box>
            </Tap>
          ))}
        </Box>
      </Box>
    </>
  );
}

function SelAction({
  highlight,
  icon,
  label,
  onPress,
}: {
  highlight?: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} scale={0.94} style={{ flex: 1 }}>
      <Box
        align="center"
        bg={highlight ? "rgba(246,243,238,.1)" : "transparent"}
        gap={5}
        paddingY={10}
        rounded={11}
      >
        {icon}
        <Text color="#F6F3EE" size={10.5} weight="500">
          {label}
        </Text>
      </Box>
    </Tap>
  );
}
