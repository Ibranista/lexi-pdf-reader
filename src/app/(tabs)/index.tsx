import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, RefreshControl, ScrollView } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  HeaderButton,
  IconSearch,
  IconSliders,
  ProtoScreen,
  SwipeTabsBar,
  SwipeTabsPager,
  Tap,
  Text,
  useSwipeTabs,
  type SwipeTabItem,
} from "@/components/lexi-components";
import { CollectionPicker } from "@/components/library/CollectionPicker";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import type { CollectionId } from "@/constants/collections";
import { bookCoverFromUri, bookReadUrl } from "@/hooks/use-book-suggestions";
import { useDeviceLibrary } from "@/hooks/use-device-library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import type { FilableDoc } from "@/stores/collections-store";
import { useProtoTheme } from "@/theme/proto";

import { AllTab as AllLibraryTab } from "./library/all-tab";
import { CollectionsTab } from "./library/collections-tab";
import { FilesTab as FilesLibraryTab } from "./library/files-tab";
import { NotesTab as NotesLibraryTab } from "./library/notes-tab";
import { RecentTab as RecentLibraryTab } from "./library/recent-tab";
import { SearchResults as SearchLibraryResults } from "./library/search-results";

type LibTab = "all" | "coll" | "files" | "recent" | "vocab";

const TAB_KEYS = ["recent", "all", "coll", "files", "vocab"] as const;

export default function LibraryScreen() {
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        if (settingsOpen) {
          setSettingsOpen(false);
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
      settingsOpen,
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

  const TAB_ITEMS: SwipeTabItem<LibTab>[] = [
    { key: "recent", label: tr("tabItems.recent") },
    { key: "all", label: tr("tabItems.all") },
    { key: "coll", label: tr("tabItems.collections"), flex: 1.4 },
    { key: "files", label: tr("tabItems.files") },
    { key: "vocab", label: tr("tabItems.vocab") },
  ];

  const tabs = useSwipeTabs<LibTab>({
    keys: TAB_KEYS,
    onChange: setTab,
    value: tab,
  });

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const renderSettings = useCallback(
    () => <SettingsPanel onClose={closeSettings} />,
    [closeSettings],
  );

  const openReader = () => router.push("/reader");
  const openBook = (book: { cover?: string; url: string; title: string }) =>
    router.push({
      pathname: "/book",
      params: { cover: book.cover, url: book.url, title: book.title },
    });
  const openDoc = (doc: { uri: string; name: string; ext: string }) => {
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
  };
  const openCollections = (doc: FilableDoc) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFiling(doc);
  };

  const contentPad = {
    padding: 20,
    paddingTop: searching ? 16 : 18,
    paddingBottom: 90 + insets.bottom,
  };
  const renderRefresh = () => (
    <RefreshControl
      colors={[t.accent]}
      onRefresh={onRefresh}
      progressBackgroundColor={t.card}
      refreshing={refreshing}
      tintColor={t.sub}
    />
  );

  return (
    <Drawer
      drawerStyle={{ width: "100%" }}
      drawerType="slide"
      onClose={closeSettings}
      onOpen={openSettings}
      open={settingsOpen}
      renderDrawerContent={renderSettings}
      swipeEdgeWidth={40}
    >
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
                <HeaderButton onPress={openSettings}>
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
            query={query}
            refreshControl={renderRefresh()}
          />
        ) : (
          <SwipeTabsPager
            renderTab={(key) =>
              key === "all" ? (
                <AllLibraryTab
                  contentPad={contentPad}
                  lib={lib}
                  openCollections={openCollections}
                  openDoc={openDoc}
                  refreshControl={renderRefresh()}
                />
              ) : key === "files" ? (
                <FilesLibraryTab
                  contentPad={contentPad}
                  lib={lib}
                  openCollections={openCollections}
                  openDoc={openDoc}
                  openUri={openFolderUri}
                  refreshControl={renderRefresh()}
                  setOpenUri={setOpenFolderUri}
                />
              ) : (
                <ScrollView
                  contentContainerStyle={contentPad}
                  refreshControl={renderRefresh()}
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
              )
            }
            tabs={tabs}
          />
        )}

        {filing ? (
          <CollectionPicker doc={filing} onClose={() => setFiling(null)} />
        ) : null}
      </ProtoScreen>
    </Drawer>
  );
}
