import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  Cover,
  IconSearch,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { LIBRARY_INDEX } from "@/constants/library";
import { useProtoTheme } from "@/theme/proto";

export function SearchResults({
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
