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
import { useAppStore, useToastStore } from "@/stores/app-store";
import { accountLabel, useAuthStore } from "@/stores/auth-store";
import type { ThemeMode } from "@/theme/proto";
import { useProtoTheme, useThemeModeStore } from "@/theme/proto";
import { SafeAreaView } from "react-native-safe-area-context";

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

/**
 * The Settings page body. Rendered both as the `/settings` route and as the
 * left drawer on the library screen, so how it dismisses is the caller's
 * call — hence `onClose` rather than a hard-coded `router.back()`.
 *
 * Memoised because as a drawer it stays mounted alongside the library screen,
 * which re-renders often (scan progress, pull-to-refresh). Without this the
 * panel re-rendered in step with it and the drag visibly hitched.
 */
export const SettingsPanel = memo(function SettingsPanel({
  onClose,
}: {
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const mode = useThemeModeStore((s) => s.mode);
  const setMode = useThemeModeStore((s) => s.setMode);
  // field-level selectors rather than `useAppStore()` — subscribing to the
  // whole store re-rendered the panel on every unrelated app-state change,
  // which shows up as stutter while the drawer is being dragged
  const pro = useAppStore((s) => s.pro);
  const aiOn = useAppStore((s) => s.aiOn);
  const lang = useAppStore((s) => s.lang);
  const zoom = useAppStore((s) => s.zoom);
  const syncPos = useAppStore((s) => s.syncPos);
  const defaultReader = useAppStore((s) => s.defaultReader);
  const setApp = useAppStore((s) => s.set);

  // Sub-pages push a full-screen route on top of the panel. We deliberately
  // keep the panel open underneath (whether it's the drawer over the library
  // or the `/settings` route) — the pushed page covers it while you're there,
  // and popping back reveals Settings again rather than dumping you on the
  // library home. Closing here would take Settings out of the back stack.
  const goTo = (pathname: "/plan" | "/reading-comfort" | "/ai-focus") => {
    router.push(pathname);
  };

  return (
    <ProtoScreen>
      <ScreenHeader onBack={onClose} title="Settings" />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingTop: 18,
            paddingBottom: 30,
            gap: 16,
          }}
          style={{ flex: 1 }}
        >
          {/* Appearance */}
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

          {/* Plan & preferences */}
          <Card gap={4}>
            <Box paddingBottom={8}>
              <SectionLabel>Plan & preferences</SectionLabel>
            </Box>
            <SettingsLink
              icon={<IconSpark color={t.accent} size={16} />}
              iconBg={t.accentSoft}
              onPress={() => goTo("/plan")}
              sub={
                pro
                  ? "LexiPDF Pro · trial active"
                  : "Free — reading forever free"
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

          {/* AI features */}
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

          {/* Default reader */}
          <Card gap={12}>
            <Box
              align="center"
              direction="row"
              gap={10}
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
                <IconType color={t.ink} size={17} />
              </Box>
              <Box flex={1}>
                <Text size={14} weight="600">
                  Default reader
                </Text>
                <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                  How documents open · offline always uses Page
                </Text>
              </Box>
            </Box>
            <Box paddingLeft={46}>
              <Segmented
                items={[
                  { key: "reflow" as const, label: "Reflow" },
                  { key: "page" as const, label: "Page" },
                ]}
                onChange={(k) => setApp({ defaultReader: k })}
                size={13}
                value={defaultReader}
              />
            </Box>
          </Card>

          {/* Smart zoom */}
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
            {/* Ratio scale with a detent at 100% — matches the reader sheet. */}
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

          {/* Sync */}
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

          {/* Account — last, and deliberately quiet. Nothing above it needs an
              account, so this is the one row that ever mentions signing in. */}
          <AccountCard />
        </ScrollView>
      </SafeAreaView>
    </ProtoScreen>
  );
});

/**
 * Signed out, this is an invitation; signed in, it's the only place to log out.
 * The library header's avatar used to carry this, which put an account control
 * on the busiest screen in the app for something you touch twice a year.
 */
function AccountCard() {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  if (!user) {
    return (
      <Card>
        <Tap onPress={() => router.push("/login")} scale={0.98}>
          <Box align="center" direction="row" gap={12}>
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
                Sign in
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                Keep your library across devices
              </Text>
            </Box>
            <IconChevron color={t.faint} size={16} />
          </Box>
        </Tap>
      </Card>
    );
  }

  return (
    <Card gap={14}>
      <Box align="center" direction="row" gap={12}>
        <Box
          align="center"
          bg={t.accentSoft}
          height={34}
          justify="center"
          rounded={10}
          width={34}
        >
          <Text color={t.accentText} size={13} weight="600">
            {accountLabel(user).slice(0, 2).toUpperCase()}
          </Text>
        </Box>
        <Box flex={1}>
          <Text numberOfLines={1} size={14} weight="600">
            {accountLabel(user)}
          </Text>
          {user.email ? (
            <Text color={t.sub} numberOfLines={1} size={12} style={{ marginTop: 2 }}>
              {user.email}
            </Text>
          ) : null}
        </Box>
      </Box>
      <Tap
        onPress={async () => {
          await signOut();
          showToast("Logged out");
        }}
        scale={0.97}
      >
        <Box align="center" bg={t.chip} paddingY={11} rounded={11}>
          <Text color={t.sub} size={13} weight="600">
            Log out
          </Text>
        </Box>
      </Tap>
    </Card>
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
