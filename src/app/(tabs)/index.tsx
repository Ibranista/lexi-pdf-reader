import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, RefreshControl, ScrollView } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  DRAWER_EDGE,
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

// Memoised so a LibraryScreen re-render — tab commit, drawer toggle, scan
// tick — skips every mounted page whose props haven't changed.
const AllLibraryTab = memo(AllTabBase);
const CollectionsTab = memo(CollectionsTabBase);
const FilesLibraryTab = memo(FilesTabBase);
const NotesLibraryTab = memo(NotesTabBase);
const RecentLibraryTab = memo(RecentTabBase);

type LibTab = "all" | "coll" | "files" | "recent" | "vocab";

/** Left-to-right order of the tabs — the order you swipe through them. */
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
  // lifted out of FilesTab so the hardware back button can unwind it
  const [openFolderUri, setOpenFolderUri] = useState<string | null>(null);
  // likewise for the collection being drilled into
  const [openShelf, setOpenShelf] = useState<CollectionId | null>(null);
  // the document whose "add to collection" sheet is open, if any
  const [filing, setFiling] = useState<FilableDoc | null>(null);
  // the document whose ⋮ actions menu (rename / share / delete) is open
  const [menuDoc, setMenuDoc] = useState<FilableDoc | null>(null);
  // Touch points the two popovers open around; undefined falls back to centred.
  const [menuAnchor, setMenuAnchor] = useState<Anchor | undefined>(undefined);
  const [filingAnchor, setFilingAnchor] = useState<Anchor | undefined>(undefined);
  // whether the Settings drawer is showing
  const [settingsOpen, setSettingsOpen] = useState(false);

  // pull-to-refresh: re-scan the device for documents. `refreshing` is
  // derived rather than stored, so the spinner clears itself when the scan
  // ends — no effect writing state back on every scan transition.
  const [pulled, setPulled] = useState(false);
  const refreshing = pulled && lib.scanning;
  const onRefresh = useCallback(() => {
    setPulled(true);
    lib.refresh();
  }, [lib]);

  /**
   * Android hardware back: unwind in-screen state before leaving the app —
   * search, then an open folder. Only when there's nothing left to undo does
   * back exit, and then it asks for a confirming second press.
   */
  const exitArmed = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;

      const onBack = () => {
        if (settingsOpen) {
          setSettingsOpen(false);
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
      settingsOpen,
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

  // ask for device-wide storage access once, on first open of the library
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

  // Drives both the bar and the pages below it, so the pill and the content
  // move together under the finger.
  const tabs = useSwipeTabs<LibTab>({
    keys: TAB_KEYS,
    onChange: setTab,
    value: tab,
  });

  // Settings rides in as a left drawer rather than a pushed route, so the
  // swipe can track the finger. Shared by the header icon and the edge swipe.
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  // stable identity, so the memoised panel is genuinely skipped when this
  // screen re-renders mid-drag rather than being rebuilt each time
  const renderSettings = useCallback(
    () => <SettingsPanel onClose={closeSettings} />,
    [closeSettings],
  );

  const openReader = useCallback(() => router.push("/reader"), []);
  // Opens a suggested book's full text in the in-app web reader. The cover
  // rides along so the book can be filed on the Recent shelf with its art.
  const openBook = useCallback(
    (book: { cover?: string; url: string; title: string }) =>
      router.push({
        pathname: "/book",
        params: { cover: book.cover, url: book.url, title: book.title },
      }),
    [],
  );
  // Open formats that have a native reader. Other indexed formats remain
  // visible in the library until their readers are added.
  const openDoc = useCallback(
    (doc: { uri: string; name: string; ext: string }) => {
      // A book filed from the suggestions shelf — its uri is the readable page
      // with the cover packed on, so strip that back off before loading it.
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
        // the reader records the open itself, so every entry point counts
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
  // long-press anywhere a document is listed: file it into a collection.
  // The anchor is where the finger landed, so the picker opens beside the
  // document instead of in the corner of the screen.
  const openCollections = useCallback((doc: FilableDoc, anchor?: Anchor) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFilingAnchor(anchor);
    setFiling(doc);
  }, []);
  // ⋮ anywhere a document is listed: rename, share or delete it
  const openDocMenu = useCallback((doc: FilableDoc, anchor?: Anchor) => {
    setMenuAnchor(anchor);
    setMenuDoc(doc);
  }, []);

  // Shared by every tab's scroller. One memoised refresh element serves them
  // all — a React element is just a description, so the same one can sit in
  // several scrollers at once; each mounts its own native control.
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

  // Stable so mid-drag re-renders hand the pager the same function, and the
  // memoised pages inside actually get to bail out.
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
    <Drawer
      drawerStyle={{ width: "100%" }}
      // `slide` moves the library along with the panel, so you watch it leave
      // as you pull Settings in — the panel still lands full-screen at rest.
      drawerType="slide"
      onClose={closeSettings}
      onOpen={openSettings}
      open={settingsOpen}
      renderDrawerContent={renderSettings}
      swipeEdgeWidth={DRAWER_EDGE}
    >
      <ProtoScreen>
        {/* top icon row */}
        {/* <Box
          align="center"
          direction="row"
          justify="between"
          paddingLeft={20}
          paddingRight={20}
          paddingTop={8}
        > */}

        {/* <Box direction="row" gap={10}>
            <HeaderButton onPress={() => router.push("/today")}>
              <IconSun color={t.ink} size={19} />
            </HeaderButton>
            <HeaderButton
              bg={t.accentSoft}
              noBorder
              onPress={() =>
                showToast(tr("library.signedInAs", { name: "Selam B." }))
              }
            >
              <Text color={t.accentText} size={14} weight="600">
                SB
              </Text>
            </HeaderButton>
          </Box> */}
        {/* </Box> */}

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
            {/* title row */}
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

            {/* tabs */}
            <Box marginTop={14} paddingLeft={20} paddingRight={20}>
              <SwipeTabsBar items={TAB_ITEMS} tabs={tabs} />
            </Box>
          </>
        )}

        {/* Search takes over the whole body; otherwise the tabs sit side by
          side in the pager, one screen apart. All and Files own their
          scroller — a FlashList can't be nested in a ScrollView, and those are
          the views long enough to need one. The short, fixed-length tabs get a
          plain ScrollView each. */}
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
    </Drawer>
  );
}
