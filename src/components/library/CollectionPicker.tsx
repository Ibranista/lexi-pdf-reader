import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  AnchoredPopover,
  type Anchor,
} from "@/components/library/AnchoredPopover";
import {
  CollectionGlyph,
  IconCheck,
  IconClose,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { COLLECTION_META, resolveCollectionColor } from "@/constants/collections";
import { useToastStore } from "@/stores/app-store";
import {
  type FilableDoc,
  useCollectionsStore,
} from "@/stores/collections-store";
import { useProtoTheme } from "@/theme/proto";

export function CollectionPicker({
  anchor,
  doc,
  onClose,
}: {
  anchor?: Anchor;
  doc: FilableDoc;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const items = useCollectionsStore((s) => s.items);
  const toggle = useCollectionsStore((s) => s.toggle);
  const showToast = useToastStore((s) => s.showToast);

  return (
    <AnchoredPopover
      anchor={anchor}
      maxWidth={204}
      onClose={onClose}
      width="56%"
    >
      <Box align="center" direction="row" paddingBottom={1}>
        <Box flex={1}>
          <SectionLabel size={9}>{tr("library.collections.addTo")}</SectionLabel>
        </Box>
        <Tap onPress={onClose} scale={0.9}>
          <Box align="center" height={20} justify="center" width={20}>
            <IconClose color={t.sub} size={14} />
          </Box>
        </Tap>
      </Box>
      <Box>
        <Text
          numberOfLines={1}
          size={12}
          style={{ marginTop: 3 }}
          weight="600"
        >
          {doc.name}
        </Text>
      </Box>

      <Box gap={3}>
        {COLLECTION_META.map(({ color, icon, id }) => {
          const label = tr(`library.collections.names.${id}`);
          const filed = (items[id] ?? []).some((d) => d.uri === doc.uri);
          return (
            <Tap
              key={id}
              onPress={() => {
                const nowFiled = toggle(id, doc);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                showToast(
                  tr(
                    nowFiled
                      ? "library.collections.addedToast"
                      : "library.collections.removedToast",
                    { collection: label },
                  ),
                );
              }}
              scale={0.98}
            >
              <Box
                align="center"
                bg={filed ? t.accentSoft : t.chip}
                direction="row"
                gap={7}
                paddingX={8}
                paddingY={6}
                rounded={8}
              >
                <CollectionGlyph
                  color={
                    filed
                      ? t.accentText
                      : resolveCollectionColor(color, t.dark, t.ink)
                  }
                  icon={icon}
                  size={14}
                />
                <Box flex={1}>
                  <Text
                    color={filed ? t.accentText : t.ink}
                    size={11}
                    weight="600"
                  >
                    {label}
                  </Text>
                  <Text color={t.sub} size={9} style={{ marginTop: 1 }}>
                    {tr("library.collections.docCount", {
                      count: (items[id] ?? []).length,
                    })}
                  </Text>
                </Box>
                {filed ? <IconCheck color={t.accentText} size={17} /> : null}
              </Box>
            </Tap>
          );
        })}
      </Box>
    </AnchoredPopover>
  );
}
