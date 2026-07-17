import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/atoms';
import { Card, ProtoScreen, ProtoSlider, PText, ScreenHeader, SectionLabel, Segmented } from '@/components/proto';
import type { Contrast, FontFam, LineSpacing, ReadWidth } from '@/stores/app-store';
import { LINE_SPACING, useAppStore } from '@/stores/app-store';
import { useProtoTheme } from '@/theme/proto';

const FAM_ITEMS: { key: FontFam; label: string; serif?: boolean }[] = [
  { key: 'sans', label: 'Sans' },
  { key: 'serif', label: 'Serif', serif: true },
  { key: 'dys', label: 'Dyslexic' },
];

const LS_ITEMS: { key: LineSpacing; label: string }[] = [
  { key: 'compact', label: 'Compact' },
  { key: 'comfy', label: 'Comfortable' },
  { key: 'airy', label: 'Airy' },
];

const RW_ITEMS: { key: ReadWidth; label: string }[] = [
  { key: 'narrow', label: 'Narrow' },
  { key: 'comfort', label: 'Comfort' },
  { key: 'full', label: 'Full' },
];

const CT_ITEMS: { key: Contrast; label: string }[] = [
  { key: 'soft', label: 'Soft' },
  { key: 'std', label: 'Standard' },
];

export default function ReadingComfortScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const app = useAppStore();

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} title="Reading comfort" />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 30 + insets.bottom, gap: 14 }}
        style={{ flex: 1 }}
      >
        {/* live preview */}
        <Box bg={t.page} borderColor={t.line} borderWidth={1} paddingX={20} paddingY={18} rounded={16}>
          <PText
            color={t.readerInk}
            lh={app.textSize * (LINE_SPACING[app.lineSp] ?? 1.75)}
            serif={app.fontFam === 'serif'}
            size={app.textSize}
          >
            The quick preview shows exactly how your pages will read with these settings.
          </PText>
        </Box>

        <Card gap={12}>
          <Box direction="row" justify="between" style={{ alignItems: 'baseline' }}>
            <SectionLabel>Font size</SectionLabel>
            <PText color={t.accentText} size={14} weight="600">
              {app.textSize} pt
            </PText>
          </Box>
          <Box align="center" direction="row" gap={14}>
            <PText color={t.sub} serif size={13}>
              A
            </PText>
            <Box flex={1}>
              <ProtoSlider max={22} min={14} onChange={(v) => app.set({ textSize: v })} value={app.textSize} />
            </Box>
            <PText color={t.sub} serif size={20}>
              A
            </PText>
          </Box>
          <Box marginTop={4}>
            <SectionLabel>Typeface</SectionLabel>
          </Box>
          <Segmented items={FAM_ITEMS} onChange={(key) => app.set({ fontFam: key })} size={13} value={app.fontFam} />
        </Card>

        <Card gap={12}>
          <SectionLabel>Line spacing</SectionLabel>
          <Segmented items={LS_ITEMS} onChange={(key) => app.set({ lineSp: key })} size={13} value={app.lineSp} />
          <Box marginTop={4}>
            <SectionLabel>Reading width & margins</SectionLabel>
          </Box>
          <Segmented items={RW_ITEMS} onChange={(key) => app.set({ readWidth: key })} size={13} value={app.readWidth} />
        </Card>

        <Card gap={12}>
          <Box direction="row" justify="between" style={{ alignItems: 'baseline' }}>
            <SectionLabel>Page brightness</SectionLabel>
            <PText color={t.accentText} size={14} weight="600">
              {app.bright}%
            </PText>
          </Box>
          <ProtoSlider max={100} min={40} onChange={(v) => app.set({ bright: v })} step={5} value={app.bright} />
          <Box align="center" direction="row" justify="between" paddingTop={2}>
            <SectionLabel>Contrast</SectionLabel>
            <Box width={170}>
              <Segmented items={CT_ITEMS} onChange={(key) => app.set({ contrast: key })} value={app.contrast} />
            </Box>
          </Box>
        </Card>

        <PText align="center" color={t.faint} size={12}>
          Set once from your onboarding answers — adjust anytime.
        </PText>
      </ScrollView>
    </ProtoScreen>
  );
}
