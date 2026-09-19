import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  HeaderButton,
  IconSearch,
  IconSliders,
  ProtoScreen,
  SlideDrawer,
  SwipeTabsBar,
  SwipeTabsPager,
  Tap,
  Text,
  useSwipeTabs,
  type SwipeTabItem,
} from "@/components/lexi-components";
import type { Anchor } from "@/components/library/AnchoredPopover";
import { CollectionPicker } from "@/components/library/CollectionPicker";
import { DocMenu } from "@/components/library/DocMenu";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import type { CollectionId } from "@/constants/collections";
import { bookCoverFromUri, bookReadUrl } from "@/hooks/use-book-suggestions";
import { useDeviceLibrary } from "@/hooks/use-device-library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import type { FilableDoc } from "@/stores/collections-store";
import { useProtoTheme } from "@/theme/proto";

import { AllTab as AllTabBase } from "./library/all-tab";
import { CollectionsTab as CollectionsTabBase } from "./library/collections-tab";
import { FilesTab as FilesTabBase } from "./library/files-tab";
import { NotesTab as NotesTabBase } from "./library/notes-tab";
import { RecentTab as RecentTabBase } from "./library/recent-tab";
import { SearchResults as SearchLibraryResults } from "./library/search-results";

const AllLibraryTab = memo(AllTabBase);
const CollectionsTab = memo(CollectionsTabBase);
const FilesLibraryTab = memo(FilesTabBase);
const NotesLibraryTab = memo(NotesTabBase);
const RecentLibraryTab = memo(RecentTabBase);

type LibTab = "all" | "coll" | "files" | "recent" | "vocab";

const TAB_KEYS = ["recent", "all", "coll", "files", "vocab"] as const;

export default function LibraryScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsOpenRef = useRef(false);
  const openSettings = useCallback(() => {
    settingsOpenRef.current = true;
    setSettingsOpen(true);
  }, []);
  const closeSettings = useCallback(() => {
    settingsOpenRef.current = false;
    setSettingsOpen(false);
  }, []);
  const closeSettingsIfOpen = useCallback(() => {
    if (!settingsOpenRef.current) return false;
    closeSettings();
    return true;
  }, [closeSettings]);
  const renderSettings = useCallback(
    () => <SettingsPanel onClose={closeSettings} />,
    [closeSettings],
  );

  return (
    <SlideDrawer
      onClose={closeSettings}
      onOpen={openSettings}
      open={settingsOpen}
      renderPanel={renderSettings}
    >
      <LibraryContent
        closeSettingsIfOpen={closeSettingsIfOpen}
        openSettings={openSettings}
      />
    </SlideDrawer>
  );
}

