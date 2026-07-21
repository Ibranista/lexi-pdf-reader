import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  Card,
  Cover,
  IconSpark,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { BOOK_TITLE, COLLECTIONS } from "@/constants/library";
import { useToastStore } from "@/stores/app-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useProtoTheme } from "@/theme/proto";

export function CollectionsTab({
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
