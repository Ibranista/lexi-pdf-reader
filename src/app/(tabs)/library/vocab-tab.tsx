import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import { Card, IconSpark, Tap, Text } from "@/components/lexi-components";
import { LANG_NAMES } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export function VocabTab({ openReader }: { openReader: () => void }) {
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
        <Text size={13} weight="600">
          {tr("library.vocab.savedWords")}
        </Text>
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
              openReader();
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
