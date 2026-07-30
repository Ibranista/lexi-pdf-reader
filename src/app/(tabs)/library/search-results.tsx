import { FlashList } from "@shopify/flash-list";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import { IconSearch, SectionLabel, Text } from "@/components/lexi-components";
import { anchorOf } from "@/components/library/AnchoredPopover";
import { COLLECTION_META } from "@/constants/collections";
import type { DeviceLibrary } from "@/hooks/use-device-library";
import { useCollectionsStore } from "@/stores/collections-store";
import { useRecentsStore } from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";

import {
  docMeta,
  DocRow,
  SwipeToFavorite,
  type OpenCollections,
  type OpenDocMenu,
  type ScrollerProps,
} from "./shared";

interface SearchDoc {
  uri: string;
  name: string;
  ext: string;
  size: number;
  modifiedAt: number | null;
  where: string;
}

function rank(name: string, q: string): number {
  const lower = name.toLowerCase();
  if (lower.startsWith(q)) return 0;
  if (/[\s\-_·—]/.test(lower.charAt(lower.indexOf(q) - 1))) return 1;
  return 2;
}

function matches(doc: SearchDoc, tokens: string[]): boolean {
  const hay = `${doc.name} ${doc.ext}`.toLowerCase();
  return tokens.every((token) => hay.includes(token));
}

function folderLabel(uri: string): string {
  const trimmed = uri.replace(/\/+$/, "");
  return decodeURIComponent(trimmed.slice(trimmed.lastIndexOf("/") + 1));
}

export function SearchResults({
  contentPad,
  lib,
  openCollections,
  openDoc,
  openDocMenu,
  query,
  refreshControl,
}: ScrollerProps & {
  lib: DeviceLibrary;
  openCollections: OpenCollections;
  openDoc: (doc: { uri: string; name: string; ext: string }) => void;
  openDocMenu: OpenDocMenu;
  query: string;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const q = query.trim().toLowerCase();
  const { docs, folders, scanning } = lib;
  const recents = useRecentsStore((s) => s.recents);
  const shelves = useCollectionsStore((s) => s.items);

  const corpus = useMemo(() => {
    const folderNames = new Map(folders.map((f) => [f.uri, f.name]));
    const byUri = new Map<string, SearchDoc>();

    for (const doc of docs) {
      byUri.set(doc.uri, {
        uri: doc.uri,
        name: doc.name,
        ext: doc.ext,
        size: doc.size,
        modifiedAt: doc.modifiedAt,
        where: folderNames.get(doc.folderUri) ?? folderLabel(doc.folderUri),
      });
    }

    for (const doc of recents) {
      if (byUri.has(doc.uri)) continue;
      byUri.set(doc.uri, {
        uri: doc.uri,
        name: doc.name,
        ext: doc.ext,
        size: 0,
        modifiedAt: doc.openedAt,
        where: tr("library.search.where.recent"),
      });
    }

    for (const meta of COLLECTION_META) {
      for (const doc of shelves[meta.id] ?? []) {
        if (byUri.has(doc.uri)) continue;
        byUri.set(doc.uri, {
          uri: doc.uri,
          name: doc.name,
          ext: doc.ext,
          size: 0,
          modifiedAt: doc.addedAt,
          where: tr("library.search.where.filed"),
        });
      }
    }

    return [...byUri.values()];
  }, [docs, folders, recents, shelves, tr]);

  const results = useMemo(() => {
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    return corpus
      .filter((doc) => matches(doc, tokens))
      .sort((a, b) => {
        const byRank = rank(a.name, q) - rank(b.name, q);
        if (byRank !== 0) return byRank;
        return (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0);
      });
  }, [corpus, q]);

  if (!q) {
    return (
      <Box align="center" gap={10} paddingX={24} paddingY={44}>
        <IconSearch color={t.faint} size={26} />
        <Text align="center" color={t.sub} lh={21} size={13}>
          {tr("library.search.emptyPrompt")}
        </Text>
        {scanning ? (
          <Text align="center" color={t.faint} size={12}>
            {tr("library.search.stillScanning")}
          </Text>
        ) : null}
      </Box>
    );
  }

  return (
    <FlashList
      ListEmptyComponent={
        <Box paddingX={24} paddingY={48}>
          <Text align="center" color={t.sub} lh={21} size={13}>
            {scanning
              ? tr("library.search.stillScanning")
              : tr("library.search.noMatch", { query })}
          </Text>
        </Box>
      }
      ListHeaderComponent={
        results.length > 0 ? (
          <Box paddingBottom={10}>
            <SectionLabel>
              {tr("library.search.resultCount", { count: results.length })}
            </SectionLabel>
          </Box>
        ) : null
      }
      contentContainerStyle={contentPad}
      data={results}
      keyExtractor={(doc) => doc.uri}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      style={{ flex: 1 }}
      renderItem={({ item }) => (
        <SwipeToFavorite doc={item}>
          <DocRow
            doc={item}
            meta={docMeta(item.size, item.modifiedAt)}
            onLongPress={(e) => openCollections(item, anchorOf(e))}
            onMore={
              item.uri.startsWith("file://")
                ? (anchor) => openDocMenu(item, anchor)
                : undefined
            }
            onPress={() => openDoc(item)}
            trailing={
              <Box bg={t.chip} paddingX={10} paddingY={4} rounded={20}>
                <Text color={t.faint} numberOfLines={1} size={10.5} weight="500">
                  {item.where}
                </Text>
              </Box>
            }
          />
        </SwipeToFavorite>
      )}
    />
  );
}
