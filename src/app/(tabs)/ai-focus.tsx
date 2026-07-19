import { router } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Card,
  Divider,
  ProtoScreen,
  PText,
  ScreenHeader,
  SectionLabel,
  Segmented,
  Tap,
  Toggle,
} from "@/components/lexi-components";
import type { ExplainStyle } from "@/stores/app-store";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

const ES_ITEMS: { key: ExplainStyle; label: string }[] = [
  { key: "simple", label: "Simple" },
  { key: "balanced", label: "Balanced" },
  { key: "advanced", label: "Advanced" },
];

export default function AiFocusScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const app = useAppStore();

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} title="AI, focus & sync" />

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 18,
          paddingBottom: 30 + insets.bottom,
          gap: 14,
        }}
        style={{ flex: 1 }}
      >
        <Card gap={12}>
          <SectionLabel>AI explanation style</SectionLabel>
          <Segmented
            items={ES_ITEMS}
            onChange={(key) => app.set({ explStyle: key })}
            size={13}
            value={app.explStyle}
          />
          <PText color={t.sub} size={12}>
            Default level for “Explain this” — you can still switch per answer.
          </PText>
        </Card>

        <Card gap={4}>
          <Box paddingBottom={8}>
            <SectionLabel>Focus & review</SectionLabel>
          </Box>
          <Box align="center" direction="row" gap={12} paddingY={8}>
            <Box flex={1}>
              <PText size={14} weight="600">
                Ask for a thought when ending
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                Powers “you were reading” on return
              </PText>
            </Box>
            <Toggle
              on={app.thoughtOn}
              onToggle={() => app.set({ thoughtOn: !app.thoughtOn })}
            />
          </Box>
          <Divider />
          <Box align="center" direction="row" gap={12} paddingY={8}>
            <Box flex={1}>
              <PText size={14} weight="600">
                Gentle session reminders
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                One quiet nudge, never repeated
              </PText>
            </Box>
            <Toggle
              on={app.focusRem}
              onToggle={() => {
                app.set({ focusRem: !app.focusRem });
                showToast(
                  app.focusRem
                    ? "Focus reminders off — no nudges anywhere"
                    : "Focus reminders on",
                );
              }}
            />
          </Box>
          <Divider />
          <Box align="center" direction="row" gap={12} paddingY={8}>
            <Box flex={1}>
              <PText size={14} weight="600">
                Review cards per day
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                From your highlights · never expires
              </PText>
            </Box>
            <Box
              align="center"
              bg={t.chip}
              direction="row"
              gap={12}
              paddingX={10}
              paddingY={6}
              rounded={11}
            >
              <Tap
                onPress={() =>
                  app.set({ cardsPerDay: Math.max(1, app.cardsPerDay - 1) })
                }
              >
                <PText
                  color={t.sub}
                  size={16}
                  style={{ paddingHorizontal: 4 }}
                  weight="600"
                >
                  −
                </PText>
              </Tap>
              <PText size={15} weight="600">
                {app.cardsPerDay}
              </PText>
              <Tap
                onPress={() =>
                  app.set({ cardsPerDay: Math.min(10, app.cardsPerDay + 1) })
                }
              >
                <PText
                  color={t.sub}
                  size={16}
                  style={{ paddingHorizontal: 4 }}
                  weight="600"
                >
                  +
                </PText>
              </Tap>
            </Box>
          </Box>
        </Card>

        <Card gap={4}>
          <Box paddingBottom={8}>
            <SectionLabel>Sync across devices</SectionLabel>
          </Box>
          <Box align="center" direction="row" justify="between" paddingY={8}>
            <PText size={14} weight="600">
              Reading position
            </PText>
            <Toggle
              on={app.syncPos}
              onToggle={() => app.set({ syncPos: !app.syncPos })}
            />
          </Box>
          <Divider />
          <Box align="center" direction="row" justify="between" paddingY={8}>
            <PText size={14} weight="600">
              Notes & highlights
            </PText>
            <Toggle
              on={app.syncNt}
              onToggle={() => app.set({ syncNt: !app.syncNt })}
            />
          </Box>
          <Divider />
          <Box align="center" direction="row" justify="between" paddingY={8}>
            <PText size={14} weight="600">
              Review progress
            </PText>
            <Toggle
              on={app.syncRv}
              onToggle={() => app.set({ syncRv: !app.syncRv })}
            />
          </Box>
        </Card>
      </ScrollView>
    </ProtoScreen>
  );
}
