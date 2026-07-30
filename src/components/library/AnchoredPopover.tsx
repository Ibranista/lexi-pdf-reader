/**
 * A popover that opens next to whatever was touched, rather than in a fixed
 * corner of the screen.
 *
 * The library's document actions (⋮) and collection picker (long-press) both
 * used to appear pinned to the top right, however far down the list the row
 * was — so the menu had no visible relationship to the item it acted on. Both
 * now hand in the touch point and get placed around it.
 *
 * Placement waits for one layout pass, because the card's height is what
 * decides whether it can open downward: a row near the bottom of the list flips
 * its menu above the finger instead of running off the screen. Until that
 * measurement lands the card is laid out invisibly, so it is never seen in the
 * wrong place. Both axes are clamped to the safe area, so a touch at any edge
 * still produces a fully visible popover.
 */
import { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import { useProtoTheme } from "@/theme/proto";

/** Where the touch landed, in window coordinates. */
export interface Anchor {
  x: number;
  y: number;
}

/** Reads the touch point off a press/long-press for use as an anchor. */
export function anchorOf(event?: GestureResponderEvent): Anchor | undefined {
  const touch = event?.nativeEvent;
  if (!touch) return undefined;
  const { pageX, pageY } = touch;
  if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return undefined;
  return { x: pageX, y: pageY };
}

/** Clear of the screen edges. */
const MARGIN = 12;
/** Breathing room between the finger and the card. */
const GAP = 10;

export function AnchoredPopover({
  anchor,
  children,
  maxWidth,
  onClose,
  width,
}: {
  /** Touch point to open around; without one the popover centers itself. */
  anchor?: Anchor;
  children: ReactNode;
  maxWidth: number;
  onClose: () => void;
  width: number | `${number}%`;
}) {
  const t = useProtoTheme();
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ h: number; w: number } | null>(null);

  const minTop = insets.top + MARGIN;
  const maxTop = Math.max(minTop, win.height - insets.bottom - MARGIN - (size?.h ?? 0));

  let placement: { left: number; top: number } | null = null;
  if (anchor && size) {
    // Centred on the finger horizontally, so the card reads as belonging to
    // what was touched wherever in the row that was.
    const left = Math.min(
      Math.max(MARGIN, anchor.x - size.w / 2),
      Math.max(MARGIN, win.width - size.w - MARGIN),
    );
    const below = anchor.y + GAP;
    const fitsBelow = below + size.h <= win.height - insets.bottom - MARGIN;
    const top = fitsBelow ? below : anchor.y - size.h - GAP;
    placement = { left, top: Math.min(Math.max(minTop, top), maxTop) };
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Box
          bg={t.card}
          borderColor={t.line}
          borderWidth={1}
          gap={5}
          onLayout={(e) => {
            const { height, width: w } = e.nativeEvent.layout;
            // Guarded so sub-pixel layout noise can't loop, but a real growth
            // (rename opens an input, delete arms) still re-places the card.
            setSize((prev) =>
              prev && Math.abs(prev.h - height) < 1 && Math.abs(prev.w - w) < 1
                ? prev
                : { h: height, w },
            );
          }}
          padding={7}
          rounded={12}
          style={[
            { maxWidth, position: "absolute", width },
            placement ??
              (anchor
                ? // Measuring: laid out but not shown, so the first frame is
                  // never in the wrong place.
                  { left: MARGIN, opacity: 0, top: minTop }
                : // No anchor to work from — sit centred rather than in a
                  // corner that points at nothing.
                  { alignSelf: "center", top: minTop + 56 }),
          ]}
        >
          {children}
        </Box>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
});
