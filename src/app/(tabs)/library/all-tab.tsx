import { FlashList } from "@shopify/flash-list";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  IconChevron,
  IconFolder,
  IndeterminateBar,
  Tap,
  Text,
} from "@/components/lexi-components";
import { anchorOf } from "@/components/library/AnchoredPopover";
import {
  sortByLibrarySort,
  type DeviceDoc,
  type DeviceLibrary,
} from "@/hooks/use-device-library";
import { useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

import {
  docMeta,
  DocRow,
  DotsButton,
  GRID_COLUMNS,
  PdfThumb,
  SortBar,
  SwipeToFavorite,
  type OpenCollections,
  type OpenDocMenu,
  type ScrollerProps,
} from "./shared";

export function AllTab({
  contentPad,
  lib,
  openCollections,
  openDoc,
  openDocMenu,
  refreshControl,
}: ScrollerProps & {
  lib: DeviceLibrary;
  openCollections: OpenCollections;
  openDoc: (doc: DeviceDoc) => void;
  openDocMenu: OpenDocMenu;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const { access, ensureAccess, docs, pickFolder, scanning, scanProgress } =
    lib;
  const sort = useAppStore((s) => s.librarySort);
  const view = useAppStore((s) => s.libraryView);
  const sorted = useMemo(() => sortByLibrarySort(docs, sort), [docs, sort]);

  const header =
    docs.length > 0 ? (
      <>
        {access === "denied" ? (
          <Tap onPress={ensureAccess}>
            <Box
              align="center"
              bg={t.accentSoft}
              direction="row"
              gap={12}
              marginBottom={16}
              paddingX={14}
              paddingY={12}
              rounded={12}
            >
              <IconFolder color={t.accentText} size={17} />
              <Box flex={1}>
                <Text color={t.accentText} size={13} weight="600">
                  {tr("library.all.allowBtn")}
                </Text>
                <Text color={t.sub} size={11.5} style={{ marginTop: 2 }}>
                  {tr("library.all.allowBannerSub")}
                </Text>
              </Box>
              <IconChevron color={t.accentText} size={15} />
            </Box>
          </Tap>
        ) : null}
        <SortBar />
      </>
    ) : null;

  const empty =
    scanning && docs.length === 0 ? (
      <Box gap={14} paddingX={12} paddingY={48}>
        <Box align="center" gap={6}>
          <Text size={15} weight="600">
            {tr("library.all.scanning")}
          </Text>
          <Text color={t.sub} size={13}>
            {tr("library.all.scanningCount", { count: scanProgress })}
          </Text>
        </Box>
        <IndeterminateBar />
      </Box>
    ) : (
      <Box align="center" gap={10} paddingX={24} paddingY={44}>
        <IconFolder color={t.faint} size={26} />
        <Text size={15} weight="600">
          {access === "denied"
            ? tr("library.all.allowTitle")
            : tr("library.all.emptyTitle")}
        </Text>
        <Text align="center" color={t.sub} lh={21} size={13}>
          {access === "denied"
            ? tr("library.all.allowBody")
            : tr("library.all.emptyBody")}
        </Text>
        {access !== "granted" ? (
          <Tap
            onPress={access === "unavailable" ? pickFolder : ensureAccess}
            scale={0.95}
            style={{ marginTop: 8 }}
          >
            <Box bg={t.accent} paddingX={16} paddingY={11} rounded={12}>
              <Text color={t.onAccent} size={13} weight="600">
                {access === "unavailable"
                  ? tr("library.all.chooseFolderBtn")
                  : tr("library.all.allowBtn")}
              </Text>
            </Box>
          </Tap>
        ) : null}
      </Box>
    );

  const grid = view === "grid";

  return (
    <FlashList
      // Remounts on layout change: FlashList can't recycle cells across a
      // column-count switch, and the row/cell shapes share no geometry.
      key={view}
      ListEmptyComponent={empty}
      ListHeaderComponent={header}
      contentContainerStyle={
        grid ? { ...contentPad, paddingLeft: 13, paddingRight: 13 } : contentPad
      }
      data={sorted}
      keyExtractor={(doc) => doc.uri}
      numColumns={grid ? GRID_COLUMNS : 1}
      refreshControl={refreshControl}
      style={{ flex: 1 }}
      renderItem={({ item }) =>
        grid ? (
          <Tap
            onLongPress={(e) => openCollections(item, anchorOf(e))}
            onPress={() => openDoc(item)}
            scale={0.96}
            style={{ paddingHorizontal: 7, paddingBottom: 16 }}
          >
            <Box gap={7}>
              <Box>
                <PdfThumb doc={item} style={{ aspectRatio: 3 / 4 }} />
                {/* scrim keeps the dots readable over any cover art */}
                <Box style={{ position: "absolute", right: 4, top: 4 }}>
                  <DotsButton
                    bg="rgba(20,16,12,0.45)"
                    color="#FFFFFF"
                    onPress={(anchor) => openDocMenu(item, anchor)}
                  />
                </Box>
              </Box>
              <Box gap={2}>
                <Text lh={15} numberOfLines={2} size={11.5} weight="500">
                  {item.name}
                </Text>
                <Text color={t.faint} size={10}>
                  {docMeta(item.size, item.modifiedAt)}
                </Text>
              </Box>
            </Box>
          </Tap>
        ) : (
          <SwipeToFavorite doc={item}>
            <DocRow
              doc={item}
              meta={docMeta(item.size, item.modifiedAt)}
              onLongPress={(e) => openCollections(item, anchorOf(e))}
              onMore={(anchor) => openDocMenu(item, anchor)}
              onPress={() => openDoc(item)}
            />
          </SwipeToFavorite>
        )
      }
    />
  );
}
