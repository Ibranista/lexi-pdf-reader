import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Box } from "@/components/atoms";
import {
  IconChat,
  IconClose,
  IconMic,
  LiveWave,
  Text,
} from "@/components/lexi-components";
import type { RealtimeVoice } from "@/hooks/use-realtime-voice";
import { useProtoTheme } from "@/theme/proto";

const SPRING = {
  damping: 26,
  mass: 0.7,
  stiffness: 320,
  overshootClamping: true,
} as const;

const MARGIN = 12;

const label = (live: RealtimeVoice) => {
  if (live.phase === "paused") return "Paused";
  if (live.phase === "connecting") return "Connecting…";
  if (live.muted) return "Muted";
  if (live.phase === "speaking") return "Speaking";
  if (live.phase === "thinking") return "Thinking…";
  return "Listening";
};

function Signal({ live }: { live: RealtimeVoice }) {
  const t = useProtoTheme();
  const breathe = useSharedValue(0.4);
  const thinking = live.phase === "thinking";

  useEffect(() => {
    breathe.value = thinking
      ? withRepeat(
          withSequence(
            withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
            withTiming(0.35, { duration: 520, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
          false,
        )
      : withTiming(0.4, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking]);

  const dot = useAnimatedStyle(() => ({ opacity: breathe.value }));

  if (live.phase === "connecting") {
    return <ActivityIndicator color={t.accent} size="small" />;
  }
  if (live.phase === "paused" || live.muted) {
    return (
      <Box
        align="center"
        bg={t.chip}
        height={26}
        justify="center"
        rounded={13}
        width={26}
      >
        <IconMic color={t.sub} size={14} />
      </Box>
    );
  }
  if (thinking) {
    return (
      <Box align="center" direction="row" gap={4} height={26}>
        {[0, 1, 2].map((i) => (
          <Reanimated.View
            key={i}
            style={[
              {
                backgroundColor: t.accent,
                borderRadius: 3,
                height: 6,
                width: 6,
              },
              dot,
            ]}
          />
        ))}
      </Box>
    );
  }
  return (
    <Box height={26} justify="center" width={54}>
      <LiveWave
        color={live.phase === "speaking" ? t.accent : t.sub}
        level={live.level}
        style={{ width: "100%" }}
        waveStyle={{ flex: 1 }}
      />
    </Box>
  );
}

function Action({
  children,
  label: name,
  onPress,
  tint,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
  tint: string;
}) {
  return (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={{ alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 }}
    >
      <Box
        align="center"
        bg={tint}
        height={32}
        justify="center"
        rounded={16}
        width={32}
      >
        {children}
      </Box>
    </Pressable>
  );
}

export function VoiceController({
  live,
  onEnd,
  onOpen,
}: {
  live: RealtimeVoice;
  onEnd: () => void;
  onOpen: () => void;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [size, setSize] = useState({ width: 240, height: 56 });

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const held = useSharedValue(0);

  const restingLeft = MARGIN;
  const restingBottom = insets.bottom + 24;
  const maxX = Math.max(0, width - size.width - MARGIN * 2);
  const minY = -Math.max(
    0,
    height - insets.top - insets.bottom - size.height - restingBottom - MARGIN,
  );

  const bump = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const drag = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
      held.value = withTiming(1, { duration: 120 });
    })
    .onUpdate((event) => {
      x.value = Math.min(maxX, Math.max(0, startX.value + event.translationX));
      y.value = Math.min(0, Math.max(minY, startY.value + event.translationY));
    })
    .onEnd(() => {
      x.value = withSpring(x.value + size.width / 2 > width / 2 ? maxX : 0, SPRING);
      y.value = withSpring(y.value, SPRING);
      held.value = withTiming(0, { duration: 160 });
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: 1 + held.value * 0.02 },
    ],
  }));

  const muteLabel = live.muted ? "Unmute microphone" : "Mute microphone";

  return (
    <GestureDetector gesture={drag}>
      <Reanimated.View
        accessibilityLabel={`Liqrai voice, ${label(live)}. Drag to move.`}
        onLayout={(event) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          if (w && h && (w !== size.width || h !== size.height))
            setSize({ width: w, height: h });
        }}
        style={[
          {
            bottom: restingBottom,
            left: restingLeft,
            position: "absolute",
            zIndex: 36,
          },
          style,
        ]}
      >
        <Box
          align="center"
          bg={t.card}
          borderColor={live.phase === "paused" ? t.line : t.accentMid}
          borderWidth={1}
          direction="row"
          gap={10}
          paddingLeft={14}
          paddingRight={6}
          paddingY={6}
          rounded={28}
          style={{
            elevation: 10,
            shadowColor: "#14100C",
            shadowOffset: { height: 8, width: 0 },
            shadowOpacity: 0.18,
            shadowRadius: 20,
          }}
        >
          <Signal live={live} />
          <Text
            accessibilityLiveRegion="polite"
            color={live.phase === "paused" ? t.sub : t.ink}
            size={12.5}
            weight="600"
          >
            {label(live)}
          </Text>

          {live.phase === "paused" ? (
            <Action
              label="Resume conversation"
              onPress={() => {
                bump();
                live.start();
              }}
              tint={t.accentSoft}
            >
              <IconMic color={t.accent} size={15} />
            </Action>
          ) : (
            <Action
              label={muteLabel}
              onPress={() => {
                bump();
                live.toggleMute();
              }}
              tint={live.muted ? t.chip : t.accentSoft}
            >
              <IconMic color={live.muted ? t.sub : t.accent} size={15} />
            </Action>
          )}
          <Action label="Open chat" onPress={onOpen} tint={t.chip}>
            <IconChat color={t.sub} size={15} />
          </Action>
          <Action
            label="End conversation"
            onPress={() => {
              bump();
              onEnd();
            }}
            tint={t.chip}
          >
            <IconClose color={t.sub} size={14} />
          </Action>
        </Box>
      </Reanimated.View>
    </GestureDetector>
  );
}
