import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { type ReactElement, type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { RefreshControlProps } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Box } from "@/components/atoms";
import {
  IconChevron,
  IconGrid,
  IconList,
  IconStar,
  Tap,
  Text,
} from "@/components/lexi-components";
import { FAVORITE_COLLECTION } from "@/constants/collections";
import { formatSize, formatWhen } from "@/hooks/use-device-library";
import { usePdfThumbnail } from "@/hooks/use-pdf-thumbnail";
import { type SortKey, useAppStore, useToastStore } from "@/stores/app-store";
import {
  type FilableDoc,
  useCollectionsStore,
} from "@/stores/collections-store";
import { useProtoTheme } from "@/theme/proto";

export const GRID_COLUMNS = 3;

const SWIPE_COMMIT = 76;
const SWIPE_MAX = 112;

export interface ScrollerProps {
  contentPad: { padding: number; paddingTop: number; paddingBottom: number };
  refreshControl: ReactElement<RefreshControlProps>;
}

export type OpenCollections = (doc: FilableDoc) => void;

export function PdfThumb({
  doc,
  rounded = 9,
  style,
}: {
  doc: { uri: string; ext: string };
  rounded?: number;
  style?: { width?: number; height?: number; aspectRatio?: number };
}) {
  const t = useProtoTheme();
  const thumb = usePdfThumbnail(doc.uri, doc.ext === "PDF");

  return (
    <Box
      align="center"
      bg={t.coverA}
      borderColor={t.line}
      borderWidth={1}
      justify="center"
      rounded={rounded}
      style={{ ...style, overflow: "hidden" }}
    >
      {thumb ? (
        <Image
          contentFit="cover"
          source={{ uri: thumb }}
          style={{ width: "100%", height: "100%" }}
          transition={160}
        />
      ) : (
        <Text color={t.sub} mono size={8}>
          {doc.ext}
        </Text>
      )}
    </Box>
  );
}

const SORT_KEYS: SortKey[] = ["date", "name", "size"];

export function SortBar() {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const sort = useAppStore((s) => s.librarySort);
  const view = useAppStore((s) => s.libraryView);
  const setApp = useAppStore((s) => s.set);

  const choose = (key: SortKey) =>
    setApp({
      librarySort:
        key === sort.key
          ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
          : { key, dir: key === "name" ? "asc" : "desc" },
    });

  return (
    <Box align="center" direction="row" gap={8} paddingBottom={14}>
      <Box
        align="center"
        direction="row"
        flex={1}
        gap={8}
        style={{ flexWrap: "wrap" }}
      >
        <Text color={t.faint} size={11.5} weight="500">
          {tr("library.sort.label")}
        </Text>
        {SORT_KEYS.map((key) => {
          const active = key === sort.key;
          return (
            <Tap key={key} onPress={() => choose(key)} scale={0.94}>
              <Box
                align="center"
                bg={active ? t.accentSoft : t.chip}
                direction="row"
                gap={4}
                paddingX={11}
                paddingY={5}
                rounded={20}
              >
                <Text
                  color={active ? t.accentText : t.sub}
                  size={11.5}
                  weight="500"
                >
                  {tr(`library.sort.${key}`)}
                </Text>
                {active ? (
                  <Text color={t.accentText} size={10} weight="600">
                    {sort.dir === "asc" ? "↑" : "↓"}
                  </Text>
                ) : null}
              </Box>
            </Tap>
          );
        })}
      </Box>

      <Tap
        onPress={() =>
          setApp({ libraryView: view === "grid" ? "list" : "grid" })
        }
        scale={0.92}
      >
        <Box
          align="center"
          bg={t.chip}
          height={30}
          justify="center"
          rounded={9}
          width={34}
        >
          {view === "grid" ? (
            <IconList color={t.sub} size={17} />
          ) : (
            <IconGrid color={t.sub} size={16} />
          )}
        </Box>
      </Tap>
    </Box>
  );
}

export function SwipeToFavorite({
  children,
  doc,
}: {
  children: ReactNode;
  doc: FilableDoc;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const showToast = useToastStore((s) => s.showToast);
  const filed = useCollectionsStore((s) =>
    (s.items[FAVORITE_COLLECTION] ?? []).some((d) => d.uri === doc.uri),
  );
  const tx = useSharedValue(0);

  const commit = useCallback(() => {
    const nowFiled = useCollectionsStore
      .getState()
      .toggle(FAVORITE_COLLECTION, doc);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showToast(
      tr(
        nowFiled
          ? "library.collections.addedToast"
          : "library.collections.removedToast",
        { collection: tr("library.collections.names.important") },
      ),
    );
  }, [doc, showToast, tr]);

  const pan = Gesture.Pan()
    .activeOffsetX(-16)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = Math.max(-SWIPE_MAX, Math.min(0, e.translationX));
    })
    .onEnd(() => {
      if (tx.value <= -SWIPE_COMMIT) runOnJS(commit)();
      tx.value = withSpring(0, { damping: 22, stiffness: 240 });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const actionStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, -tx.value / SWIPE_COMMIT);
    return { opacity: progress, transform: [{ scale: 0.7 + progress * 0.3 }] };
  });

  return (
    <Box style={{ overflow: "hidden" }}>
      <Reanimated.View
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: SWIPE_MAX,
            alignItems: "center",
            justifyContent: "center",
          },
          actionStyle,
        ]}
      >
        <IconStar
          color={t.accent}
          fill={filed ? "none" : t.accent}
          size={22}
          strokeWidth={1.8}
        />
      </Reanimated.View>
      <GestureDetector gesture={pan}>
        <Reanimated.View style={rowStyle}>
          <Box bg={t.bg}>{children}</Box>
        </Reanimated.View>
      </GestureDetector>
    </Box>
  );
}

export function DocRow({
  doc,
  meta,
  onLongPress,
  onPress,
  trailing,
}: {
  doc: { uri: string; name: string; ext: string };
  meta: string;
  onLongPress?: () => void;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  const t = useProtoTheme();
  const filed = useCollectionsStore((s) =>
    (s.items[FAVORITE_COLLECTION] ?? []).some((d) => d.uri === doc.uri),
  );

  return (
    <Tap onLongPress={onLongPress} onPress={onPress} scale={0.99}>
      <Box
        align="center"
        direction="row"
        gap={14}
        paddingY={12}
        style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
      >
        <PdfThumb doc={doc} rounded={8} style={{ width: 44, height: 58 }} />
        <Box flex={1}>
          <Text numberOfLines={1} size={14} weight="600">
            {doc.name}
          </Text>
          <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
            {meta}
          </Text>
        </Box>
        {filed ? <IconStar color={t.accent} fill={t.accent} size={14} /> : null}
        {trailing ?? <IconChevron color={t.faint} size={16} />}
      </Box>
    </Tap>
  );
}

export function docMeta(size: number, modifiedAt: number | null): string {
  return [formatSize(size), formatWhen(modifiedAt)].filter(Boolean).join(" · ");
}
