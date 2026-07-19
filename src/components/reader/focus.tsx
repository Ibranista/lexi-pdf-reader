/**
 * Focus-mode chrome: the status pill, "next section" action, and break card.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import { IconCheck, IconClose, PText, Tap } from "@/components/lexi-components";
import { useProtoTheme } from "@/theme/proto";

export function FocusPill({
  onExit,
  sessionSec,
  timerOn,
}: {
  onExit: () => void;
  sessionSec: number;
  timerOn: boolean;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const mm = Math.floor(sessionSec / 60);
  const ss = sessionSec % 60;

  return (
    <Box
      align="center"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 14,
        left: 0,
        right: 0,
        zIndex: 32,
      }}
    >
      <Box
        align="center"
        bg={t.glass}
        borderColor={t.line}
        borderWidth={1}
        direction="row"
        gap={10}
        paddingLeft={16}
        paddingRight={8}
        paddingY={7}
        rounded={22}
      >
        <Box bg={t.calm} height={7} rounded={4} width={7} />
        <PText size={12.5} weight="600">
          Focus
        </PText>
        {timerOn ? (
          <PText color={t.sub} mono size={12.5} weight="500">
            {mm}:{ss < 10 ? "0" : ""}
            {ss}
          </PText>
        ) : null}
        <Tap onPress={onExit} scale={0.9}>
          <Box
            align="center"
            bg={t.chip}
            height={28}
            justify="center"
            rounded={14}
            width={28}
          >
            <IconClose color={t.sub} size={13} />
          </Box>
        </Tap>
      </Box>
    </Box>
  );
}

export function NextSectionPill({ onPress }: { onPress: () => void }) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box
      align="center"
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 34 + insets.bottom,
        zIndex: 32,
      }}
    >
      <Tap onPress={onPress} scale={0.96}>
        <Box
          align="center"
          bg={t.pill}
          direction="row"
          gap={8}
          paddingX={22}
          paddingY={12}
          rounded={24}
          style={{
            shadowColor: "#14100C",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 30,
            elevation: 10,
          }}
        >
          <IconCheck color={t.accent} size={15} />
          <PText color={t.pillText} size={14} weight="600">
            Got it — next section
          </PText>
        </Box>
      </Tap>
    </Box>
  );
}

export function BreakCard({
  onSkip,
  onTake,
}: {
  onSkip: () => void;
  onTake: () => void;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  return (
    <Box
      style={{
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 100 + insets.bottom,
        zIndex: 33,
      }}
    >
      <Box
        align="center"
        bg={t.glass}
        borderColor={t.calmLine}
        borderWidth={1}
        direction="row"
        gap={10}
        paddingLeft={16}
        paddingRight={12}
        paddingY={12}
        rounded={18}
      >
        <Box flex={1}>
          <PText lh={19} size={13}>
            You’ve read 25 min — how about a 3-min break?
          </PText>
        </Box>
        <Tap onPress={onTake} scale={0.95}>
          <Box bg={t.calmSoft} paddingX={13} paddingY={9} rounded={12}>
            <PText color={t.calm} size={12.5} weight="600">
              Take it
            </PText>
          </Box>
        </Tap>
        <Tap onPress={onSkip} scale={0.95}>
          <Box bg={t.chip} paddingX={13} paddingY={9} rounded={12}>
            <PText size={12.5} weight="600">
              Keep going
            </PText>
          </Box>
        </Tap>
      </Box>
    </Box>
  );
}
