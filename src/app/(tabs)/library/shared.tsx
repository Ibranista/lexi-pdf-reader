import { Image } from "expo-image";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { RefreshControlProps } from "react-native";

import { Box } from "@/components/atoms";
import { Tap, Text } from "@/components/lexi-components";
import { formatSize, formatWhen } from "@/hooks/use-device-library";
import { usePdfThumbnail } from "@/hooks/use-pdf-thumbnail";
import { type SortKey, useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export const GRID_COLUMNS = 3;

export interface ScrollerProps {
  contentPad: { padding: number; paddingTop: number; paddingBottom: number };
  refreshControl: ReactElement<RefreshControlProps>;
}

export function PdfThumb({
  doc,
  rounded = 9,
  style,
}: {
  doc: { uri: string; ext: string };
  rounded?: number;
  style?: { width?: number; height?: number; aspectRatio?: number };
}) {
  const t = useProtoTheme();
  const thumb = usePdfThumbnail(doc.uri, doc.ext === "PDF");

  return (
    <Box
      align="center"
      bg={t.coverA}
      borderColor={t.line}
      borderWidth={1}
      justify="center"
      rounded={rounded}
      style={{ ...style, overflow: "hidden" }}
    >
      {thumb ? (
        <Image
          contentFit="cover"
          source={{ uri: thumb }}
          style={{ width: "100%", height: "100%" }}
          transition={160}
        />
      ) : (
        <Text color={t.sub} mono size={8}>
          {doc.ext}
        </Text>
      )}
    </Box>
  );
}

const SORT_KEYS: SortKey[] = ["date", "name", "size"];

export function SortBar() {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const sort = useAppStore((s) => s.librarySort);
  const setApp = useAppStore((s) => s.set);

  const choose = (key: SortKey) =>
    setApp({
      librarySort:
        key === sort.key
          ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
          : { key, dir: key === "name" ? "asc" : "desc" },
    });

  return (
    <Box
      align="center"
      direction="row"
      gap={8}
      paddingBottom={14}
      style={{ flexWrap: "wrap" }}
    >
      <Text color={t.faint} size={11.5} weight="500">
        {tr("library.sort.label")}
      </Text>
      {SORT_KEYS.map((key) => {
        const active = key === sort.key;
        return (
          <Tap key={key} onPress={() => choose(key)} scale={0.94}>
            <Box
              align="center"
              bg={active ? t.accentSoft : t.chip}
              direction="row"
              gap={4}
              paddingX={11}
              paddingY={5}
              rounded={20}
            >
              <Text
                color={active ? t.accentText : t.sub}
                size={11.5}
                weight="500"
              >
                {tr(`library.sort.${key}`)}
              </Text>
              {active ? (
                <Text color={t.accentText} size={10} weight="600">
                  {sort.dir === "asc" ? "↑" : "↓"}
                </Text>
              ) : null}
            </Box>
          </Tap>
        );
      })}
    </Box>
  );
}

export function docMeta(size: number, modifiedAt: number | null): string {
  return [formatSize(size), formatWhen(modifiedAt)].filter(Boolean).join(" · ");
}
