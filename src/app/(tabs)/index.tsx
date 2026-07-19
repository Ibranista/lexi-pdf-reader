import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box, TextInput } from "@/components/atoms";
import {
  Card,
  Cover,
  HeaderButton,
  IconBack,
  IconBrain,
  IconChevron,
  IconFolder,
  IconPlus,
  IconSearch,
  IconSliders,
  IconSpark,
  IconSun,
  IndeterminateBar,
  ProgressBar,
  ProtoScreen,
  SectionLabel,
  Segmented,
  Tap,
  Text,
} from "@/components/lexi-components";
import {
  BOOK_PAGES,
  BOOK_TITLE,
  chapterOf,
  COLLECTIONS,
  LANG_NAMES,
  LIBRARY_INDEX,
  RECENT_DOCS,
} from "@/constants/library";
import {
  formatSize,
  formatWhen,
  useDeviceLibrary,
} from "@/hooks/use-device-library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useProtoTheme } from "@/theme/proto";

type LibTab = "all" | "coll" | "files" | "recent" | "vocab";

type DeviceLibrary = ReturnType<typeof useDeviceLibrary>;

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
  const [refreshing, setRefreshing] = useState(false);

  // pull-to-refresh: re-scan the device for documents
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    lib.refresh();
  }, [lib]);

  // clear the pull spinner once the scan it triggered finishes
  useEffect(() => {
    if (!lib.scanning) setRefreshing(false);
  }, [lib.scanning]);

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
  const openDemo = (name: string) =>
    showToast(tr("library.demoToast", { name }));

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

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: searching ? 16 : 18,
          paddingBottom: 90 + insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            colors={[t.accent]}
            onRefresh={onRefresh}
            progressBackgroundColor={t.card}
            refreshing={refreshing}
            tintColor={t.sub}
          />
        }
        style={{ flex: 1 }}
      >
        {searching ? (
          <SearchResults
            openDemo={openDemo}
            openReader={openReader}
            query={query}
          />
        ) : tab === "recent" ? (
          <RecentTab openDemo={openDemo} openReader={openReader} />
        ) : tab === "all" ? (
          <AllTab lib={lib} openReader={openReader} />
        ) : tab === "coll" ? (
          <CollectionsTab openDemo={openDemo} openReader={openReader} />
        ) : tab === "vocab" ? (
          <VocabTab />
        ) : (
          <FilesTab lib={lib} openReader={openReader} />
        )}
      </ScrollView>

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

/* ============ Recent ============ */

