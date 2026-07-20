import { router } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  Card,
  Divider,
  ProtoScreen,
  PText,
  ScreenHeader,
  SectionLabel,
  Tap,
} from "@/components/lexi-components";
import { REVIEW_CARDS } from "@/constants/library";
import { useAppStore, useToastStore } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

export default function ReviewScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const setPage = useAppStore((s) => s.setPage);
  const [idx, setIdx] = useState(0);

  const card = REVIEW_CARDS[Math.min(idx, REVIEW_CARDS.length - 1)];

  const next = (message?: string) => {
    if (message) showToast(message);
    if (idx >= REVIEW_CARDS.length - 1) {
      showToast("Review done — see you tomorrow");
      router.back();
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <ProtoScreen>
      <ScreenHeader
        onBack={() => router.back()}
        right={
          <Box align="center" direction="row" gap={5}>
            {REVIEW_CARDS.map((_, i) => (
              <Box
                bg={i <= idx ? t.accent : t.chip}
                height={5}
                key={i}
                rounded={3}
                width={16}
              />
            ))}
          </Box>
        }
        subtitle={`Card ${idx + 1} of ${REVIEW_CARDS.length} · take your time`}
        title="Review"
      />

      <Box flex={1} gap={16} justify="center" paddingX={20}>
        <Card
          gap={18}
          padding={28}
          rounded={22}
          style={{
            shadowColor: "#201B15",
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.1,
            shadowRadius: 50,
            elevation: 10,
          }}
        >
          <SectionLabel size={11}>Question</SectionLabel>
          <PText lh={30} serif size={21} weight="500">
            {card.q}
          </PText>
          <Divider />
          <SectionLabel color={t.accentText} size={11}>
            Answer
          </SectionLabel>
          <PText lh={26} serif size={16}>
            {card.a}
          </PText>
          <Box
            align="center"
            bg={t.accentSoft}
            direction="row"
            gap={9}
            paddingX={13}
            paddingY={10}
            rounded={12}
          >
            <Box bg="#F2CE93" height={28} rounded={2} width={4} />
            <Box flex={1}>
              <PText color={t.sub} lh={17} size={11.5}>
                From your highlight · The Age of Light · p. {card.p} ·{" "}
                <PText
                  color={t.accentText}
                  onPress={() => {
                    setPage(card.p);
                    router.push("/reader");
                    showToast(`Jumped to page ${card.p}`);
                  }}
                  size={11.5}
                  weight="600"
                >
                  Reread in context
                </PText>
              </PText>
            </Box>
          </Box>
        </Card>

        <Box direction="row" gap={10}>
          <Tap
            onPress={() => next("No rush — it'll come back")}
            scale={0.97}
            style={{ flex: 1 }}
          >
            <Box
              align="center"
              bg={t.chip}
              height={52}
              justify="center"
              rounded={14}
            >
              <PText size={14} weight="600">
                Show again later
              </PText>
            </Box>
          </Tap>
          <Tap onPress={() => next()} scale={0.97} style={{ flex: 1 }}>
            <Box
              align="center"
              bg={t.accent}
              height={52}
              justify="center"
              rounded={14}
            >
              <PText color={t.onAccent} size={14} weight="600">
                Got it
              </PText>
            </Box>
          </Tap>
        </Box>
      </Box>

      <Box paddingX={20} style={{ paddingBottom: 30 + insets.bottom }}>
        <PText align="center" color={t.faint} size={12}>
          Cards come from your highlights. Stop anytime — nothing expires.
        </PText>
      </Box>
    </ProtoScreen>
  );
}
