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
import { Keyboard } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_FILL,
  type HighlightColor,
  useAnnotationsStore,
} from "@/stores/annotations-store";
import { useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

const NOTE_DEFAULT_COLOR: HighlightColor = "amber";
/** The composer grows with the note between these, then scrolls. */
const NOTE_MIN_HEIGHT = 88;
const NOTE_MAX_HEIGHT = 200;

export function AnnotateBar({
  onBookmark,
  onClose,
  onComposingChange,
  page,
  source,
  text,
  uri,
}: {
  /** Bookmarks the page the passage is on. Omit where there's nothing to
   *  bookmark against — the action is hidden rather than shown inert. */
  onBookmark?: () => void;
  onClose: () => void;
  /**
   * True while the note composer is open. The reader needs this because
   * focusing the composer's input pulls focus out of the reflow WebView,
   * which drops its text selection — and the reader was tearing this whole
   * component down in response, mid keyboard animation.
   */
  onComposingChange?: (composing: boolean) => void;
  page: number;
  /** Where the passage came from, for listings that aren't per-document. */
  source?: string;
  text: string;
  uri: string;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const add = useAnnotationsStore((s) => s.add);

  // Null means "still just a selection". Once true, the note composer opens.
  const [noteFor, setNoteFor] = useState<boolean>(false);
  const [draft, setDraft] = useState("");
  // Grows with what's typed, capped so the card can't swallow the screen.
  const [draftHeight, setDraftHeight] = useState(NOTE_MIN_HEIGHT);

  const dismissComposer = () => {
    // The keyboard was raised by this composer, so it goes down with it —
    // otherwise closing from the ✕ leaves it up over the page.
    Keyboard.dismiss();
    setDraft("");
    setNoteFor(false);
    onComposingChange?.(false);
    onClose();
  };

  const save = (color: HighlightColor) =>
    add({ uri, page, source, text, color, note: "" });

  const highlight = (color: HighlightColor) => {
    save(color);
    dismissComposer();
    showToast("Highlighted — find it in My Notes");
  };

  if (noteFor) {
    return (
      <>
        <Backdrop
          onPress={() => {
            // Backing out abandons the draft note.
            dismissComposer();
          }}
          opacity={0.4}
        />
        <Box
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 40,
          }}
        >
          {/* Keep the dismiss area tappable while the composer itself sticks
              to the keyboard and moves with it on Android edge-to-edge. */}
          <Tap onPress={dismissComposer} scale={1} style={{ flex: 1 }}>
            <Box style={{ flex: 1 }} />
          </Tap>

          {/* The safe-area inset keeps the card clear of the gesture bar
              once the keyboard is down. With the keyboard up that space is
              covered anyway, so `opened` gives it back rather than leaving a
              gap between the card and the keyboard. */}
          <KeyboardStickyView
            offset={{ closed: 0, opened: insets.bottom }}
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16 + insets.bottom,
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
                <Tap onPress={dismissComposer} scale={0.9}>
                  <IconClose color={t.sub} size={16} />
                </Tap>
              </Box>

              <Box
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: HIGHLIGHT_FILL[NOTE_DEFAULT_COLOR],
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
                onContentSizeChange={(e) =>
                  setDraftHeight(e.nativeEvent.contentSize.height)
                }
                placeholder="What did you make of it?"
                placeholderTextColor={t.faint}
                rounded={12}
                // Only scrolls once it has hit the cap; below that the box
                // grows instead, so short notes aren't stuck in a tiny window.
                scrollEnabled={draftHeight > NOTE_MAX_HEIGHT}
                style={{
                  height: Math.min(
                    NOTE_MAX_HEIGHT,
                    Math.max(NOTE_MIN_HEIGHT, draftHeight),
                  ),
                  textAlignVertical: "top",
                }}
                textColor={t.ink}
                value={draft}
              />

              <Tap
                onPress={() => {
                  const note = draft.trim();
                  add({
                    uri,
                    page,
                    source,
                    text,
                    color: NOTE_DEFAULT_COLOR,
                    note,
                  });
                  dismissComposer();
                  showToast(
                    note ? "Note saved" : "Highlighted — note left empty",
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
        </Box>
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
              // Notes are persisted on "Save note", so backing out here does
              // not leave behind an empty highlight.
              setDraft("");
              setNoteFor(true);
              onComposingChange?.(true);
            }}
          />
          {onBookmark ? (
            <SelAction
              icon={<IconBookmark color="#F6F3EE" size={16} />}
              label="Bookmark"
              onPress={() => {
                onBookmark();
                dismissComposer();
              }}
            />
          ) : null}
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
