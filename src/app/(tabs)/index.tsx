import * as Haptics from "expo-haptics";
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
import { CollectionPicker } from "@/components/library/CollectionPicker";
import type { CollectionId } from "@/constants/collections";
import { useDeviceLibrary } from "@/hooks/use-device-library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import type { FilableDoc } from "@/stores/collections-store";
import { useProtoTheme } from "@/theme/proto";

import { AllTab as AllLibraryTab } from "./library/all-tab";
import { CollectionsTab } from "./library/collections-tab";
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
  const [openFolderUri, setOpenFolderUri] = useState<string | null>(null);
  const [openShelf, setOpenShelf] = useState<CollectionId | null>(null);
  const [filing, setFiling] = useState<FilableDoc | null>(null);

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
    }, [filing, searching, tab, openFolderUri, openShelf, showToast, tr]),
  );

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
  const openDoc = (doc: { uri: string; name: string; ext: string }) => {
    if (doc.ext === "PDF") {
      router.push({ pathname: "/pdf", params: { uri: doc.uri, name: doc.name } });
      return;
    }
    if (doc.ext === "TXT" || doc.ext === "MD") {
      router.push({
        pathname: "/text",
        params: { uri: doc.uri, name: doc.name, ext: doc.ext },
      });
      return;
    }
    showToast(tr("library.docViewer.pdfOnly", { ext: doc.ext }));
  };
  const openDemo = (name: string) =>
    showToast(tr("library.demoToast", { name }));
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
    <ProtoScreen>
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

          <Box marginTop={14} paddingLeft={20} paddingRight={20}>
            <Segmented items={TAB_ITEMS} onChange={setTab} value={tab} />
          </Box>
        </>
      )}

      {tab === "all" && !searching ? (
        <AllLibraryTab
          contentPad={contentPad}
          lib={lib}
          openCollections={openCollections}
          openDoc={openDoc}
          refreshControl={renderRefresh()}
        />
      ) : tab === "files" && !searching ? (
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
          {searching ? (
            <SearchLibraryResults
              openDemo={openDemo}
              openReader={openReader}
              query={query}
            />
          ) : tab === "recent" ? (
            <RecentLibraryTab
              openCollections={openCollections}
              openDoc={openDoc}
            />
          ) : tab === "coll" ? (
            <CollectionsTab
              openCollection={setOpenShelf}
              openCollections={openCollections}
              openDemo={openDemo}
              openDoc={openDoc}
              openReader={openReader}
              shelf={openShelf}
            />
          ) : (
            <VocabLibraryTab openReader={openReader} />
          )}
        </ScrollView>
      )}

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

      {filing ? (
        <CollectionPicker doc={filing} onClose={() => setFiling(null)} />
      ) : null}
    </ProtoScreen>
  );
}
