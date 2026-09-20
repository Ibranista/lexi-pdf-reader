import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  IconBookmark,
  SectionLabel,
  Segmented,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

import type { PdfOutlineEntry } from "./PdfReflowView";

type DrawerTab = "bookmarks" | "contents";

const PANEL_WIDTH = 302;
const EDGE_WIDTH = 24;
const SPRING = {
  damping: 28,
  mass: 0.55,
  overshootClamping: true,
  restDisplacementThreshold: 0.002,
  restSpeedThreshold: 0.02,
  stiffness: 450,
} as const;
const NUDGE_PX = 8;
const NUDGE_OUT = { duration: 260, easing: Easing.inOut(Easing.quad) } as const;
const NUDGE_BACK = { duration: 340, easing: Easing.inOut(Easing.quad) } as const;
const PEEK_DELAY = 900;
const ACTIVATE_X = 12;
const FAIL_Y = 26;
const FLING_VELOCITY = 450;
const COMMIT_TRAVEL = 0.25;
const OVERDRAG = 0.12;
const SCRIM_OPACITY = 0.32;
const BLEED = 48;

const peeked = new Set<string>();

type ListProps = {
  bookmarks: number[];
  entries: PdfOutlineEntry[];
  onGoPage: (page: number) => void;
  onRemoveBookmark?: (page: number) => void;
  page: number;
  title: string;
};

export function PdfOutlineDrawer({
  handleVisible = true,
  hintKey,
  hintReady = true,
  onClose,
  onOpen,
  open,
  ...list
}: ListProps & {
  handleVisible?: boolean;
  hintKey: string;
  hintReady?: boolean;
  onClose: () => void;
  onOpen: () => void;
  open: boolean;
}) {
  const t = useProtoTheme();
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.min(PANEL_WIDTH, windowWidth * 0.86);

  const progress = useSharedValue(open ? 1 : 0);
  const start = useSharedValue(open ? 1 : 0);
  const active = useSharedValue(false);
  const nudge = useSharedValue(0);
  const widthSV = useSharedValue(panelWidth);
  useEffect(() => {
    widthSV.value = panelWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelWidth]);

  const target = useRef(open);
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);

  const syncRef = useRef<(next: boolean) => void>(() => undefined);
  useEffect(() => {
    syncRef.current = (next: boolean) => {
      target.current = next;
      if (next) onOpen();
      else onClose();
    };
  }, [onClose, onOpen]);
  const syncJS = useCallback((next: boolean) => {
    syncRef.current(next);
  }, []);
  const showJS = useCallback(() => {
    setShown(true);
  }, []);

  /* Gesture callbacks reach `syncRef` when a finger lifts, not during render.
     eslint-disable-next-line is no use here: it flags each builder call. */
  /* eslint-disable react-hooks/refs */
  const gestures = useMemo(() => {
    const settle = (next: boolean, velocity: number) => {
      "worklet";
      progress.value = withSpring(next ? 1 : 0, { ...SPRING, velocity });
      runOnJS(syncJS)(next);
    };
    const pan = (fromEdge: boolean) =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onBegin(() => {
          start.value = progress.value;
        })
        .onStart(() => {
          active.value = true;
          if (fromEdge) runOnJS(showJS)();
        })
        .onUpdate((event) => {
          const raw = start.value + event.translationX / (widthSV.value || 1);
          progress.value =
            raw < 0 ? 0 : raw > 1 ? 1 + Math.min(raw - 1, 1) * OVERDRAG : raw;
        })
        .onEnd((event) => {
          const travelled = progress.value - start.value;
          const next =
            Math.abs(event.velocityX) > FLING_VELOCITY
              ? event.velocityX > 0
              : Math.abs(travelled) > COMMIT_TRAVEL
                ? travelled > 0
                : start.value > 0.5;
          settle(next, event.velocityX / (widthSV.value || 1));
        })
        .onFinalize((_event, success) => {
          if (active.value && !success) settle(start.value > 0.5, 0);
          active.value = false;
        });
    return {
      edge: pan(true),
      panel: pan(false),
      scrim: Gesture.Race(
        pan(false),
        Gesture.Tap().onEnd((_event, success) => {
          if (success) settle(false, 0);
        }),
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showJS, syncJS]);
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    if (target.current !== open) {
      target.current = open;
      progress.value = withSpring(open ? 1 : 0, SPRING);
      return;
    }
    if (open || !hintReady || peeked.has(hintKey)) return;
    peeked.add(hintKey);
    nudge.value = withDelay(
      PEEK_DELAY,
      withSequence(
        withTiming(NUDGE_PX, NUDGE_OUT),
        withTiming(0, NUDGE_BACK),
        withTiming(NUDGE_PX * 0.55, NUDGE_OUT),
        withTiming(0, NUDGE_BACK),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintKey, hintReady, open]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.15, 1],
      [0, SCRIM_OPACITY],
      Extrapolation.CLAMP,
    ),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (Math.max(progress.value, 0) - 1) * widthSV.value },
    ],
    zIndex: progress.value === 0 ? 39 : 40,
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.max(progress.value, 0) * widthSV.value + nudge.value },
    ],
  }));

  return (
    <>
      <GestureDetector gesture={gestures.scrim}>
        <Reanimated.View
          pointerEvents={open ? "auto" : "none"}
          style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
        />
      </GestureDetector>

      <GestureDetector gesture={gestures.panel}>
        <Reanimated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.panel,
            {
              backgroundColor: t.card,
              left: -BLEED,
              paddingLeft: BLEED,
              width: panelWidth + BLEED,
            },
            panelStyle,
          ]}
        >
          {shown ? <OutlineList {...list} /> : null}
        </Reanimated.View>
      </GestureDetector>

      {!open ? (
        <GestureDetector gesture={gestures.edge}>
          <Reanimated.View style={styles.edge}>
            <Reanimated.View
              style={[
                styles.handleSpot,
                { opacity: handleVisible ? 1 : 0 },
                handleStyle,
              ]}
            >
              <Tap
                disabled={!handleVisible}
                onPress={onOpen}
              >
                <Box
                  align="center"
                  bg={t.chip}
                  height={64}
                  justify="center"
                  roundedBottomRight={10}
                  roundedTopRight={10}
                  width={18}
                >
                  <Box bg={t.faint} height={26} rounded={2} width={3} />
                </Box>
              </Tap>
            </Reanimated.View>
          </Reanimated.View>
        </GestureDetector>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: EDGE_WIDTH,
    zIndex: 9,
  },
  handleSpot: { left: 0, position: "absolute", top: "46%" },
  panel: {
    borderBottomRightRadius: 20,
    borderTopRightRadius: 20,
    bottom: 0,
    elevation: 24,
    position: "absolute",
    shadowColor: "#14100C",
    shadowOffset: { height: 0, width: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    top: 0,
  },
  scrim: { backgroundColor: "#14100C", zIndex: 38 },
});

