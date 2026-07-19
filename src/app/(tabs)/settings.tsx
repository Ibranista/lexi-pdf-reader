import { router } from "expo-router";
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
  PText,
  ScreenHeader,
  SectionLabel,
  Segmented,
  Tap,
  Toggle,
} from "@/components/lexi-components";
import { COLLECTIONS } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type { ThemeMode } from "@/theme/proto";
import { useProtoTheme, useThemeModeStore } from "@/theme/proto";

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

export default function SettingsScreen() {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const mode = useThemeModeStore((s) => s.mode);
  const setMode = useThemeModeStore((s) => s.setMode);
  const readerType = useOnboardingStore((s) => s.readerType);
  const app = useAppStore();

  const readerLabel = COLLECTIONS[readerType]?.label ?? "Student";

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} title="Settings" />

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
              <PText size={14} weight="600">
                Reader profile
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                {readerLabel} · shapes your collections
              </PText>
            </Box>
            <Tap
              onPress={() =>
                useOnboardingStore.setState({ hasCompletedOnboarding: false })
              }
              scale={0.95}
            >
              <Box bg={t.chip} paddingX={14} paddingY={9} rounded={11}>
                <PText size={12} weight="600">
                  Redo
                </PText>
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
            onPress={() => router.push("/plan")}
            sub={
              app.pro
                ? "LexiPDF Pro · trial active"
                : "Free — reading forever free"
            }
            title="Your plan"
          />
          <Divider />
          <SettingsLink
            icon={<IconType color={t.ink} size={16} />}
            iconBg={t.chip}
            onPress={() => router.push("/reading-comfort")}
            sub="Type, spacing, width & light"
            title="Reading comfort"
          />
          <Divider />
          <SettingsLink
            icon={<IconChat color={t.ink} size={16} />}
            iconBg={t.chip}
            onPress={() => router.push("/ai-focus")}
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
              <PText size={14} weight="600">
                AI assistance
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                Summaries, translation & context
              </PText>
            </Box>
            <Toggle
              on={app.aiOn}
              onToggle={() => {
                app.set({ aiOn: !app.aiOn });
                showToast(app.aiOn ? "AI assistance off" : "AI assistance on");
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
              <PText size={14} weight="600">
                Translation language
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                Used for tap-and-hold translate
              </PText>
            </Box>
          </Box>
          <Box paddingLeft={46}>
            {LANGS.map((l, i) => (
              <Tap key={l.key} onPress={() => app.set({ lang: l.key })}>
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
                  <PText
                    color={app.lang === l.key ? t.ink : t.sub}
                    size={14}
                    weight="500"
                  >
                    {l.label}
                  </PText>
                  {app.lang === l.key ? (
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
              <PText size={14} weight="600">
                Reading style & focus
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                Tap the page while reading — everything lives in one sheet
              </PText>
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
            <PText color={t.accentText} size={15} weight="600">
              {app.zoom}%
            </PText>
          </Box>
          <ProtoSlider
            max={200}
            min={100}
            onChange={(v) => app.set({ zoom: v })}
            step={5}
            value={app.zoom}
          />
          <Box direction="row" justify="between">
            <PText color={t.faint} size={11}>
              100%
            </PText>
            <PText color={t.faint} size={11}>
              200%
            </PText>
          </Box>
          <PText color={t.sub} size={12}>
            Applied when you double-tap a page.
          </PText>
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
              <PText size={14} weight="600">
                Sync reading position
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                Resume across devices
              </PText>
            </Box>
            <Toggle
              on={app.syncPos}
              onToggle={() => {
                app.set({ syncPos: !app.syncPos });
                showToast(app.syncPos ? "Sync off" : "Syncing across devices");
              }}
            />
          </Box>
        </Card>
      </ScrollView>
    </ProtoScreen>
  );
}

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
          <PText size={14} weight="600">
            {title}
          </PText>
          <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
            {sub}
          </PText>
        </Box>
        <IconChevron color={t.faint} size={16} />
      </Box>
    </Tap>
  );
}
