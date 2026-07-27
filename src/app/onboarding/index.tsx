import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import { ProtoScreen, Tap, Text } from "@/components/lexi-components";
import { READING_INTEREST_IDS } from "@/constants/onboarding";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useProtoTheme } from "@/theme/proto";

/**
 * The whole of onboarding: one question about what you read, then straight
 * into the library.
 */
export default function OnboardingScreen() {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("onboarding");
  const insets = useSafeAreaInsets();
  const interests = useOnboardingStore((s) => s.interests);
  const toggleInterest = useOnboardingStore((s) => s.toggleInterest);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const start = () => {
    completeOnboarding();
    router.replace("/");
  };

  return (
    <ProtoScreen>
      <Box align="center" direction="row" justify="end" paddingRight={12}>
        <Tap onPress={start} scale={0.94}>
          <Box paddingX={12} paddingY={10}>
            <Text color={t.sub} size={14} weight="600">
              {tr("skipLabel")}
            </Text>
          </Box>
        </Tap>
      </Box>

      <ScrollView
        contentContainerStyle={{
          gap: 24,
          padding: 20,
          paddingBottom: 30,
          paddingTop: 12,
        }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <Box gap={10}>
          <Text serif size={28} weight="600">
            {tr("title")}
          </Text>
          <Text color={t.sub} lh={20} size={14}>
            {tr("subtitle")}
          </Text>
        </Box>

        <Box direction="row" gap={10} wrap="wrap">
          {READING_INTEREST_IDS.map((id) => (
            <InterestChip
              key={id}
              label={tr(`interests.${id}`)}
              onPress={() => toggleInterest(id)}
              selected={interests.includes(id)}
            />
          ))}
        </Box>
      </ScrollView>

      <Box paddingX={20} style={{ paddingBottom: 24 + insets.bottom }}>
        <Tap onPress={start} scale={0.98}>
          <Box
            align="center"
            bg={t.accent}
            height={54}
            justify="center"
            rounded={16}
          >
            <Text color={t.onAccent} size={15} weight="600">
              {tr("ctaLabel")}
            </Text>
          </Box>
        </Tap>
      </Box>
    </ProtoScreen>
  );
}

/**
 * One option as a pill. Selection is carried by colour alone — no check icon —
 * so toggling never changes a chip's width and reflows the rows underneath it.
 */
function InterestChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const t = useProtoTheme();
  return (
    <Tap onPress={onPress} scale={0.96}>
      <Box
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        align="center"
        bg={selected ? t.accentSoft : t.card}
        borderColor={selected ? t.accent : t.line}
        borderWidth={1.5}
        justify="center"
        paddingX={16}
        paddingY={11}
        rounded={999}
      >
        <Text color={selected ? t.accentText : t.ink} size={14} weight="600">
          {label}
        </Text>
      </Box>
    </Tap>
  );
}