function RecentTab({
  openDemo,
  openReader,
}: {
  openDemo: (name: string) => void;
  openReader: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const page = useAppStore((s) => s.page);
  const ch = chapterOf(page);

  return (
    <>
      <Tap onPress={openReader} scale={0.985}>
        <Card rounded={18}>
          <Box align="center" direction="row" gap={16}>
            <Cover
              height={104}
              label={tr("library.all.coverPlaceholder")}
              rounded={8}
              width={76}
            />
            <Box flex={1} gap={6}>
              <Text color={t.accentText} ls={0.44} size={11} weight="600">
                {tr("library.recent.continueReading")}
              </Text>
              <Text lh={20} serif size={16} weight="600">
                {BOOK_TITLE}
              </Text>
              <Text color={t.sub} size={12}>
                {tr("library.recent.pageOf", {
                  page,
                  total: BOOK_PAGES,
                  chapter: ch.n,
                })}
              </Text>
              <Box marginTop={4}>
                <ProgressBar pct={(page / BOOK_PAGES) * 100} />
              </Box>
            </Box>
            <IconChevron color={t.faint} size={18} />
          </Box>
        </Card>
      </Tap>

      <Box paddingBottom={8} paddingTop={20}>
        <SectionLabel>{tr("library.recent.earlierThisWeek")}</SectionLabel>
      </Box>

      {RECENT_DOCS.map((doc) => (
        <Tap key={doc.name} onPress={() => openDemo(doc.name)}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={12}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Cover height={58} width={44} />
            <Box flex={1}>
              <Text size={14} weight="600">
                {doc.name}
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                {doc.meta}
              </Text>
            </Box>
            <Box
              bg={doc.hot ? t.accentSoft : t.chip}
              paddingX={10}
              paddingY={4}
              rounded={20}
            >
              <Text
                color={doc.hot ? t.accentText : t.sub}
                size={11}
                weight="500"
              >
                {doc.badge}
              </Text>
            </Box>
          </Box>
        </Tap>
      ))}
    </>
  );
}

/* ============ All ============ */

function docMeta(size: number, modifiedAt: number | null): string {
  return [formatSize(size), formatWhen(modifiedAt)].filter(Boolean).join(" · ");
}

function AllTab({
  lib,
  openReader,
}: {
  lib: DeviceLibrary;
  openReader: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const { access, ensureAccess, docs, pickFolder, scanning, scanProgress } =
    lib;

  // full-screen scan UI only for the very first scan (nothing to show yet);
  // a pull-to-refresh rescan keeps the existing grid + its own spinner
  if (scanning && docs.length === 0) {
    return (
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
    );
  }

  if (docs.length === 0) {
    const needsAccess = access === "denied";
    return (
      <Box align="center" gap={10} paddingX={24} paddingY={44}>
        <IconFolder color={t.faint} size={26} />
        <Text size={15} weight="600">
          {needsAccess
            ? tr("library.all.allowTitle")
            : tr("library.all.emptyTitle")}
        </Text>
        <Text align="center" color={t.sub} lh={21} size={13}>
          {needsAccess
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
  }

  return (
    <>
      {access === "denied" ? (
        // documents from app storage only — offer device-wide access
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
      <Box
        direction="row"
        style={{ flexWrap: "wrap", columnGap: 14, rowGap: 16 }}
      >
        {docs.map((doc) => (
          <Tap
            key={doc.uri}
            onPress={openReader}
            scale={0.96}
            style={{ width: "30%", flexGrow: 1 }}
          >
            <Box gap={7}>
              <Box
                align="center"
                bg={t.coverA}
                borderColor={t.line}
                borderWidth={1}
                justify="center"
                rounded={9}
                style={{ aspectRatio: 3 / 4 }}
              >
                <Text color={t.sub} mono size={8}>
                  {doc.ext}
                </Text>
              </Box>
              <Box gap={2}>
                <Text lh={15} numberOfLines={2} size={11.5} weight="500">
                  {doc.name}
                </Text>
                <Text color={t.faint} size={10}>
                  {docMeta(doc.size, doc.modifiedAt)}
                </Text>
              </Box>
            </Box>
          </Tap>
        ))}
      </Box>
    </>
  );
}

/* ============ Collections ============ */

function CollectionsTab({
  openDemo,
  openReader,
}: {
  openDemo: (name: string) => void;
  openReader: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const showToast = useToastStore((s) => s.showToast);
  const readerType = useOnboardingStore((s) => s.readerType);
  const cd = COLLECTIONS[readerType] ?? COLLECTIONS.student;

  return (
    <>
      <Box direction="row" style={{ flexWrap: "wrap", gap: 12 }}>
        {cd.colls.map(([emoji, name, meta]) => (
          <Tap
            key={name}
            onPress={() =>
              showToast(tr("library.collections.demoToast", { name }))
            }
            scale={0.97}
            style={{ width: "47%", flexGrow: 1 }}
          >
            <Card gap={8}>
              <Text size={22}>{emoji}</Text>
              <Text size={14} weight="600">
                {name}
              </Text>
              <Text color={t.sub} size={12}>
                {meta}
              </Text>
            </Card>
          </Tap>
        ))}
      </Box>

      <Box
        align="center"
        direction="row"
        gap={8}
        paddingBottom={3}
        paddingTop={24}
      >
        <IconSpark color={t.accent} size={13} />
        <SectionLabel>{tr("library.collections.autoFilled")}</SectionLabel>
      </Box>
      <Text color={t.faint} size={12} style={{ paddingBottom: 4 }}>
        {tr("library.collections.basedOn", { label: cd.label })}
      </Text>

      {cd.filed.map(([name, coll, kind]) => (
        <Tap
          key={name}
          onPress={name === BOOK_TITLE ? openReader : () => openDemo(name)}
        >
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={12}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Cover height={58} width={44} />
            <Box flex={1}>
              <Text size={14} weight="600">
                {name}
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                {tr("library.collections.filedIn", { collection: coll })}
              </Text>
            </Box>
            <Box bg={t.accentSoft} paddingX={10} paddingY={4} rounded={20}>
              <Text color={t.accentText} size={11} weight="500">
                {kind}
              </Text>
            </Box>
          </Box>
        </Tap>
      ))}

      <Text color={t.faint} size={12} style={{ paddingTop: 10 }}>
        {tr("library.collections.tapSuggestion")}
      </Text>
    </>
  );
}

/* ============ Vocab ============ */

function VocabTab() {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const vocab = useAppStore((s) => s.vocab);
  const setPage = useAppStore((s) => s.setPage);
  const showToast = useToastStore((s) => s.showToast);

  return (
    <>
      <Box
        direction="row"
        justify="between"
        paddingBottom={8}
        style={{ alignItems: "baseline" }}
      >
        <SectionLabel>{tr("library.vocab.savedWords")}</SectionLabel>
        <Text color={t.faint} size={12}>
          {tr("library.vocab.wordCount", { count: vocab.length })}
        </Text>
      </Box>

      <Box gap={12}>
        {vocab.map((v) => (
          <Tap
            key={v.word}
            onPress={() => {
              setPage(v.p);
              router.push("/reader");
              showToast(tr("library.vocab.jumpedToast", { page: v.p }));
            }}
            scale={0.985}
          >
            <Card gap={10}>
              <Box direction="row" gap={10} style={{ alignItems: "baseline" }}>
                <Text serif size={18} weight="600">
                  {v.word}
                </Text>
                <Box bg={t.chip} paddingX={8} paddingY={3} rounded={12}>
                  <Text color={t.sub} size={10.5} weight="500">
                    {v.pos}
                  </Text>
                </Box>
                <Box flex={1} />
                <Text color={t.faint} mono size={11} weight="600">
                  {tr("library.vocab.pageAbbrev", { page: v.p })}
                </Text>
              </Box>
              <Box
                direction="row"
                gap={8}
                wrap="wrap"
                style={{ alignItems: "baseline" }}
              >
                <Text color={t.accentText} size={17} weight="600">
                  {v.tr}
                </Text>
                <Text color={t.sub} size={12}>
                  {tr("library.vocab.translitLine", {
                    translit: v.translit,
                    lang: LANG_NAMES[v.lang] ?? v.lang,
                  })}
                </Text>
              </Box>
              <Box direction="row" gap={9}>
                <Box bg={t.accent} rounded={2} width={4} />
                <Box flex={1}>
                  <Text color={t.readerInk} lh={20} size={13}>
                    {v.s1}
                  </Text>
                </Box>
              </Box>
              <Box direction="row" gap={9}>
                <Box bg={t.accentSoft} rounded={2} width={4} />
                <Box flex={1}>
                  <Text color={t.sub} lh={20} size={13}>
                    {v.s2}
                  </Text>
                </Box>
              </Box>
            </Card>
          </Tap>
        ))}

        {vocab.length === 0 ? (
          <Box align="center" gap={10} paddingX={24} paddingY={48}>
            <IconSpark color={t.faint} size={26} />
            <Text align="center" color={t.sub} lh={21} size={13}>
              {tr("library.vocab.emptyState")}
            </Text>
          </Box>
        ) : null}
      </Box>
    </>
  );
}

/* ============ Files ============ */

function FilesTab({
  lib,
  openReader,
}: {
  lib: DeviceLibrary;
  openReader: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const libRootName = useAppStore((s) => s.libRootName);
  const { access, ensureAccess, folders, docs, pickFolder, scanning } = lib;
  const [openUri, setOpenUri] = useState<string | null>(null);

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
    const folderDocs = docs.filter((d) => d.folderUri === openFolder.uri);
    return (
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
          <SectionLabel>{folderLabel(openFolder)}</SectionLabel>
        </Box>
        {folderDocs.map((doc) => (
          <Tap key={doc.uri} onPress={openReader}>
            <Box
              align="center"
              direction="row"
              gap={14}
              paddingY={12}
              style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
            >
              <Cover height={58} width={44} />
              <Box flex={1}>
                <Text numberOfLines={1} size={14} weight="600">
                  {doc.name}
                </Text>
                <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                  {docMeta(doc.size, doc.modifiedAt)}
                </Text>
              </Box>
              <IconChevron color={t.faint} size={16} />
            </Box>
          </Tap>
        ))}
        {folderDocs.length === 0 ? (
          <Text color={t.sub} size={13} style={{ paddingTop: 12 }}>
            {tr("library.files.folderEmpty")}
          </Text>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Box paddingBottom={8}>
        <SectionLabel>{tr("library.files.onThisDevice")}</SectionLabel>
      </Box>

      {access === "denied" ? (
        // Android without "All files access" — one tap re-opens the request
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
        // iOS / web — folder picking is the only way in
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

      {folders.map((f) => (
        <Tap key={f.uri} onPress={() => setOpenUri(f.uri)}>
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
                {folderLabel(f)}
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                {tr("library.files.docCount", { count: f.docCount })}
              </Text>
            </Box>
            <IconChevron color={t.faint} size={16} />
          </Box>
        </Tap>
      ))}

      {scanning ? (
        <Box align="center" paddingY={28}>
          <Text color={t.sub} size={13}>
            {tr("library.all.scanning")}
          </Text>
        </Box>
      ) : folders.length === 0 ? (
        <Box align="center" paddingX={24} paddingY={28}>
          <Text align="center" color={t.sub} lh={21} size={13}>
            {tr("library.files.empty")}
          </Text>
        </Box>
      ) : null}
    </>
  );
}

/* ============ Search ============ */

function SearchResults({
  openDemo,
  openReader,
  query,
}: {
  openDemo: (name: string) => void;
  openReader: () => void;
  query: string;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () =>
      q ? LIBRARY_INDEX.filter((d) => d.name.toLowerCase().includes(q)) : [],
    [q],
  );

  if (!q) {
    return (
      <Box align="center" gap={10} paddingX={24} paddingY={44}>
        <IconSearch color={t.faint} size={26} />
        <Text align="center" color={t.sub} lh={21} size={13}>
          {tr("library.search.emptyPrompt")}
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box paddingBottom={10}>
        <SectionLabel>
          {tr("library.search.resultCount", { count: results.length })}
        </SectionLabel>
      </Box>
      {results.map((doc) => (
        <Tap
          key={doc.name}
          onPress={doc.isBook ? openReader : () => openDemo(doc.name)}
        >
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={12}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Cover height={58} width={44} />
            <Box flex={1}>
              <Text size={14} weight="600">
                {doc.name}
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
                {doc.meta}
              </Text>
            </Box>
            <Box bg={t.chip} paddingX={10} paddingY={4} rounded={20}>
              <Text color={t.faint} size={10.5} weight="500">
                {doc.where}
              </Text>
            </Box>
          </Box>
        </Tap>
      ))}
      {results.length === 0 ? (
        <Box paddingX={24} paddingY={48}>
          <Text align="center" color={t.sub} lh={21} size={13}>
            {tr("library.search.noMatch", { query })}
          </Text>
        </Box>
      ) : null}
    </>
  );
}
