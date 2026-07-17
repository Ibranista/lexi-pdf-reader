import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box, TextInput } from '@/components/atoms';
import {
  Card,
  Cover,
  HeaderButton,
  IconBrain,
  IconChevron,
  IconFolder,
  IconPlus,
  IconSearch,
  IconSliders,
  IconSpark,
  IconSun,
  ProgressBar,
  ProtoScreen,
  PText,
  SectionLabel,
  Segmented,
  Tap,
} from '@/components/proto';
import {
  ALL_DOC_NAMES,
  BOOK_PAGES,
  BOOK_TITLE,
  chapterOf,
  COLLECTIONS,
  FOLDERS,
  LANG_NAMES,
  LIBRARY_INDEX,
  RECENT_DOCS,
} from '@/constants/library';
import { useAppStore, useToastStore } from '@/stores/app-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useProtoTheme } from '@/theme/proto';

type LibTab = 'all' | 'coll' | 'files' | 'recent' | 'vocab';

const TAB_ITEMS = [
  { key: 'recent' as const, label: 'Recent' },
  { key: 'all' as const, label: 'All' },
  { key: 'coll' as const, label: 'Collections', flex: 1.4 },
  { key: 'files' as const, label: 'Files' },
  { key: 'vocab' as const, label: 'Vocab' },
];

export default function LibraryScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const [tab, setTab] = useState<LibTab>('recent');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const openReader = () => router.push('/reader');
  const openDemo = (name: string) => showToast(`Demo — “${name}” opens the same reader`);

  return (
    <ProtoScreen>
      {/* top icon row */}
      <Box align="center" direction="row" justify="between" paddingLeft={20} paddingRight={20} paddingTop={8}>
        <HeaderButton onPress={() => router.push('/settings')}>
          <IconSliders bg={t.bg} color={t.ink} size={20} />
        </HeaderButton>
        <Box direction="row" gap={10}>
          <HeaderButton onPress={() => router.push('/today')}>
            <IconSun color={t.ink} size={19} />
          </HeaderButton>
          <HeaderButton onPress={() => router.push('/brain')}>
            <IconBrain color={t.ink} size={19} />
          </HeaderButton>
          <HeaderButton bg={t.accentSoft} noBorder onPress={() => showToast('Signed in as Selam B.')}>
            <PText color={t.accentText} size={14} weight="600">
              SB
            </PText>
          </HeaderButton>
        </Box>
      </Box>

      {searching ? (
        <Box align="center" direction="row" gap={10} paddingLeft={20} paddingRight={20} paddingTop={14}>
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
              placeholder="Search your library"
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
              setQuery('');
            }}
          >
            <PText color={t.accentText} size={14} weight="500">
              Cancel
            </PText>
          </Tap>
        </Box>
      ) : (
        <>
          {/* title row */}
          <Box align="center" direction="row" justify="between" paddingLeft={20} paddingRight={20} paddingTop={18}>
            <PText ls={-0.3} serif size={30} weight="600">
              Library
            </PText>
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
        contentContainerStyle={{ padding: 20, paddingTop: searching ? 16 : 18, paddingBottom: 90 + insets.bottom }}
        style={{ flex: 1 }}
      >
        {searching ? (
          <SearchResults openDemo={openDemo} openReader={openReader} query={query} />
        ) : tab === 'recent' ? (
          <RecentTab openDemo={openDemo} openReader={openReader} />
        ) : tab === 'all' ? (
          <AllTab openDemo={openDemo} openReader={openReader} />
        ) : tab === 'coll' ? (
          <CollectionsTab openDemo={openDemo} openReader={openReader} />
        ) : tab === 'vocab' ? (
          <VocabTab />
        ) : (
          <FilesTab />
        )}
      </ScrollView>

      {/* import FAB */}
      <Tap
        onPress={() => showToast('Import from Files / Drive…')}
        scale={0.92}
        style={{ position: 'absolute', right: 20, bottom: 26 + insets.bottom }}
      >
        <Box
          align="center"
          bg={t.accent}
          height={56}
          justify="center"
          rounded={18}
          style={{
            shadowColor: '#201B15',
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

function RecentTab({ openDemo, openReader }: { openDemo: (name: string) => void; openReader: () => void }) {
  const t = useProtoTheme();
  const page = useAppStore((s) => s.page);
  const ch = chapterOf(page);

  return (
    <>
      <Tap onPress={openReader} scale={0.985}>
        <Card rounded={18}>
          <Box align="center" direction="row" gap={16}>
            <Cover height={104} label="cover" rounded={8} width={76} />
            <Box flex={1} gap={6}>
              <PText color={t.accentText} ls={0.44} size={11} weight="600">
                CONTINUE READING
              </PText>
              <PText lh={20} serif size={16} weight="600">
                {BOOK_TITLE}
              </PText>
              <PText color={t.sub} size={12}>
                Page {page} of {BOOK_PAGES} · Ch. {ch.n}
              </PText>
              <Box marginTop={4}>
                <ProgressBar pct={(page / BOOK_PAGES) * 100} />
              </Box>
            </Box>
            <IconChevron color={t.faint} size={18} />
          </Box>
        </Card>
      </Tap>

      <Box paddingBottom={8} paddingTop={20}>
        <SectionLabel>Earlier this week</SectionLabel>
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
              <PText size={14} weight="600">
                {doc.name}
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 3 }}>
                {doc.meta}
              </PText>
            </Box>
            <Box bg={doc.hot ? t.accentSoft : t.chip} paddingX={10} paddingY={4} rounded={20}>
              <PText color={doc.hot ? t.accentText : t.sub} size={11} weight="500">
                {doc.badge}
              </PText>
            </Box>
          </Box>
        </Tap>
      ))}
    </>
  );
}

