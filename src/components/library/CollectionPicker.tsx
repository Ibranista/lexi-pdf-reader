/**
 * "Add to collection" sheet — the single filing surface in the app. Reached by
 * long-pressing a document in the library, or from the reader's toolbar while
 * the document is open.
 *
 * Filing applies immediately per row rather than behind a Done button: the
 * checkmarks are the state, so there is nothing to commit or cancel.
 */
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/atoms";
import {
  Backdrop,
  BottomSheet,
  IconCheck,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { COLLECTION_META } from "@/constants/collections";
import { useToastStore } from "@/stores/app-store";
import {
  type FilableDoc,
  useCollectionsStore,
} from "@/stores/collections-store";
import { useProtoTheme } from "@/theme/proto";

export function CollectionPicker({
  doc,
  onClose,
}: {
  doc: FilableDoc;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const items = useCollectionsStore((s) => s.items);
  const toggle = useCollectionsStore((s) => s.toggle);
  const showToast = useToastStore((s) => s.showToast);

  return (
    <>
      <Backdrop onPress={onClose} opacity={0.38} />
      <BottomSheet onHandle={onClose}>
        <Box paddingBottom={4} paddingTop={6}>
          <SectionLabel>{tr("library.collections.addTo")}</SectionLabel>
          <Text
            numberOfLines={2}
            size={15}
            style={{ marginTop: 6 }}
            weight="600"
          >
            {doc.name}
          </Text>
        </Box>

        <Box gap={8} paddingTop={14}>
          {COLLECTION_META.map(({ emoji, id }) => {
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
                  gap={12}
                  paddingX={14}
                  paddingY={13}
                  rounded={12}
                >
                  <Text size={18}>{emoji}</Text>
                  <Box flex={1}>
                    <Text
                      color={filed ? t.accentText : t.ink}
                      size={14}
                      weight="600"
                    >
                      {label}
                    </Text>
                    <Text color={t.sub} size={11.5} style={{ marginTop: 2 }}>
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
      </BottomSheet>
    </>
  );
}
