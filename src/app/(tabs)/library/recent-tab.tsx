import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  Card,
  IconChevron,
  ProgressBar,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { formatWhen } from "@/hooks/use-device-library";
import {
  progressPct,
  type RecentDoc as RecentEntry,
  useRecentsStore,
} from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";

import { PdfThumb } from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;

export function RecentTab({
  openDoc,
}: {
  openDoc: (doc: RecentEntry) => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const recents = useRecentsStore((s) => s.recents);

  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
    }, []),
  );

  const relativeWhen = (openedAt: number) => {
    const days = Math.floor((now - openedAt) / DAY_MS);
    if (days <= 0) return tr("library.recent.today");
    if (days === 1) return tr("library.recent.yesterday");
    if (days < 7) return tr("library.recent.daysAgo", { count: days });
    return formatWhen(openedAt);
  };

  const [current, ...rest] = recents;
  const thisWeek = rest.filter((d) => now - d.openedAt < 7 * DAY_MS);
  const older = rest.filter((d) => now - d.openedAt >= 7 * DAY_MS);

  if (!current) {
    return (
      <Box align="center" gap={6} paddingTop={48} paddingX={24}>
        <Text align="center" size={15} weight="600">
          {tr("library.recent.emptyTitle")}
        </Text>
        <Text align="center" color={t.sub} lh={19} size={13}>
          {tr("library.recent.emptyBody")}
        </Text>
      </Box>
    );
  }

  const pct = progressPct(current);

  const row = (doc: RecentEntry) => {
    const docPct = progressPct(doc);
    return (
      <Tap key={doc.uri} onPress={() => openDoc(doc)}>
        <Box
          align="center"
          direction="row"
          gap={14}
          paddingY={12}
          style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
        >
          <PdfThumb doc={doc} rounded={6} style={{ width: 44, height: 58 }} />
          <Box flex={1}>
            <Text numberOfLines={1} size={14} weight="600">
              {doc.name}
            </Text>
            <Text color={t.sub} size={12} style={{ marginTop: 3 }}>
              {doc.pageCount
                ? tr("library.recent.pagesWhen", {
                    total: doc.pageCount,
                    when: relativeWhen(doc.openedAt),
                  })
                : relativeWhen(doc.openedAt)}
            </Text>
          </Box>
          <Box
            bg={docPct ? t.accentSoft : t.chip}
            paddingX={10}
            paddingY={4}
            rounded={20}
          >
            <Text color={docPct ? t.accentText : t.sub} size={11} weight="500">
              {docPct ? `${docPct}%` : tr("library.recent.badgeNew")}
            </Text>
          </Box>
        </Box>
      </Tap>
    );
  };

  return (
    <>
      <Tap onPress={() => openDoc(current)} scale={0.985}>
        <Card rounded={18}>
          <Box align="center" direction="row" gap={16}>
            <PdfThumb
              doc={current}
              rounded={8}
              style={{ width: 76, height: 104 }}
            />
            <Box flex={1} gap={6}>
              <Text color={t.accentText} ls={0.44} size={11} weight="600">
                {tr("library.recent.continueReading")}
              </Text>
              <Text lh={20} numberOfLines={2} serif size={16} weight="600">
                {current.name}
              </Text>
              <Text color={t.sub} size={12}>
                {current.pageCount
                  ? tr("library.recent.pageOf", {
                      page: current.page,
                      total: current.pageCount,
                    })
                  : tr("library.recent.pageOnly", { page: current.page })}
              </Text>
              <Box marginTop={4}>
                <ProgressBar pct={pct} />
              </Box>
            </Box>
            <IconChevron color={t.faint} size={18} />
          </Box>
        </Card>
      </Tap>

      {thisWeek.length ? (
        <>
          <Box paddingBottom={8} paddingTop={20}>
            <SectionLabel>{tr("library.recent.earlierThisWeek")}</SectionLabel>
          </Box>
          {thisWeek.map(row)}
        </>
      ) : null}

      {older.length ? (
        <>
          <Box paddingBottom={8} paddingTop={20}>
            <SectionLabel>{tr("library.recent.earlier")}</SectionLabel>
          </Box>
          {older.map(row)}
        </>
      ) : null}
    </>
  );
}
