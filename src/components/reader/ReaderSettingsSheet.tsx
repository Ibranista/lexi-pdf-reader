import { forwardRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Divider,
  ProtoSlider,
  SectionLabel,
  Segmented,
  type SegmentItem,
  Tap,
  Text,
  Toggle,
} from "@/components/lexi-components";
import {
  BottomSheetModal,
  type BottomSheetModalReference,
} from "@/components/modals/BottomSheetModal/BottomSheetModal";
import type {
  FocusSensitivity,
  FontFam,
  LineSpacing,
} from "@/stores/app-store";
import { useAppStore } from "@/stores/app-store";
import { dysFamily, hankenFamily } from "@/theme/app-fonts";
import { useProtoTheme, useThemeModeStore } from "@/theme/proto";

type ThemeMode = "auto" | "dark" | "light";
type ViewMode = "page" | "reflow";

const MIN_TEXT = 13;
const MAX_TEXT = 23;

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_TICKS = [100];

const THEME_ITEMS: SegmentItem<ThemeMode>[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

const VIEW_MODE_ITEMS: SegmentItem<ViewMode>[] = [
  { key: "page", label: "Page" },
  { key: "reflow", label: "Reflow" },
];

const FAM_ITEMS: SegmentItem<FontFam>[] = [
  { key: "sans", label: "Sans", font: hankenFamily },
  { key: "serif", label: "Serif", serif: true },
  { key: "dys", label: "Dyslexic", font: dysFamily, flex: 1.3 },
];

const SPACING_ITEMS: SegmentItem<LineSpacing>[] = [
  { key: "compact", label: "Compact" },
  { key: "comfy", label: "Comfy" },
  { key: "airy", label: "Airy" },
];

const SENS_ITEMS: SegmentItem<FocusSensitivity>[] = [
  { key: "relaxed", label: "Relaxed" },
  { key: "balanced", label: "Balanced" },
  { key: "frequent", label: "Frequent" },
];

function Row({
  children,
  sub,
  title,
}: {
  children: React.ReactNode;
  sub: string;
  title: string;
}) {
  const t = useProtoTheme();
  return (
    <Box align="center" direction="row" gap={12} paddingY={8}>
      <Box flex={1}>
        <Text size={13.5} weight="600">
          {title}
        </Text>
        <Text color={t.sub} size={11.5} style={{ marginTop: 1 }}>
          {sub}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

function SubRow({
  children,
  sub,
  title,
}: {
  children: React.ReactNode;
  sub: string;
  title: string;
}) {
  const t = useProtoTheme();
  return (
    <Box align="center" direction="row" gap={12} paddingLeft={14} paddingY={8}>
      <Box
        bg={t.calmLine}
        rounded={2}
        style={{ alignSelf: "stretch" }}
        width={3}
      />
      <Box flex={1}>
        <Text size={13} weight="600">
          {title}
        </Text>
        <Text color={t.sub} size={11.5} style={{ marginTop: 1 }}>
          {sub}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

interface Props {
  focusMode?: boolean;
  onClose?: () => void;
  onToggleFocusMode?: () => void;
  onViewModeChange?: (mode: ViewMode) => void;
  viewMode?: ViewMode;
}

export const ReaderSettingsSheet = forwardRef<BottomSheetModalReference, Props>(
  (
    {
      focusMode = false,
      onClose,
      onToggleFocusMode,
      onViewModeChange,
      viewMode = "page",
    },
    ref,
  ) => {
    const t = useProtoTheme();
    const insets = useSafeAreaInsets();
    const app = useAppStore();
    const themeMode = useThemeModeStore((s) => s.mode);
    const setThemeMode = useThemeModeStore((s) => s.setMode);

    const stepText = (delta: number) =>
      app.set({
        textSize: Math.min(MAX_TEXT, Math.max(MIN_TEXT, app.textSize + delta)),
      });

    return (
      <BottomSheetModal
        backgroundStyle={{ backgroundColor: t.card }}
        containerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
        }}
        handleIndicatorStyle={{ backgroundColor: t.faint }}
        onClose={onClose}
        ref={ref}
        scrollable
        snapPoints={["68%"]}
      >
        <Box paddingBottom={6}>
          <Text serif size={19} weight="600">
            Reading settings
          </Text>
        </Box>

        <Box paddingBottom={8} paddingTop={10}>
          <SectionLabel size={11}>View</SectionLabel>
        </Box>
        <Segmented
          items={VIEW_MODE_ITEMS}
          onChange={(next) => onViewModeChange?.(next)}
          value={viewMode}
        />

        <Box paddingBottom={8} paddingTop={10}>
          <SectionLabel size={11}>Theme</SectionLabel>
        </Box>
        <Segmented
          items={THEME_ITEMS}
          onChange={(key) => setThemeMode(key)}
          value={themeMode}
        />

        <Box paddingBottom={8} paddingTop={18}>
          <SectionLabel size={11}>Reflow text</SectionLabel>
          <Text color={t.sub} size={11.5} style={{ marginTop: 3 }}>
            Applies only in Reflow view, not the original PDF page view.
          </Text>
        </Box>
        <Box align="center" direction="row" gap={10}>
          <Box flex={1}>
            <Segmented
              items={FAM_ITEMS}
              onChange={(key) => app.set({ fontFam: key })}
              size={12.5}
              value={app.fontFam}
            />
          </Box>
          <Box
            align="center"
            bg={t.chip}
            direction="row"
            gap={2}
            padding={3}
            rounded={12}
          >
            <Tap onPress={() => stepText(-1)} scale={0.9}>
              <Box align="center" paddingY={8} width={36}>
                <Text
                  color={app.textSize <= MIN_TEXT ? t.faint : t.ink}
                  size={15}
                  weight="600"
                >
                  −
                </Text>
              </Box>
            </Tap>
            <Box align="center" width={30}>
              <Text color={t.sub} size={12.5} weight="600">
                {app.textSize}
              </Text>
            </Box>
            <Tap onPress={() => stepText(1)} scale={0.9}>
              <Box align="center" paddingY={8} width={36}>
                <Text
                  color={app.textSize >= MAX_TEXT ? t.faint : t.ink}
                  size={15}
                  weight="600"
                >
                  +
                </Text>
              </Box>
            </Tap>
          </Box>
        </Box>

        <Box paddingBottom={8} paddingTop={18}>
          <SectionLabel size={11}>Line spacing · Reflow only</SectionLabel>
        </Box>
        <Segmented
          items={SPACING_ITEMS}
          onChange={(key) => app.set({ lineSp: key })}
          value={app.lineSp}
        />

        <Box paddingBottom={10} paddingTop={18}>
          <Box
            direction="row"
            justify="between"
            style={{ alignItems: "baseline" }}
          >
            <SectionLabel size={11}>Smart zoom level</SectionLabel>
            <Text color={t.accentText} size={14} weight="600">
              {app.zoom}%
            </Text>
          </Box>
        </Box>
        <ProtoSlider
          curve="log"
          max={ZOOM_MAX}
          min={ZOOM_MIN}
          onChange={(v) => app.set({ zoom: v })}
          step={5}
          ticks={ZOOM_TICKS}
          value={app.zoom}
        />
        <Box direction="row" justify="between" paddingTop={4}>
          <Text color={t.faint} size={11}>
            {ZOOM_MIN}%
          </Text>
          <Text color={t.faint} size={11}>
            {ZOOM_MAX}%
          </Text>
        </Box>

        <Box paddingBottom={2} paddingTop={20}>
          <SectionLabel size={11}>Focus support</SectionLabel>
        </Box>

        <Row sub="Gentle nudges to keep your momentum" title="Focus reminder">
          <Toggle
            on={app.focusRem}
            onToggle={() => app.set({ focusRem: !app.focusRem })}
          />
        </Row>

        {app.focusRem ? (
          <Box paddingBottom={4} paddingTop={2}>
            <Segmented
              items={SENS_ITEMS}
              onChange={(key) => app.set({ focusSens: key })}
              size={12}
              value={app.focusSens}
            />
          </Box>
        ) : null}

        <Divider />

        <Row
          sub="Offer a short summary when a section loops"
          title="Flow reading"
        >
          <Toggle
            on={app.flowRead}
            onToggle={() => app.set({ flowRead: !app.flowRead })}
          />
        </Row>

        <Divider />

        <Row sub="Spotlight the paragraph you're reading" title="Focus mode">
          <Toggle on={focusMode} onToggle={() => onToggleFocusMode?.()} />
        </Row>

        {focusMode ? (
          <SubRow
            sub="Keep time & suggest breaks — or focus without the clock"
            title="Session timer"
          >
            <Toggle
              on={app.fmTimer}
              onToggle={() => app.set({ fmTimer: !app.fmTimer })}
            />
          </SubRow>
        ) : null}

        <Row
          sub="Explain, summarize and define as you read"
          title="AI companion"
        >
          <Toggle on={app.aiOn} onToggle={() => app.set({ aiOn: !app.aiOn })} />
        </Row>
      </BottomSheetModal>
    );
  },
);

ReaderSettingsSheet.displayName = "ReaderSettingsSheet";