const LibraryContent = memo(function LibraryContent({
  closeSettingsIfOpen,
  openSettings,
}: {
  closeSettingsIfOpen: () => boolean;
  openSettings: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const [tab, setTab] = useState<LibTab>("recent");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const lib = useDeviceLibrary();
  const storageAsked = useAppStore((s) => s.storageAsked);
  const { access, ensureAccess } = lib;
  const [openFolderUri, setOpenFolderUri] = useState<string | null>(null);
  const [openShelf, setOpenShelf] = useState<CollectionId | null>(null);
  const [filing, setFiling] = useState<FilableDoc | null>(null);
  const [menuDoc, setMenuDoc] = useState<FilableDoc | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<Anchor | undefined>(undefined);
  const [filingAnchor, setFilingAnchor] = useState<Anchor | undefined>(
    undefined,
  );

  const [pulled, setPulled] = useState(false);
  const refreshing = pulled && lib.scanning;
  const onRefresh = useCallback(() => {
    setPulled(true);
    lib.refresh();
  }, [lib]);

  const exitArmed = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const onBack = () => {
        if (closeSettingsIfOpen()) {
          exitArmed.current = false;
          clearTimeout(timer);
          return true;
        }
        if (menuDoc) {
          setMenuDoc(null);
          return true;
        }
        if (filing) {
          setFiling(null);
          return true;
        }
        if (searching) {
          setSearching(false);
          setQuery("");
          return true;
        }
        if (tab === "files" && openFolderUri) {
          setOpenFolderUri(null);
          return true;
        }
        if (tab === "coll" && openShelf) {
          setOpenShelf(null);
          return true;
        }
        if (exitArmed.current) return false; // second press — let it exit
        exitArmed.current = true;
        showToast(tr("library.exitConfirm"));
        timer = setTimeout(() => {
          exitArmed.current = false;
        }, 2000);
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => {
        sub.remove();
        clearTimeout(timer);
        exitArmed.current = false;
      };
    }, [
      closeSettingsIfOpen,
      menuDoc,
      filing,
      searching,
      tab,
      openFolderUri,
      openShelf,
      showToast,
      tr,
    ]),
  );

  useEffect(() => {
    if (!storageAsked && access === "denied") {
      useAppStore.getState().set({ storageAsked: true });
      ensureAccess();
    }
  }, [storageAsked, access, ensureAccess]);

  const TAB_ITEMS = useMemo<SwipeTabItem<LibTab>[]>(
    () => [
      { key: "recent", label: tr("tabItems.recent") },
      { key: "all", label: tr("tabItems.all") },
      { key: "coll", label: tr("tabItems.collections"), flex: 1.4 },
      { key: "files", label: tr("tabItems.files") },
      { key: "vocab", label: tr("tabItems.vocab") },
    ],
    [tr],
  );

  const tabs = useSwipeTabs<LibTab>({
    keys: TAB_KEYS,
    onChange: setTab,
    value: tab,
  });

  const openReader = useCallback(() => router.push("/reader"), []);
  const openBook = useCallback(
    (book: { cover?: string; url: string; title: string }) =>
      router.push({
        pathname: "/book",
        params: { cover: book.cover, url: book.url, title: book.title },
      }),
    [],
  );
  const openDoc = useCallback(
    (doc: { uri: string; name: string; ext: string }) => {
      if (doc.ext === "BOOK") {
        router.push({
          pathname: "/book",
          params: {
            cover: bookCoverFromUri(doc.uri),
            title: doc.name,
            url: bookReadUrl(doc.uri),
          },
        });
        return;
      }
      if (doc.ext === "PDF") {
        router.push({
          pathname: "/pdf",
          params: { uri: doc.uri, name: doc.name },
        });
        return;
      }
      if (doc.ext === "TXT" || doc.ext === "MD" || doc.ext === "DOCX") {
        router.push({
          pathname: "/text",
          params: { uri: doc.uri, name: doc.name, ext: doc.ext },
        });
        return;
      }
      showToast(tr("library.docViewer.pdfOnly", { ext: doc.ext }));
    },
    [showToast, tr],
  );
  const openCollections = useCallback((doc: FilableDoc, anchor?: Anchor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFilingAnchor(anchor);
    setFiling(doc);
  }, []);
  const openDocMenu = useCallback((doc: FilableDoc, anchor?: Anchor) => {
    setMenuAnchor(anchor);
    setMenuDoc(doc);
  }, []);

  const contentPad = useMemo(
    () => ({
      padding: 20,
      paddingTop: searching ? 16 : 18,
      paddingBottom: 90 + insets.bottom,
    }),
    [insets.bottom, searching],
  );
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        colors={[t.accent]}
        onRefresh={onRefresh}
        progressBackgroundColor={t.card}
        refreshing={refreshing}
        tintColor={t.sub}
      />
    ),
    [onRefresh, refreshing, t],
  );

  const renderTab = useCallback(
    (key: LibTab) =>
      key === "all" ? (
        <AllLibraryTab
          contentPad={contentPad}
          lib={lib}
          openCollections={openCollections}
          openDoc={openDoc}
          openDocMenu={openDocMenu}
          refreshControl={refreshControl}
        />
      ) : key === "files" ? (
        <FilesLibraryTab
          contentPad={contentPad}
          lib={lib}
          openCollections={openCollections}
          openDoc={openDoc}
          openDocMenu={openDocMenu}
          openUri={openFolderUri}
          refreshControl={refreshControl}
          setOpenUri={setOpenFolderUri}
        />
      ) : (
        <ScrollView
          contentContainerStyle={contentPad}
          refreshControl={refreshControl}
          style={{ flex: 1 }}
        >
          {key === "recent" ? (
            <RecentLibraryTab
              openCollections={openCollections}
              openDoc={openDoc}
            />
          ) : key === "coll" ? (
            <CollectionsTab
              openBook={openBook}
              openCollection={setOpenShelf}
              openCollections={openCollections}
              openDoc={openDoc}
              shelf={openShelf}
            />
          ) : (
            <NotesLibraryTab openReader={openReader} />
          )}
        </ScrollView>
      ),
    [
      contentPad,
      lib,
      openBook,
      openCollections,
      openDoc,
      openDocMenu,
      openFolderUri,
      openReader,
      openShelf,
      refreshControl,
    ],
  );

  return (
    <ProtoScreen>

      {searching ? (
        <Box
          align="center"
          direction="row"
          gap={10}
          paddingLeft={20}
          paddingRight={20}
          paddingTop={14}
        >
          <Box
            align="center"
            bg={t.card}
            borderColor={t.line}
            borderWidth={1}
            direction="row"
            flex={1}
            gap={9}
            paddingX={14}
            rounded={12}
          >
            <IconSearch color={t.sub} size={16} />
            <TextInput
              autoFocus
              backgroundColor="transparent"
              borderColor="transparent"
              borderWidth={0}
              fontSize={14.5}
              onChangeText={setQuery}
              placeholder={tr("library.searchPlaceholder")}
              placeholderTextColor={t.faint}
              pl={0}
              py={12}
              rounded={0}
              style={{ flex: 1, height: undefined }}
              textColor={t.ink}
              value={query}
            />
          </Box>
          <Tap
            onPress={() => {
              setSearching(false);
              setQuery("");
            }}
          >
            <Text color={t.accentText} size={14} weight="500">
              {tr("library.cancel")}
            </Text>
          </Tap>
        </Box>
      ) : (
        <>
          <Box
            align="center"
            direction="row"
            justify="between"
            paddingLeft={20}
            paddingRight={20}
            paddingTop={18}
          >
            <Box direction="row" align="center" gap={10}>
              <HeaderButton
                onPress={() => {
                  exitArmed.current = false;
                  openSettings();
                }}
              >
                <IconSliders bg={t.bg} color={t.ink} size={20} />
              </HeaderButton>
              <Text ls={-0.3} serif size={30} weight="600">
                {tr("library.title")}
              </Text>
            </Box>
            <HeaderButton onPress={() => setSearching(true)}>
              <IconSearch color={t.ink} size={19} />
            </HeaderButton>
          </Box>

          <Box marginTop={14} paddingLeft={20} paddingRight={20}>
            <SwipeTabsBar items={TAB_ITEMS} tabs={tabs} />
          </Box>
        </>
      )}

      {searching ? (
        <SearchLibraryResults
          contentPad={contentPad}
          lib={lib}
          openCollections={openCollections}
          openDoc={openDoc}
          openDocMenu={openDocMenu}
          query={query}
          refreshControl={refreshControl}
        />
      ) : (
        <SwipeTabsPager renderTab={renderTab} tabs={tabs} />
      )}

      {filing ? (
        <CollectionPicker
          anchor={filingAnchor}
          doc={filing}
          onClose={() => setFiling(null)}
        />
      ) : null}

      {menuDoc ? (
        <DocMenu
          anchor={menuAnchor}
          doc={menuDoc}
          onChanged={lib.refresh}
          onClose={() => setMenuDoc(null)}
        />
      ) : null}
    </ProtoScreen>
  );
});