/* ============ All ============ */

function AllTab({ openDemo, openReader }: { openDemo: (name: string) => void; openReader: () => void }) {
  const t = useProtoTheme();
  return (
    <Box direction="row" style={{ flexWrap: 'wrap', columnGap: 14, rowGap: 16 }}>
      {ALL_DOC_NAMES.map((name, i) => (
        <Tap
          key={name}
          onPress={i === 0 ? openReader : () => openDemo(name)}
          scale={0.96}
          style={{ width: '30%', flexGrow: 1 }}
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
              <PText color={t.sub} mono size={8}>
                cover
              </PText>
            </Box>
            <PText lh={15} numberOfLines={2} size={11.5} weight="500">
              {name}
            </PText>
          </Box>
        </Tap>
      ))}
    </Box>
  );
}

/* ============ Collections ============ */

function CollectionsTab({ openDemo, openReader }: { openDemo: (name: string) => void; openReader: () => void }) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const readerType = useOnboardingStore((s) => s.readerType);
  const cd = COLLECTIONS[readerType] ?? COLLECTIONS.student;

  return (
    <>
      <Box direction="row" style={{ flexWrap: 'wrap', gap: 12 }}>
        {cd.colls.map(([emoji, name, meta]) => (
          <Tap
            key={name}
            onPress={() => showToast(`Demo — “${name}” collection`)}
            scale={0.97}
            style={{ width: '47%', flexGrow: 1 }}
          >
            <Card gap={8}>
              <PText size={22}>{emoji}</PText>
              <PText size={14} weight="600">
                {name}
              </PText>
              <PText color={t.sub} size={12}>
                {meta}
              </PText>
            </Card>
          </Tap>
        ))}
      </Box>

      <Box align="center" direction="row" gap={8} paddingBottom={3} paddingTop={24}>
        <IconSpark color={t.accent} size={13} />
        <SectionLabel>Auto-filled for you</SectionLabel>
      </Box>
      <PText color={t.faint} size={12} style={{ paddingBottom: 4 }}>
        Based on your onboarding · {cd.label}
      </PText>

      {cd.filed.map(([name, coll, kind]) => (
        <Tap key={name} onPress={name === BOOK_TITLE ? openReader : () => openDemo(name)}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={12}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Cover height={58} width={44} />
            <Box flex={1}>
              <PText size={14} weight="600">
                {name}
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 3 }}>
                Filed in {coll}
              </PText>
            </Box>
            <Box bg={t.accentSoft} paddingX={10} paddingY={4} rounded={20}>
              <PText color={t.accentText} size={11} weight="500">
                {kind}
              </PText>
            </Box>
          </Box>
        </Tap>
      ))}

      <PText color={t.faint} size={12} style={{ paddingTop: 10 }}>
        Tap a suggestion to move it — nothing files without you seeing it.
      </PText>
    </>
  );
}

/* ============ Vocab ============ */

