import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  IconCheck,
  IconClose,
  IconSpark,
  ProtoScreen,
  Text,
  Tap,
} from "@/components/lexi-components";
import { PW_FEATURES } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export default function PaywallScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const pwPlan = useAppStore((s) => s.pwPlan);
  const set = useAppStore((s) => s.set);

  const annual = pwPlan === "annual";

  return (
    <ProtoScreen>
      <Box direction="row" paddingLeft={16} paddingTop={8}>
        <Tap onPress={() => router.back()} scale={0.94}>
          <Box
            align="center"
            bg={t.chip}
            height={38}
            justify="center"
            rounded={12}
            width={38}
          >
            <IconClose color={t.ink} size={15} strokeWidth={2} />
          </Box>
        </Tap>
      </Box>

      <Box paddingTop={14} paddingX={28}>
        <Box
          align="center"
          bg={t.accentSoft}
          height={52}
          justify="center"
          rounded={16}
          width={52}
        >
          <IconSpark color={t.accent} size={24} />
        </Box>
        <Text
          lh={34}
          ls={-0.3}
          serif
          size={27}
          style={{ marginTop: 16 }}
          weight="600"
        >
          Meet your AI reading companion
        </Text>
        <Text color={t.sub} lh={21} size={14} style={{ marginTop: 8 }}>
          Reading stays free forever. Pro adds understanding.
        </Text>
      </Box>

      <Box gap={15} paddingTop={22} paddingX={28}>
        {PW_FEATURES.map((f) => (
          <Box direction="row" gap={13} key={f.name}>
            <Box paddingTop={2}>
              <IconSpark color={t.accent} size={16} />
            </Box>
            <Box flex={1}>
              <Text size={14} weight="600">
                {f.name}
              </Text>
              <Text color={t.sub} lh={18} size={12.5} style={{ marginTop: 1 }}>
                {f.sub}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box flex={1} />

      <Box gap={10} paddingX={20}>
        <Tap onPress={() => set({ pwPlan: "annual" })}>
          <Box
            align="center"
            bg={t.card}
            borderColor={annual ? t.accent : t.line}
            borderWidth={1.5}
            direction="row"
            gap={14}
            paddingX={16}
            paddingY={15}
            rounded={16}
          >
            <Box
              bg={t.accent}
              paddingX={9}
              paddingY={3}
              rounded={9}
              style={{ position: "absolute", top: -9, right: 14 }}
            >
              <Text color={t.onAccent} ls={0.5} size={10} weight="700">
                SAVE 29%
              </Text>
            </Box>
            <Box flex={1}>
              <Text size={15} weight="600">
                Annual
              </Text>
              <Text color={t.sub} size={12} style={{ marginTop: 2 }}>
                $59.88 / year
              </Text>
            </Box>
            <Text size={15} weight="600">
              $4.99
              <Text color={t.sub} size={12}>
                {" "}
                / mo
              </Text>
            </Text>
            <Box
              align="center"
              bg={annual ? t.accent : "transparent"}
              borderColor={annual ? t.accent : t.line}
              borderWidth={1.5}
              height={22}
              justify="center"
              rounded={11}
              width={22}
            >
              {annual ? (
                <IconCheck color={t.onAccent} size={12} strokeWidth={2.6} />
              ) : null}
            </Box>
          </Box>
        </Tap>

        <Tap onPress={() => set({ pwPlan: "monthly" })}>
          <Box
            align="center"
            bg={t.card}
            borderColor={annual ? t.line : t.accent}
            borderWidth={1.5}
            direction="row"
            gap={14}
            paddingX={16}
            paddingY={15}
            rounded={16}
          >
            <Box flex={1}>
              <Text size={15} weight="600">
                Monthly
              </Text>
            </Box>
            <Text size={15} weight="600">
              $6.99
              <Text color={t.sub} size={12}>
                {" "}
                / mo
              </Text>
            </Text>
            <Box
              align="center"
              bg={annual ? "transparent" : t.accent}
              borderColor={annual ? t.line : t.accent}
              borderWidth={1.5}
              height={22}
              justify="center"
              rounded={11}
              width={22}
            >
              {annual ? null : (
                <IconCheck color={t.onAccent} size={12} strokeWidth={2.6} />
              )}
            </Box>
          </Box>
        </Tap>
      </Box>

      <Box paddingX={20} paddingY={14}>
        <Tap
          onPress={() => {
            set({ pro: true });
            router.back();
            showToast("Welcome to Pro — trial started ✨");
          }}
          scale={0.98}
        >
          <Box
            align="center"
            bg={t.accent}
            height={54}
            justify="center"
            rounded={16}
          >
            <Text color={t.onAccent} size={15} weight="600">
              Start 7-day free trial
            </Text>
          </Box>
        </Tap>
      </Box>

      <Box
        align="center"
        direction="row"
        gap={18}
        justify="center"
        paddingX={20}
        style={{ paddingBottom: 30 + insets.bottom }}
      >
        <Text
          color={t.sub}
          onPress={() => showToast("Cancel anytime from your account")}
          size={11.5}
        >
          Cancel anytime
        </Text>
        <Text color={t.sub} size={11.5}>
          ·
        </Text>
        <Text
          color={t.sub}
          onPress={() => showToast("No previous purchase found")}
          size={11.5}
        >
          Restore purchase
        </Text>
        <Text color={t.sub} size={11.5}>
          ·
        </Text>
        <Text
          color={t.sub}
          onPress={() => showToast("lexipdf.app/terms")}
          size={11.5}
        >
          Terms
        </Text>
      </Box>
    </ProtoScreen>
  );
}
