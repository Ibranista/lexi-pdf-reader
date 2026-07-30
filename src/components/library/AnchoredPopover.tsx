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

export interface Anchor {
  x: number;
  y: number;
}

export function anchorOf(event?: GestureResponderEvent): Anchor | undefined {
  const touch = event?.nativeEvent;
  if (!touch) return undefined;
  const { pageX, pageY } = touch;
  if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) return undefined;
  return { x: pageX, y: pageY };
}

const MARGIN = 12;
const GAP = 10;

export function AnchoredPopover({
  anchor,
  children,
  maxWidth,
  onClose,
  width,
}: {
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
                  { left: MARGIN, opacity: 0, top: minTop }
                : // No anchor to work from — sit centred rather than in a
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
