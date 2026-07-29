import { FlashList } from "@shopify/flash-list";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  IconBack,
  IconChevron,
  IconFolder,
  IconPlus,
  Tap,
  Text,
} from "@/components/lexi-components";
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
  SortBar,
  SwipeToFavorite,
  type OpenCollections,
  type OpenDocMenu,
  type ScrollerProps,
} from "./shared";

export function FilesTab({
  contentPad,
  lib,
  openCollections,
  openDoc,
  openDocMenu,
  openUri,
  refreshControl,
  setOpenUri,
}: ScrollerProps & {
  lib: DeviceLibrary;
  openCollections: OpenCollections;
  openDoc: (doc: DeviceDoc) => void;
  openDocMenu: OpenDocMenu;
  openUri: string | null;
  setOpenUri: (uri: string | null) => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const libRootName = useAppStore((s) => s.libRootName);
  const { access, ensureAccess, folders, docs, pickFolder, scanning } = lib;
  const sort = useAppStore((s) => s.librarySort);
  const sortedFolders = useMemo(
    () => sortByLibrarySort(folders, sort),
    [folders, sort],
  );

  const folderLabel = (f: {
    isAppStorage: boolean;
    isDeviceRoot: boolean;
    name: string;
  }) =>
    f.isAppStorage
      ? tr("library.files.appStorage")
      : f.isDeviceRoot
        ? tr("library.files.internalStorage")
        : f.name;

  const openFolder = folders.find((f) => f.uri === openUri);

  if (openFolder) {
    const folderDocs = sortByLibrarySort(
      docs.filter((d) => d.folderUri === openFolder.uri),
      sort,
    );
    return (
      <FlashList
        ListEmptyComponent={
          <Text color={t.sub} size={13} style={{ paddingTop: 12 }}>
            {tr("library.files.folderEmpty")}
          </Text>
        }
        ListHeaderComponent={
          <>
            <Tap onPress={() => setOpenUri(null)}>
              <Box align="center" direction="row" gap={8} paddingBottom={14}>
                <IconBack color={t.accentText} size={16} />
                <Text color={t.accentText} size={13} weight="600">
                  {tr("library.files.allFolders")}
                </Text>
              </Box>
            </Tap>
            <Box paddingBottom={8}>
              <Text size={13} weight="600">
                {folderLabel(openFolder)}
              </Text>
            </Box>
            {folderDocs.length ? <SortBar /> : null}
          </>
        }
        contentContainerStyle={contentPad}
        data={folderDocs}
        keyExtractor={(doc) => doc.uri}
        refreshControl={refreshControl}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <SwipeToFavorite doc={item}>
            <DocRow
              doc={item}
              meta={docMeta(item.size, item.modifiedAt)}
              onLongPress={() => openCollections(item)}
              onMore={() => openDocMenu(item)}
              onPress={() => openDoc(item)}
            />
          </SwipeToFavorite>
        )}
      />
    );
  }

  const header = (
    <>
      <Box paddingBottom={8}>
        <Text size={13} weight="600">
          {tr("library.files.onThisDevice")}
        </Text>
      </Box>

      {folders.length ? <SortBar /> : null}

      {access === "denied" ? (
        <Tap onPress={ensureAccess}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={14}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Box
              align="center"
              bg={t.accentSoft}
              height={42}
              justify="center"
              rounded={11}
              width={42}
            >
              <IconFolder color={t.accentText} size={19} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                {tr("library.files.allowAccess")}
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                {tr("library.files.allowAccessSub")}
              </Text>
            </Box>
            <IconChevron color={t.faint} size={16} />
          </Box>
        </Tap>
      ) : access === "unavailable" ? (
        <Tap onPress={pickFolder}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={14}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Box
              align="center"
              bg={t.chip}
              height={42}
              justify="center"
              rounded={11}
              width={42}
            >
              <IconPlus color={t.ink} size={17} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                {libRootName
                  ? tr("library.files.scanningFolder", { name: libRootName })
                  : tr("library.files.chooseFolder")}
              </Text>
            </Box>
            <IconChevron color={t.faint} size={16} />
          </Box>
        </Tap>
      ) : null}
    </>
  );

  return (
    <FlashList
      ListEmptyComponent={
        scanning ? (
          <Box align="center" paddingY={28}>
            <Text color={t.sub} size={13}>
              {tr("library.all.scanning")}
            </Text>
          </Box>
        ) : (
          <Box align="center" paddingX={24} paddingY={28}>
            <Text align="center" color={t.sub} lh={21} size={13}>
              {tr("library.files.empty")}
            </Text>
          </Box>
        )
      }
      ListHeaderComponent={header}
      contentContainerStyle={contentPad}
      data={sortedFolders}
      keyExtractor={(f) => f.uri}
      refreshControl={refreshControl}
      style={{ flex: 1 }}
      renderItem={({ item }) => (
        <Tap onPress={() => setOpenUri(item.uri)}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={14}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Box
              align="center"
              bg={t.accentSoft}
              height={42}
              justify="center"
              rounded={11}
              width={42}
            >
              <IconFolder color={t.accentText} size={19} />
            </Box>
            <Box flex={1}>
              <Text numberOfLines={1} size={14} weight="600">
                {folderLabel(item)}
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                {tr("library.files.docCount", { count: item.docCount })}
              </Text>
            </Box>
            <IconChevron color={t.faint} size={16} />
          </Box>
        </Tap>
      )}
    />
  );
}
