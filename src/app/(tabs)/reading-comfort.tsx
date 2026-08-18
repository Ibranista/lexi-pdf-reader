import { router } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Card,
  ProtoScreen,
  ProtoSlider,
  Text,
  ScreenHeader,
  SectionLabel,
  Segmented,
} from "@/components/lexi-components";
import type {
  Contrast,
  FontFam,
  LineSpacing,
  ReadWidth,
} from "@/stores/app-store";
import { LINE_SPACING, useAppStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

// Named, not categorised — see the reader's settings sheet. Shortened here
// because these sit in a segmented control with no room for the full names.
const FAM_ITEMS: { key: FontFam; label: string; serif?: boolean }[] = [
  { key: "serif", label: "Literata", serif: true },
  { key: "sans", label: "Hanken" },
  { key: "dys", label: "Atkinson" },
  { key: "comic", label: "Comic" },
];

const LS_ITEMS: { key: LineSpacing; label: string }[] = [
  { key: "compact", label: "Compact" },
  { key: "comfy", label: "Comfortable" },
  { key: "airy", label: "Airy" },
];

const RW_ITEMS: { key: ReadWidth; label: string }[] = [
  { key: "narrow", label: "Narrow" },
  { key: "comfort", label: "Comfort" },
  { key: "full", label: "Full" },
];

const CT_ITEMS: { key: Contrast; label: string }[] = [
  { key: "soft", label: "Soft" },
  { key: "std", label: "Standard" },
];

export default function ReadingComfortScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const app = useAppStore();

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} title="Reading comfort" />

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 18,
          paddingBottom: 30 + insets.bottom,
          gap: 14,
        }}
        style={{ flex: 1 }}
      >
        {/* live preview */}
        <Box
          bg={t.page}
          borderColor={t.line}
          borderWidth={1}
          paddingX={20}
          paddingY={18}
          rounded={16}
        >
          <Text
            color={t.readerInk}
            lh={app.textSize * (LINE_SPACING[app.lineSp] ?? 1.75)}
            serif={app.fontFam === "serif"}
            size={app.textSize}
          >
            The quick preview shows exactly how your pages will read with these
            settings.
          </Text>
        </Box>

        <Card gap={12}>
          <Box
            direction="row"
            justify="between"
            style={{ alignItems: "baseline" }}
          >
            <SectionLabel>Font size</SectionLabel>
            <Text color={t.accentText} size={14} weight="600">
              {app.textSize} pt
            </Text>
          </Box>
          <ReflowNote />
          <Box align="center" direction="row" gap={14}>
            <Text color={t.sub} serif size={13}>
              A
            </Text>
            <Box flex={1}>
              <ProtoSlider
                max={22}
                min={14}
                onChange={(v) => app.set({ textSize: v })}
                value={app.textSize}
              />
            </Box>
            <Text color={t.sub} serif size={20}>
              A
            </Text>
          </Box>
          <Box marginTop={4}>
            <SectionLabel>Typeface</SectionLabel>
          </Box>
          <Segmented
            items={FAM_ITEMS}
            onChange={(key) => app.set({ fontFam: key })}
            size={13}
            value={app.fontFam}
          />
        </Card>

        <Card gap={12}>
          <SectionLabel>Line spacing</SectionLabel>
          <ReflowNote />
          <Segmented
            items={LS_ITEMS}
            onChange={(key) => app.set({ lineSp: key })}
            size={13}
            value={app.lineSp}
          />
          <Box marginTop={4}>
            <SectionLabel>Reading width & margins</SectionLabel>
          </Box>
          <ReflowNote />
          <Segmented
            items={RW_ITEMS}
            onChange={(key) => app.set({ readWidth: key })}
            size={13}
            value={app.readWidth}
          />
        </Card>

        <Card gap={12}>
          <Box
            direction="row"
            justify="between"
            style={{ alignItems: "baseline" }}
          >
            <SectionLabel>Page brightness</SectionLabel>
            <Text color={t.accentText} size={14} weight="600">
              {app.bright}%
            </Text>
          </Box>
          <Text color={t.sub} size={11.5} style={{ marginTop: -4 }}>
            Applies to both Page and Reflow views.
          </Text>
          <ProtoSlider
            max={100}
            min={40}
            onChange={(v) => app.set({ bright: v })}
            step={5}
            value={app.bright}
          />
          <Box paddingTop={2}>
            <Box align="center" direction="row" justify="between">
              <SectionLabel>Contrast</SectionLabel>
              <Box width={170}>
                <Segmented
                  items={CT_ITEMS}
                  onChange={(key) => app.set({ contrast: key })}
                  value={app.contrast}
                />
              </Box>
            </Box>
            <ReflowNote />
          </Box>
        </Card>

        <Text align="center" color={t.faint} size={12}>
          Set once from your onboarding answers — adjust anytime.
        </Text>
      </ScrollView>
    </ProtoScreen>
  );
}

/**
 * Marks a control that only restyles the reflowed text, not the original PDF
 * page — mirrors the "Reflow only" labels in the reader's own settings sheet.
 */
function ReflowNote() {
  const t = useProtoTheme();
  return (
    <Text color={t.sub} size={11.5} style={{ marginTop: -4 }}>
      Reflow view only.
    </Text>
  );
}
