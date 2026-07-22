import { router } from "expo-router";
import { memo } from "react";
import { ScrollView } from "react-native";

import { Box } from "@/components/atoms";
import {
  Card,
  Divider,
  IconChat,
  IconCheck,
  IconChevron,
  IconGlobe,
  IconGradCap,
  IconLeaf,
  IconSpark,
  IconSync,
  IconType,
  ProtoScreen,
  ProtoSlider,
  ScreenHeader,
  SectionLabel,
  Segmented,
  Tap,
  Text,
  Toggle,
} from "@/components/lexi-components";
import { COLLECTIONS } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type { ThemeMode } from "@/theme/proto";
import { useProtoTheme, useThemeModeStore } from "@/theme/proto";

const ZOOM_TICKS = [100];

const THEME_ITEMS: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

const LANGS = [
  { key: "am" as const, label: "አማርኛ · Amharic" },
  { key: "en" as const, label: "English" },
  { key: "ar" as const, label: "العربية · Arabic" },
];

export const SettingsPanel = memo(function SettingsPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const mode = useThemeModeStore((s) => s.mode);
  const setMode = useThemeModeStore((s) => s.setMode);
  const readerType = useOnboardingStore((s) => s.readerType);
  const pro = useAppStore((s) => s.pro);
  const aiOn = useAppStore((s) => s.aiOn);
  const lang = useAppStore((s) => s.lang);
  const zoom = useAppStore((s) => s.zoom);
  const syncPos = useAppStore((s) => s.syncPos);
  const setApp = useAppStore((s) => s.set);

  const readerLabel = COLLECTIONS[readerType]?.label ?? "Student";

  const goTo = (pathname: "/plan" | "/reading-comfort" | "/ai-focus") => {
    onClose();
    router.push(pathname);
  };

  return (
    <ProtoScreen>
      <ScreenHeader onBack={onClose} title="Settings" />

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 18,
          paddingBottom: 30,
          gap: 16,
        }}
        style={{ flex: 1 }}
      >
        <Card gap={12}>
          <SectionLabel>Appearance</SectionLabel>
          <Segmented
            items={THEME_ITEMS}
            onChange={(key) => {
              setMode(key);
              if (key === "auto") showToast("Auto — following system");
            }}
            size={13}
            value={mode}
          />
        </Card>

        <Card gap={12}>
          <SectionLabel>Personalization</SectionLabel>
          <Box align="center" direction="row" gap={12}>
            <Box
              align="center"
              bg={t.accentSoft}
              height={34}
              justify="center"
              rounded={10}
              width={34}
            >
              <IconGradCap color={t.accentText} size={17} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                Reader profile
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                {readerLabel} · shapes your collections
              </Text>
            </Box>
            <Tap
              onPress={() =>
                useOnboardingStore.setState({ hasCompletedOnboarding: false })
              }
              scale={0.95}
            >
              <Box bg={t.chip} paddingX={14} paddingY={9} rounded={11}>
                <Text size={12} weight="600">
                  Redo
                </Text>
              </Box>
            </Tap>
          </Box>
        </Card>

        <Card gap={4}>
          <Box paddingBottom={8}>
            <SectionLabel>Plan & preferences</SectionLabel>
          </Box>
          <SettingsLink
            icon={<IconSpark color={t.accent} size={16} />}
            iconBg={t.accentSoft}
            onPress={() => goTo("/plan")}
            sub={
              pro ? "LexiPDF Pro · trial active" : "Free — reading forever free"
            }
            title="Your plan"
          />
          <Divider />
          <SettingsLink
            icon={<IconType color={t.ink} size={16} />}
            iconBg={t.chip}
            onPress={() => goTo("/reading-comfort")}
            sub="Type, spacing, width & light"
            title="Reading comfort"
          />
          <Divider />
          <SettingsLink
            icon={<IconChat color={t.ink} size={16} />}
            iconBg={t.chip}
            onPress={() => goTo("/ai-focus")}
            sub="Explanation style, reminders, sync"
            title="AI, focus & review"
          />
        </Card>

        <Card gap={4}>
          <Box paddingBottom={8}>
            <SectionLabel>AI features</SectionLabel>
          </Box>
          <Box align="center" direction="row" gap={12} paddingY={8}>
            <Box
              align="center"
              bg={t.accentSoft}
              height={34}
              justify="center"
              rounded={10}
              width={34}
            >
              <IconSpark color={t.accent} size={17} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                AI assistance
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Summaries, translation & context
              </Text>
            </Box>
            <Toggle
              on={aiOn}
              onToggle={() => {
                setApp({ aiOn: !aiOn });
                showToast(aiOn ? "AI assistance off" : "AI assistance on");
              }}
            />
          </Box>
          <Divider />
          <Box
            align="center"
            direction="row"
            gap={12}
            paddingBottom={4}
            paddingTop={10}
          >
            <Box
              align="center"
              bg={t.chip}
              height={34}
              justify="center"
              rounded={10}
              width={34}
            >
              <IconGlobe color={t.ink} size={17} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                Translation language
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Used for tap-and-hold translate
              </Text>
            </Box>
          </Box>
          <Box paddingLeft={46}>
            {LANGS.map((l, i) => (
              <Tap key={l.key} onPress={() => setApp({ lang: l.key })}>
                <Box
                  align="center"
                  direction="row"
                  justify="between"
                  paddingY={10}
                  style={
                    i < LANGS.length - 1
                      ? { borderBottomWidth: 1, borderBottomColor: t.line }
                      : undefined
                  }
                >
                  <Text
                    color={lang === l.key ? t.ink : t.sub}
                    size={14}
                    weight="500"
                  >
                    {l.label}
                  </Text>
                  {lang === l.key ? (
                    <IconCheck color={t.accent} size={16} />
                  ) : null}
                </Box>
              </Tap>
            ))}
          </Box>
        </Card>

        <Card>
          <Box align="center" direction="row" gap={12}>
            <Box
              align="center"
              bg={t.calmSoft}
              height={34}
              justify="center"
              rounded={10}
              width={34}
            >
              <IconLeaf color={t.calm} size={17} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                Reading style & focus
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Tap the page while reading — everything lives in one sheet
              </Text>
            </Box>
          </Box>
        </Card>

        <Card gap={10}>
          <Box
            direction="row"
            justify="between"
            style={{ alignItems: "baseline" }}
          >
            <SectionLabel>Smart zoom level</SectionLabel>
            <Text color={t.accentText} size={15} weight="600">
              {zoom}%
            </Text>
          </Box>
          <ProtoSlider
            curve="log"
            max={200}
            min={50}
            onChange={(v) => setApp({ zoom: v })}
            step={5}
            ticks={ZOOM_TICKS}
            value={zoom}
          />
          <Box direction="row" justify="between">
            <Text color={t.faint} size={11}>
              50%
            </Text>
            <Text color={t.faint} size={11}>
              200%
            </Text>
          </Box>
          <Text color={t.sub} size={12}>
            Applied when you double-tap a page.
          </Text>
        </Card>

        <Card>
          <Box align="center" direction="row" gap={12}>
            <Box
              align="center"
              bg={t.chip}
              height={34}
              justify="center"
              rounded={10}
              width={34}
            >
              <IconSync color={t.ink} size={17} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                Sync reading position
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Resume across devices
              </Text>
            </Box>
            <Toggle
              on={syncPos}
              onToggle={() => {
                setApp({ syncPos: !syncPos });
                showToast(syncPos ? "Sync off" : "Syncing across devices");
              }}
            />
          </Box>
        </Card>
      </ScrollView>
    </ProtoScreen>
  );
});

function SettingsLink({
  icon,
  iconBg,
  onPress,
  sub,
  title,
}: {
  icon: React.ReactNode;
  iconBg: string;
  onPress: () => void;
  sub: string;
  title: string;
}) {
  const t = useProtoTheme();
  return (
    <Tap onPress={onPress}>
      <Box align="center" direction="row" gap={12} paddingY={8}>
        <Box
          align="center"
          bg={iconBg}
          height={34}
          justify="center"
          rounded={10}
          width={34}
        >
          {icon}
        </Box>
        <Box flex={1}>
          <Text size={14} weight="600">
            {title}
          </Text>
          <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
            {sub}
          </Text>
        </Box>
        <IconChevron color={t.faint} size={16} />
      </Box>
    </Tap>
  );
}
