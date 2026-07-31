import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Box } from "@/components/atoms";
import {
  Card,
  CollectionGlyph,
  Cover,
  IconBack,
  IconSpark,
  IconSync,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { anchorOf } from "@/components/library/AnchoredPopover";
import {
  COLLECTION_META,
  type CollectionId,
  resolveCollectionColor,
} from "@/constants/collections";
import { COLLECTIONS } from "@/constants/library";
import {
  SUGGESTION_COUNT,
  useBookSuggestions,
} from "@/hooks/use-book-suggestions";
import { useCollectionsStore } from "@/stores/collections-store";
import { useReaderType } from "@/stores/onboarding-store";
import { useProtoTheme } from "@/theme/proto";
import { isOnline } from "@/utils/connectivity";

import { DocRow, type OpenCollections } from "./shared";

export function CollectionsTab({
  openBook,
  openCollection,
  openCollections,
  openDoc,
  shelf,
}: {
  openBook: (book: { cover?: string; url: string; title: string }) => void;
  openCollection: (id: CollectionId | null) => void;
  openCollections: OpenCollections;
  openDoc: (doc: { uri: string; name: string; ext: string }) => void;
  shelf: CollectionId | null;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const readerType = useReaderType();
  const items = useCollectionsStore((s) => s.items);
  const cd = COLLECTIONS[readerType] ?? COLLECTIONS.student;
  const { failed, loading, refresh, refreshing, suggestions } =
    useBookSuggestions();
  const busy = loading || refreshing;
  const showNotice = failed && suggestions.length === 0;

  if (shelf) {
    const docs = items[shelf] ?? [];
    const meta = COLLECTION_META.find((c) => c.id === shelf);
    return (
      <>
        <Tap onPress={() => openCollection(null)}>
          <Box align="center" direction="row" gap={8} paddingBottom={14}>
            <IconBack color={t.accentText} size={16} />
            <Text color={t.accentText} size={13} weight="600">
              {tr("library.collections.allCollections")}
            </Text>
          </Box>
        </Tap>

        <Box
          direction="row"
          gap={10}
          paddingBottom={10}
          style={{ alignItems: "baseline" }}
        >
          {meta ? (
            <CollectionGlyph
              color={resolveCollectionColor(meta.color, t.dark, t.ink)}
              icon={meta.icon}
              size={18}
            />
          ) : null}
          <Text serif size={20} weight="600">
            {tr(`library.collections.names.${shelf}`)}
          </Text>
          <Box flex={1} />
          <Text color={t.faint} size={12}>
            {tr("library.collections.docCount", { count: docs.length })}
          </Text>
        </Box>

        {docs.length === 0 ? (
          <Box align="center" gap={10} paddingX={24} paddingY={44}>
            {meta ? (
              <CollectionGlyph
                color={resolveCollectionColor(meta.color, t.dark, t.sub)}
                icon={meta.icon}
                size={26}
              />
            ) : null}
            <Text align="center" color={t.sub} lh={21} size={13}>
              {tr("library.collections.shelfEmpty")}
            </Text>
          </Box>
        ) : (
          docs.map((doc) => (
            <DocRow
              doc={doc}
              key={doc.uri}
              meta={tr("library.collections.filedWhen", {
                when: new Date(doc.addedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
              })}
              onLongPress={(e) => openCollections(doc, anchorOf(e))}
              onPress={() => openDoc(doc)}
            />
          ))
        )}

        <Text color={t.faint} size={12} style={{ paddingTop: 14 }}>
          {tr("library.collections.manageHint")}
        </Text>
      </>
    );
  }

  return (
    <>
      <Box direction="row" gap={8}>
        {COLLECTION_META.map(({ color, icon, id }) => (
          <Tap
            key={id}
            onPress={() => openCollection(id)}
            scale={0.97}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Card gap={5} padding={10} rounded={14}>
              <CollectionGlyph
                color={resolveCollectionColor(color, t.dark, t.ink)}
                icon={icon}
                size={20}
              />
              <Text lh={16} numberOfLines={2} size={12} weight="600">
                {tr(`library.collections.names.${id}`)}
              </Text>
              <Text color={t.sub} numberOfLines={1} size={10}>
                {tr("library.collections.docCount", {
                  count: (items[id] ?? []).length,
                })}
              </Text>
            </Card>
          </Tap>
        ))}
      </Box>

      <Text color={t.faint} lh={18} size={12} style={{ paddingTop: 12 }}>
        {tr("library.collections.howToFile")}
      </Text>

      <Box
        align="center"
        direction="row"
        gap={8}
        paddingBottom={3}
        paddingTop={24}
      >
        <IconSpark color={t.accent} size={13} />
        <SectionLabel>{tr("library.collections.autoFilled")}</SectionLabel>
        <Box flex={1} />
        <Tap
          disabled={busy}
          onPress={refresh}
          scale={0.88}
          style={{ margin: -8, padding: 8 }}
        >
          <SpinningSync color={busy ? t.accent : t.sub} spinning={busy} />
        </Tap>
      </Box>
      <Text color={t.faint} size={12} style={{ paddingBottom: 4 }}>
        {tr("library.collections.basedOn", { label: cd.label })}
      </Text>

      {busy ? (
        Array.from({ length: SUGGESTION_COUNT }, (_, i) => (
          <Box
            align="center"
            direction="row"
            gap={14}
            key={i}
            paddingY={12}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Cover height={58} width={44} />
            <Box flex={1} gap={6}>
              <Box
                bg={t.line}
                height={12}
                rounded={4}
                style={{ width: "70%" }}
              />
              <Box
                bg={t.line}
                height={10}
                rounded={4}
                style={{ width: "45%" }}
              />
            </Box>
          </Box>
        ))
      ) : showNotice ? (
        <Card gap={12} padding={14} rounded={14} style={{ marginTop: 8 }}>
          <Text color={t.sub} lh={19} size={13}>
            {tr(
              isOnline()
                ? "library.collections.suggestFailed"
                : "library.collections.suggestOffline",
            )}
          </Text>
          <Tap
            onPress={refresh}
            scale={0.97}
            style={{ alignSelf: "flex-start" }}
          >
            <Box
              align="center"
              bg={t.accentSoft}
              direction="row"
              gap={7}
              paddingX={14}
              paddingY={9}
              rounded={20}
            >
              <IconSpark color={t.accentText} size={13} />
              <Text color={t.accentText} size={13} weight="600">
                {tr(
                  isOnline()
                    ? "library.collections.suggestRetry"
                    : "library.collections.suggestNow",
                )}
              </Text>
            </Box>
          </Tap>
        </Card>
      ) : (
        suggestions.map((book) => (
          <Tap
            key={book.id}
            onPress={() =>
              openBook({
                cover: book.coverUrl,
                title: book.title,
                url: book.readUrl,
              })
            }
          >
            <Box
              align="center"
              direction="row"
              gap={14}
              paddingY={12}
              style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
            >
              <Cover height={58} uri={book.coverUrl} width={44} />
              <Box flex={1}>
                <Text numberOfLines={1} size={14} weight="600">
                  {book.title}
                </Text>
                <Text
                  color={t.sub}
                  numberOfLines={1}
                  size={12}
                  style={{ marginTop: 3 }}
                >
                  {book.author
                    ? tr("library.collections.filedInBy", {
                        author: book.author,
                        collection: book.collection,
                      })
                    : tr("library.collections.filedIn", {
                        collection: book.collection,
                      })}
                </Text>
              </Box>
              <Box bg={t.accentSoft} paddingX={10} paddingY={4} rounded={20}>
                <Text color={t.accentText} size={11} weight="500">
                  {book.kind}
                </Text>
              </Box>
            </Box>
          </Tap>
        ))
      )}

    </>
  );
}

const SPIN_MS = 900;

function SpinningSync({
  color,
  spinning,
}: {
  color: string;
  spinning: boolean;
}) {
  const angle = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  useEffect(() => {
    if (!spinning) {
      cancelAnimation(angle);
      angle.set(withTiming(0, { duration: 150 }));
      return;
    }
    angle.set(0);
    angle.set(
      withRepeat(
        withTiming(360, { duration: SPIN_MS, easing: Easing.linear }),
        -1,
      ),
    );
  }, [angle, spinning]);

  return (
    <Animated.View style={[style, { height: 16, width: 16 }]}>
      <IconSync color={color} size={16} />
    </Animated.View>
  );
}
