import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  HeaderButton,
  IconBrain,
  IconPlus,
  IconSearch,
  IconSliders,
  IconSun,
  ProtoScreen,
  Segmented,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useDeviceLibrary } from "@/hooks/use-device-library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

import { AllTab as AllLibraryTab } from "./library/all-tab";
import { CollectionsTab as CollectionsLibraryTab } from "./library/collections-tab";
import { FilesTab as FilesLibraryTab } from "./library/files-tab";
import { RecentTab as RecentLibraryTab } from "./library/recent-tab";
import { SearchResults as SearchLibraryResults } from "./library/search-results";
import { VocabTab as VocabLibraryTab } from "./library/vocab-tab";

type LibTab = "all" | "coll" | "files" | "recent" | "vocab";

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
        if (searching) {
          setSearching(false);
          setQuery("");
          return true;
        }
        if (tab === "files" && openFolderUri) {
          setOpenFolderUri(null);
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
    }, [searching, tab, openFolderUri, showToast, tr]),
  );

  // ask for device-wide storage access once, on first open of the library
  useEffect(() => {
    if (!storageAsked && access === "denied") {
      useAppStore.getState().set({ storageAsked: true });
      ensureAccess();
    }
  }, [storageAsked, access, ensureAccess]);

  const importDocuments = async () => {
    const count = await lib.importDocuments();
    if (count !== null) showToast(tr("library.importedToast", { count }));
  };

  const TAB_ITEMS = [
    { key: "recent" as const, label: tr("tabItems.recent") },
    { key: "all" as const, label: tr("tabItems.all") },
    { key: "coll" as const, label: tr("tabItems.collections"), flex: 1.4 },
    { key: "files" as const, label: tr("tabItems.files") },
    { key: "vocab" as const, label: tr("tabItems.vocab") },
  ];

  const openReader = () => router.push("/reader");
  // open a real on-device document — PDFs render in the native viewer
  const openDoc = (doc: { uri: string; name: string; ext: string }) => {
    if (doc.ext !== "PDF") {
      showToast(tr("library.docViewer.pdfOnly", { ext: doc.ext }));
      return;
    }
    // the reader records the open itself, so every entry point counts
    router.push({ pathname: "/pdf", params: { uri: doc.uri, name: doc.name } });
  };
  const openDemo = (name: string) =>
    showToast(tr("library.demoToast", { name }));

  // Shared by every tab's scroller, whichever component owns it. The refresh
  // control is built per render rather than held in a variable — only one
  // branch mounts at a time, but each needs its own element.
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
    <ProtoScreen>
      {/* top icon row */}
      <Box
        align="center"
        direction="row"
        justify="between"
        paddingLeft={20}
        paddingRight={20}
        paddingTop={8}
      >
        <HeaderButton onPress={() => router.push("/settings")}>
          <IconSliders bg={t.bg} color={t.ink} size={20} />
        </HeaderButton>
        <Box direction="row" gap={10}>
          <HeaderButton onPress={() => router.push("/today")}>
            <IconSun color={t.ink} size={19} />
          </HeaderButton>
          <HeaderButton onPress={() => router.push("/brain")}>
            <IconBrain color={t.ink} size={19} />
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
        </Box>
      </Box>

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
            <Text ls={-0.3} serif size={30} weight="600">
              {tr("library.title")}
            </Text>
            <HeaderButton onPress={() => setSearching(true)}>
              <IconSearch color={t.ink} size={19} />
            </HeaderButton>
          </Box>

          {/* tabs */}
          <Box marginTop={14} paddingLeft={20} paddingRight={20}>
            <Segmented items={TAB_ITEMS} onChange={setTab} value={tab} />
          </Box>
        </>
      )}

      {/* All and Files own their scroller — a FlashList can't be nested in a
          ScrollView, and those are the two tabs long enough to need one. The
          short, fixed-length tabs stay on a plain ScrollView. */}
      {tab === "all" && !searching ? (
        <AllLibraryTab
          contentPad={contentPad}
          lib={lib}
          openDoc={openDoc}
          refreshControl={renderRefresh()}
        />
      ) : tab === "files" && !searching ? (
        <FilesLibraryTab
          contentPad={contentPad}
          lib={lib}
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
          {searching ? (
            <SearchLibraryResults
              openDemo={openDemo}
              openReader={openReader}
              query={query}
            />
          ) : tab === "recent" ? (
            <RecentLibraryTab openDoc={openDoc} />
          ) : tab === "coll" ? (
            <CollectionsLibraryTab
              openDemo={openDemo}
              openReader={openReader}
            />
          ) : (
            <VocabLibraryTab openReader={openReader} />
          )}
        </ScrollView>
      )}

      {/* import FAB */}
      <Tap
        onPress={importDocuments}
        scale={0.92}
        style={{ position: "absolute", right: 20, bottom: 26 + insets.bottom }}
      >
        <Box
          align="center"
          bg={t.accent}
          height={56}
          justify="center"
          rounded={18}
          style={{
            shadowColor: "#201B15",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 8,
          }}
          width={56}
        >
          <IconPlus color={t.onAccent} size={22} />
        </Box>
      </Tap>
    </ProtoScreen>
  );
}