function OutlineList({
  bookmarks,
  entries,
  onGoPage,
  onRemoveBookmark,
  page,
  title,
}: ListProps) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<DrawerTab>("contents");
  const tabbed = entries.length > 0 && bookmarks.length > 0;
  const active: DrawerTab = tabbed
    ? tab
    : entries.length
      ? "contents"
      : "bookmarks";

  let currentIdx = -1;
  entries.forEach((e, i) => {
    if (e.page <= page) currentIdx = i;
  });

  const sectionOf = (target: number) => {
    let found: PdfOutlineEntry | null = null;
    for (const e of entries) {
      if (e.page > target) break;
      found = e;
    }
    return found?.title;
  };

  return (
    <>
        <Box
          paddingBottom={16}
          paddingX={24}
          style={{
            paddingTop: insets.top + 14,
            borderBottomWidth: 1,
            borderBottomColor: t.line,
          }}
        >
          <SectionLabel>
            {tabbed ? "Jump to" : entries.length ? "Contents" : "Bookmarks"}
          </SectionLabel>
          <Text
            numberOfLines={2}
            serif
            size={18}
            style={{ marginTop: 6 }}
            weight="600"
          >
            {title}
          </Text>
          {tabbed ? (
            <Box marginTop={13}>
              <Segmented
                items={[
                  { key: "contents" as const, label: "Contents" },
                  {
                    key: "bookmarks" as const,
                    label: `Bookmarks · ${bookmarks.length}`,
                    flex: 1.3,
                  },
                ]}
                onChange={setTab}
                size={11.5}
                value={active}
              />
            </Box>
          ) : null}
        </Box>

        <ScrollView
          contentContainerStyle={{
            padding: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 28,
          }}
          style={{ flex: 1 }}
        >
          {active === "contents"
            ? entries.map((e, i) => {
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
              })
            : bookmarks.map((bp) => {
                const on = bp === page;
                const where = sectionOf(bp);
                return (
                  <Tap key={`bm-${bp}`} onPress={() => onGoPage(bp)}>
                    <Box
                      align="center"
                      bg={on ? t.accentSoft : "transparent"}
                      direction="row"
                      gap={10}
                      paddingX={12}
                      paddingY={12}
                      rounded={12}
                    >
                      <IconBookmark
                        color={on ? t.accentText : t.accent}
                        fill={on ? t.accentText : t.accent}
                        size={14}
                      />
                      <Box flex={1}>
                        <Text
                          color={on ? t.accentText : t.ink}
                          size={14}
                          weight={on ? "600" : "500"}
                        >
                          Page {bp}
                        </Text>
                        {where ? (
                          <Text
                            color={on ? t.accentText : t.faint}
                            numberOfLines={1}
                            size={11.5}
                            style={{ marginTop: 2 }}
                          >
                            {where}
                          </Text>
                        ) : null}
                      </Box>
                      {onRemoveBookmark ? (
                        <Tap
                          onPress={() => onRemoveBookmark(bp)}
                          scale={0.86}
                          style={{ padding: 6 }}
                        >
                          <Text color={t.faint} size={15}>
                            ✕
                          </Text>
                        </Tap>
                      ) : null}
                    </Box>
                  </Tap>
                );
              })}

          {!entries.length && !bookmarks.length ? (
            <Box align="center" gap={8} paddingX={20} paddingY={40}>
              <IconBookmark color={t.faint} size={22} />
              <Text align="center" color={t.sub} lh={19} size={13}>
                No contents or bookmarks yet. Tap the bookmark icon while
                reading to mark a page.
              </Text>
            </Box>
          ) : null}
        </ScrollView>
    </>
  );
}
