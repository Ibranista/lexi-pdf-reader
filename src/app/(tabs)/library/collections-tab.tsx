import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  Card,
  Cover,
  IconBack,
  IconSpark,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { COLLECTION_META, type CollectionId } from "@/constants/collections";
import { BOOK_TITLE, COLLECTIONS } from "@/constants/library";
import { useCollectionsStore } from "@/stores/collections-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useProtoTheme } from "@/theme/proto";

import { DocRow, type OpenCollections } from "./shared";

export function CollectionsTab({
  openCollection,
  openCollections,
  openDemo,
  openDoc,
  openReader,
  shelf,
}: {
  openCollection: (id: CollectionId | null) => void;
  openCollections: OpenCollections;
  openDemo: (name: string) => void;
  openDoc: (doc: { uri: string; name: string; ext: string }) => void;
  openReader: () => void;
  shelf: CollectionId | null;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const readerType = useOnboardingStore((s) => s.readerType);
  const items = useCollectionsStore((s) => s.items);
  const cd = COLLECTIONS[readerType] ?? COLLECTIONS.student;

  if (shelf) {
    const docs = items[shelf] ?? [];
    const meta = COLLECTION_META.find((c) => c.id === shelf);
    return (
      <>
        <Tap onPress={() => openCollection(null)}>
          <Box align="center" direction="row" gap={8} paddingBottom={14}>
            <IconBack color={t.accentText} size={16} />
            <Text color={t.accentText} size={13} weight="600">
              {tr("library.collections.allCollections")}
            </Text>
          </Box>
        </Tap>

        <Box
          direction="row"
          gap={10}
          paddingBottom={10}
          style={{ alignItems: "baseline" }}
        >
          <Text size={18}>{meta?.emoji}</Text>
          <Text serif size={20} weight="600">
            {tr(`library.collections.names.${shelf}`)}
          </Text>
          <Box flex={1} />
          <Text color={t.faint} size={12}>
            {tr("library.collections.docCount", { count: docs.length })}
          </Text>
        </Box>

        {docs.length === 0 ? (
          <Box align="center" gap={10} paddingX={24} paddingY={44}>
            <Text size={26}>{meta?.emoji}</Text>
            <Text align="center" color={t.sub} lh={21} size={13}>
              {tr("library.collections.shelfEmpty")}
            </Text>
          </Box>
        ) : (
          docs.map((doc) => (
            <DocRow
              doc={doc}
              key={doc.uri}
              meta={tr("library.collections.filedWhen", {
                when: new Date(doc.addedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
              })}
              onLongPress={() => openCollections(doc)}
              onPress={() => openDoc(doc)}
            />
          ))
        )}

        <Text color={t.faint} size={12} style={{ paddingTop: 14 }}>
          {tr("library.collections.manageHint")}
        </Text>
      </>
    );
  }

  return (
    <>
      <Box direction="row" gap={8}>
        {COLLECTION_META.map(({ emoji, id }) => (
          <Tap
            key={id}
            onPress={() => openCollection(id)}
            scale={0.97}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Card gap={5} padding={10} rounded={14}>
              <Text size={20}>{emoji}</Text>
              <Text lh={16} numberOfLines={2} size={12} weight="600">
                {tr(`library.collections.names.${id}`)}
              </Text>
              <Text color={t.sub} numberOfLines={1} size={10}>
                {tr("library.collections.docCount", {
                  count: (items[id] ?? []).length,
                })}
              </Text>
            </Card>
          </Tap>
        ))}
      </Box>

      <Text color={t.faint} lh={18} size={12} style={{ paddingTop: 12 }}>
        {tr("library.collections.howToFile")}
      </Text>

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