function VocabTab() {
  const t = useProtoTheme();
  const vocab = useAppStore((s) => s.vocab);
  const setPage = useAppStore((s) => s.setPage);
  const showToast = useToastStore((s) => s.showToast);

  return (
    <>
      <Box direction="row" justify="between" paddingBottom={8} style={{ alignItems: 'baseline' }}>
        <SectionLabel>Saved words</SectionLabel>
        <PText color={t.faint} size={12}>
          {vocab.length} {vocab.length === 1 ? 'word' : 'words'}
        </PText>
      </Box>

      <Box gap={12}>
        {vocab.map((v) => (
          <Tap
            key={v.word}
            onPress={() => {
              setPage(v.p);
              router.push('/reader');
              showToast(`Jumped to page ${v.p}`);
            }}
            scale={0.985}
          >
            <Card gap={10}>
              <Box direction="row" gap={10} style={{ alignItems: 'baseline' }}>
                <PText serif size={18} weight="600">
                  {v.word}
                </PText>
                <Box bg={t.chip} paddingX={8} paddingY={3} rounded={12}>
                  <PText color={t.sub} size={10.5} weight="500">
                    {v.pos}
                  </PText>
                </Box>
                <Box flex={1} />
                <PText color={t.faint} mono size={11} weight="600">
                  P. {v.p}
                </PText>
              </Box>
              <Box direction="row" gap={8} wrap="wrap" style={{ alignItems: 'baseline' }}>
                <PText color={t.accentText} size={17} weight="600">
                  {v.tr}
                </PText>
                <PText color={t.sub} size={12}>
                  · {v.translit} · {LANG_NAMES[v.lang] ?? v.lang}
                </PText>
              </Box>
              <Box direction="row" gap={9}>
                <Box bg={t.accent} rounded={2} width={4} />
                <Box flex={1}>
                  <PText color={t.readerInk} lh={20} size={13}>
                    {v.s1}
                  </PText>
                </Box>
              </Box>
              <Box direction="row" gap={9}>
                <Box bg={t.accentSoft} rounded={2} width={4} />
                <Box flex={1}>
                  <PText color={t.sub} lh={20} size={13}>
                    {v.s2}
                  </PText>
                </Box>
              </Box>
            </Card>
          </Tap>
        ))}

        {vocab.length === 0 ? (
          <Box align="center" gap={10} paddingX={24} paddingY={48}>
            <IconSpark color={t.faint} size={26} />
            <PText align="center" color={t.sub} lh={21} size={13}>
              No saved words yet.{'\n'}Tap & hold a word while reading, then “Save word”.
            </PText>
          </Box>
        ) : null}
      </Box>
    </>
  );
}

/* ============ Files ============ */

function FilesTab() {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  return (
    <>
      <Box paddingBottom={8}>
        <SectionLabel>On this device</SectionLabel>
      </Box>
      {FOLDERS.map((f) => (
        <Tap key={f.name} onPress={() => showToast('Demo — folder browsing not wired')}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={14}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Box align="center" bg={t.accentSoft} height={42} justify="center" rounded={11} width={42}>
              <IconFolder color={t.accentText} size={19} />
            </Box>
            <Box flex={1}>
              <PText size={14} weight="600">
                {f.name}
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 3 }}>
                {f.meta}
              </PText>
            </Box>
            <IconChevron color={t.faint} size={16} />
          </Box>
        </Tap>
      ))}
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
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () => (q ? LIBRARY_INDEX.filter((d) => d.name.toLowerCase().includes(q)) : []),
    [q],
  );

  if (!q) {
    return (
      <Box align="center" gap={10} paddingX={24} paddingY={44}>
        <IconSearch color={t.faint} size={26} />
        <PText align="center" color={t.sub} lh={21} size={13}>
          Search across Recent and All PDFs{'\n'}by title.
        </PText>
      </Box>
    );
  }

  return (
    <>
      <Box paddingBottom={10}>
        <SectionLabel>
          {results.length} {results.length === 1 ? 'document' : 'documents'}
        </SectionLabel>
      </Box>
      {results.map((doc) => (
        <Tap key={doc.name} onPress={doc.isBook ? openReader : () => openDemo(doc.name)}>
          <Box
            align="center"
            direction="row"
            gap={14}
            paddingY={12}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Cover height={58} width={44} />
            <Box flex={1}>
              <PText size={14} weight="600">
                {doc.name}
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 3 }}>
                {doc.meta}
              </PText>
            </Box>
            <Box bg={t.chip} paddingX={10} paddingY={4} rounded={20}>
              <PText color={t.faint} size={10.5} weight="500">
                {doc.where}
              </PText>
            </Box>
          </Box>
        </Tap>
      ))}
      {results.length === 0 ? (
        <Box paddingX={24} paddingY={48}>
          <PText align="center" color={t.sub} lh={21} size={13}>
            No documents match “{query}”.
          </PText>
        </Box>
      ) : null}
    </>
  );
}
