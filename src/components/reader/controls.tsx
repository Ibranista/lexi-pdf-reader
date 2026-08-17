import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  BottomSheet,
  Divider,
  IconBack,
  IconBookmark,
  IconFocus,
  IconPencil,
  IconSearch,
  IconSpark,
  ProtoSlider,
  SectionLabel,
  Segmented,
  Tap,
  Text,
  Toggle,
} from "@/components/lexi-components";
import { BOOK_PAGES, BOOK_TITLE } from "@/constants/library";
import type { FocusSensitivity, FontFam } from "@/stores/app-store";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

const FAM_ITEMS: { key: FontFam; label: string; serif?: boolean }[] = [
  { key: "serif", label: "Literata", serif: true },
  { key: "sans", label: "Hanken" },
  { key: "dys", label: "Atkinson" },
  { key: "comic", label: "Comic" },
];

const SENS_ITEMS: { key: FocusSensitivity; label: string }[] = [
  { key: "relaxed", label: "Relaxed" },
  { key: "balanced", label: "Balanced" },
  { key: "frequent", label: "Frequent" },
];

export function ReaderTopBar({
  chapterLabel,
  isBookmarked,
  onBack,
  onBookmark,
  onFocus,
  onNotes,
  onSearch,
  onSummarize,
}: {
  chapterLabel: string;
  isBookmarked: boolean;
  onBack: () => void;
  onBookmark: () => void;
  onFocus: () => void;
  onNotes: () => void;
  onSearch: () => void;
  onSummarize: () => void;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box
      bg={t.glass}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        paddingTop: insets.top,
        borderBottomWidth: 1,
        borderBottomColor: t.line,
      }}
    >
      <Box
        align="center"
        direction="row"
        gap={10}
        paddingBottom={12}
        paddingTop={6}
        paddingX={16}
      >
        <TopIcon onPress={onBack}>
          <IconBack color={t.ink} size={19} />
        </TopIcon>
        <Box flex={1}>
          <Text numberOfLines={1} size={14} weight="600">
            {BOOK_TITLE}
          </Text>
          <Text color={t.sub} numberOfLines={1} size={11}>
            {chapterLabel}
          </Text>
        </Box>
        <Box direction="row" gap={2}>
          <TopIcon onPress={onSummarize}>
            <IconSpark color={t.accent} size={18} />
          </TopIcon>
          <TopIcon onPress={onFocus}>
            <IconFocus color={t.ink} size={19} />
          </TopIcon>
          <TopIcon onPress={onSearch}>
            <IconSearch color={t.ink} size={19} />
          </TopIcon>
          <TopIcon onPress={onNotes}>
            <IconPencil color={t.ink} size={18} />
          </TopIcon>
          <TopIcon onPress={onBookmark}>
            <IconBookmark
              color={isBookmarked ? t.accent : t.ink}
              fill={isBookmarked ? t.accent : "none"}
              size={18}
            />
          </TopIcon>
        </Box>
      </Box>
    </Box>
  );
}

function TopIcon({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress} scale={0.92}>
      <Box align="center" height={38} justify="center" rounded={11} width={38}>
        {children}
      </Box>
    </Tap>
  );
}

export function ReaderControlsSheet({
  onClose,
  onToggleFocusMode,
  focusMode,
}: {
  focusMode: boolean;
  onClose: () => void;
  onToggleFocusMode: () => void;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const app = useAppStore();

  const remaining = (BOOK_PAGES - app.page) * 0.66;
  const timeLeft = `${Math.floor(remaining / 60)}h ${Math.round(remaining % 60)}m left`;

  return (
    <BottomSheet onHandle={onClose} paddingX={20}>
      <Box gap={4} paddingBottom={12}>
        <ProtoSlider
          max={BOOK_PAGES}
          min={1}
          onChange={(v) => app.set({ page: v })}
          value={app.page}
        />
        <Box direction="row" justify="between">
          <Text color={t.sub} size={11}>
            Page {app.page} of {BOOK_PAGES}
          </Text>
          <Text color={t.sub} size={11}>
            {timeLeft}
          </Text>
        </Box>
      </Box>

      <Box paddingBottom={8} paddingTop={2}>
        <SectionLabel size={11}>Reading style</SectionLabel>
      </Box>
      <Box align="center" direction="row" gap={10} paddingBottom={14}>
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
          <Tap
            onPress={() =>
              app.set({ textSize: Math.max(13, app.textSize - 1) })
            }
            scale={0.9}
          >
            <Box align="center" paddingY={8} width={36}>
              <Text size={15} weight="600">
                −
              </Text>
            </Box>
          </Tap>
          <Box align="center" width={30}>
            <Text color={t.sub} size={12.5} weight="600">
              {app.textSize}
            </Text>
          </Box>
          <Tap
            onPress={() =>
              app.set({ textSize: Math.min(23, app.textSize + 1) })
            }
            scale={0.9}
          >
            <Box align="center" paddingY={8} width={36}>
              <Text size={15} weight="600">
                +
              </Text>
            </Box>
          </Tap>
        </Box>
      </Box>

      <Box paddingBottom={6}>
        <SectionLabel size={11}>Focus support</SectionLabel>
      </Box>
      <Box align="center" direction="row" gap={12} paddingY={7}>
        <Box flex={1}>
          <Text size={13.5} weight="600">
            Focus reminder
          </Text>
          <Text color={t.sub} size={11.5} style={{ marginTop: 1 }}>
            Gentle nudges to keep your momentum
          </Text>
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
      {app.focusRem ? (
        <Box marginBottom={6} marginTop={2}>
          <Segmented
            items={SENS_ITEMS}
            onChange={(key) => app.set({ focusSens: key })}
            value={app.focusSens}
          />
        </Box>
      ) : null}
      <Divider />
      <Box align="center" direction="row" gap={12} paddingY={7}>
        <Box flex={1}>
          <Text size={13.5} weight="600">
            Flow reading
          </Text>
          <Text color={t.sub} size={11.5} style={{ marginTop: 1 }}>
            Offer a short summary when a section loops
          </Text>
        </Box>
        <Toggle
          on={app.flowRead}
          onToggle={() => app.set({ flowRead: !app.flowRead })}
        />
      </Box>
      <Divider />
      <Box align="center" direction="row" gap={12} paddingTop={7}>
        <Box flex={1}>
          <Text size={13.5} weight="600">
            Focus mode
          </Text>
          <Text color={t.sub} size={11.5} style={{ marginTop: 1 }}>
            Spotlight the paragraph you’re reading
          </Text>
        </Box>
        <Toggle on={focusMode} onToggle={onToggleFocusMode} />
      </Box>
      {focusMode ? (
        <Box
          align="center"
          direction="row"
          gap={12}
          paddingLeft={14}
          paddingTop={7}
        >
          <Box
            bg={t.calmLine}
            rounded={2}
            style={{ alignSelf: "stretch" }}
            width={3}
          />
          <Box flex={1}>
            <Text size={13} weight="600">
              Session timer
            </Text>
            <Text color={t.sub} size={11.5} style={{ marginTop: 1 }}>
              Keep time & suggest breaks — or focus without the clock
            </Text>
          </Box>
          <Toggle
            on={app.fmTimer}
            onToggle={() => {
              app.set({ fmTimer: !app.fmTimer });
              showToast(
                app.fmTimer ? "Focus without the clock" : "Session timer on",
              );
            }}
          />
        </Box>
      ) : null}
    </BottomSheet>
  );
}
