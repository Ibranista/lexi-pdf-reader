import { router } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Card,
  IconSpark,
  ProtoScreen,
  PText,
  ScreenHeader,
  Tap,
} from "@/components/lexi-components";
import { PRO_ROWS } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export default function PlanScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const pro = useAppStore((s) => s.pro);

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} title="Your plan" />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 16 }}
        style={{ flex: 1 }}
      >
        <Card>
          <Box align="center" direction="row" gap={14}>
            <Box flex={1}>
              <PText size={15} weight="600">
                {pro ? "LexiPDF Pro (trial)" : "LexiPDF Free"}
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                {pro
                  ? "7-day trial · then $4.99/mo billed annually"
                  : "Reading & annotation, forever free"}
              </PText>
            </Box>
            <Box bg={t.chip} paddingX={12} paddingY={6} rounded={12}>
              <PText size={12} weight="600">
                Active
              </PText>
            </Box>
          </Box>
        </Card>

        <Box
          bg={t.card}
          borderColor={t.line}
          borderWidth={1}
          marginTop={16}
          rounded={18}
          style={{ overflow: "hidden" }}
        >
          <Box
            direction="row"
            paddingX={18}
            paddingY={14}
            style={{ borderBottomWidth: 1, borderBottomColor: t.line }}
          >
            <Box flex={1} />
            <Box align="center" width={60}>
              <PText color={t.sub} ls={0.7} size={11} upper weight="600">
                Free
              </PText>
            </Box>
            <Box align="center" width={60}>
              <PText color={t.accentText} ls={0.7} size={11} upper weight="600">
                Pro
              </PText>
            </Box>
          </Box>

          {PRO_ROWS.map((row, i) => (
            <Box
              align="center"
              direction="row"
              key={row.name}
              paddingX={18}
              paddingY={13}
              style={
                i < PRO_ROWS.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: t.line }
                  : undefined
              }
            >
              <Box align="center" direction="row" flex={1} gap={7}>
                {row.ai ? <IconSpark color={t.accent} size={13} /> : null}
                <PText size={13.5}>{row.name}</PText>
              </Box>
              <Box align="center" width={60}>
                <PText color={row.free === "—" ? t.faint : t.ink} size={13}>
                  {row.free}
                </PText>
              </Box>
              <Box align="center" width={60}>
                <PText color={t.accentText} size={13} weight="500">
                  {row.pro}
                </PText>
              </Box>
            </Box>
          ))}
        </Box>

        <PText
          align="center"
          color={t.sub}
          lh={17}
          size={11.5}
          style={{ marginTop: 12 }}
        >
          Students save 40% with an academic email
        </PText>
      </ScrollView>

      <Box paddingX={20} style={{ paddingBottom: 30 + insets.bottom }}>
        <Tap
          onPress={() => {
            if (pro) {
              showToast("Manage in App Store settings");
              return;
            }
            router.push("/paywall");
          }}
          scale={0.98}
        >
          <Box
            align="center"
            bg={t.accent}
            direction="row"
            gap={8}
            height={54}
            justify="center"
            rounded={16}
          >
            <IconSpark color={t.onAccent} size={15} />
            <PText color={t.onAccent} size={15} weight="600">
              {pro ? "Manage subscription" : "Try Pro free for 7 days"}
            </PText>
          </Box>
        </Tap>
      </Box>
    </ProtoScreen>
  );
}
