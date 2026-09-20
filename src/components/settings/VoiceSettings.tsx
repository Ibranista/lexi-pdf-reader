import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useQuery } from "@tanstack/react-query";

import { Box } from "@/components/atoms";
import {
  Card,
  IconCheck,
  SectionLabel,
  SpeakingWave,
  Text,
  useDrawerGesture,
} from "@/components/lexi-components";
import {
  cachedVoiceSample,
  fetchVoices,
  type AiVoice,
} from "@/services/voices";
import { useAppStore, useToastStore, type Lang } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

const languages: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "am", name: "አማርኛ" },
  { id: "ar", name: "العربية" },
];

const LANG_LABELS: Record<Lang, string> = {
  am: "Amharic",
  ar: "Arabic",
  en: "English",
};

const GAP = 12;

export function VoiceSettings({
  registerStop,
}: {
  registerStop: (stop: () => void) => void;
}) {
  const t = useProtoTheme();
  const { width } = useWindowDimensions();
  const selected = useAppStore((s) => s.voiceId);
  const defaultLanguage = useAppStore((s) => s.lang);
  const setApp = useAppStore((s) => s.set);
  const showToast = useToastStore((s) => s.showToast);
  const [language, setLanguage] = useState<Lang>(defaultLanguage);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const voices = useQuery({
    queryKey: ["ai-voices"],
    queryFn: fetchVoices,
    staleTime: 5 * 60 * 1000,
  });

  const cardWidth = Math.min(232, width - 108);
  const snap = cardWidth + GAP;
  const sidePadding = 16;

  const drawerGesture = useDrawerGesture();
  const rowGesture = useMemo(() => {
    const native = Gesture.Native();
    return drawerGesture ? native.blocksExternalGesture(drawerGesture) : native;
  }, [drawerGesture]);

  const stop = useCallback(() => {
    sequence.current += 1;
    player.pause();
    setPreview(null);
    setLoading(false);
  }, [player]);

  useEffect(() => {
    registerStop(stop);
    return () => registerStop(() => {});
  }, [registerStop, stop]);
  useFocusEffect(useCallback(() => () => stop(), [stop]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      sub.remove();
      sequence.current += 1;
    };
  }, [stop]);
  useEffect(() => {
    if (status.didJustFinish) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      setLoading(false);
    }
  }, [status.didJustFinish]);
  useEffect(() => {
    if (!status.error) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stop();
    showToast("This voice sample could not be played.");
  }, [showToast, status.error, stop]);

  const play = useCallback(
    async (voice: AiVoice, { toggle = false } = {}) => {
      const isCurrent = preview === voice.id;
      stop();
      if (isCurrent && toggle) return;
      const url = voice.samples[language];
      if (!url || !voice.supportedLanguages.includes(language)) return;
      const attempt = sequence.current;
      setPreview(voice.id);
      setLoading(true);
      try {
        const uri = await cachedVoiceSample(url);
        if (attempt !== sequence.current) return;
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
        if (attempt !== sequence.current) return;
        player.replace({ uri });
        player.play();
        setLoading(false);
      } catch {
        if (attempt !== sequence.current) return;
        stop();
        showToast(
          "Couldn't play this sample. Check your connection and try again."
        );
      }
    },
    [language, player, preview, showToast, stop]
  );

  const onSettled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const list = voices.data;
    if (!list?.length) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / snap);
    const voice = list[Math.max(0, Math.min(list.length - 1, index))];
    if (voice && voice.id !== preview) void play(voice);
  };

  return (
    <Card gap={12}>
      <SectionLabel>Voice</SectionLabel>
      <Text color={t.sub} size={12}>
        Swipe through the voices — each one speaks as it arrives. Tap a card to
        make it Liqrai&apos;s voice.
      </Text>

      <Text size={12} weight="600">
        Preview language
      </Text>
      <Box direction="row" gap={6}>
        {languages.map((lang) => (
          <Pressable
            key={lang.id}
            accessibilityLabel={`Preview language: ${lang.name}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: language === lang.id }}
            onPress={() => {
              stop();
              setLanguage(lang.id);
            }}
            style={{
              alignItems: "center",
              backgroundColor: language === lang.id ? t.accentSoft : t.chip,
              borderRadius: 12,
              flex: 1,
              justifyContent: "center",
              minHeight: 48,
            }}
          >
            <Text size={12}>{lang.name}</Text>
          </Pressable>
        ))}
      </Box>

      {voices.isPending ? (
        <Text size={13}>Loading voices…</Text>
      ) : voices.isError ? (
        <Pressable
          accessibilityLabel="Retry loading voices"
          accessibilityRole="button"
          onPress={() => void voices.refetch()}
          style={{ justifyContent: "center", minHeight: 48 }}
        >
          <Text size={13}>Couldn&apos;t load voices · Retry</Text>
        </Pressable>
      ) : (
        <GestureDetector gesture={rowGesture}>
          <ScrollView
            contentContainerStyle={{ gap: GAP, paddingHorizontal: sidePadding }}
            decelerationRate="fast"
            horizontal
            onMomentumScrollEnd={onSettled}
            showsHorizontalScrollIndicator={false}
            snapToInterval={snap}
            style={{ marginHorizontal: -16 }}
          >
            {voices.data.map((voice) => {
              const supported = voice.supportedLanguages.includes(language);
              const available = supported && Boolean(voice.samples[language]);
              const playing = preview === voice.id;
              const chosen = selected === voice.id;
              return (
                <Pressable
                  key={voice.id}
                  accessibilityHint={
                    available
                      ? "Double tap to hear it and choose it"
                      : undefined
                  }
                  accessibilityLabel={`${voice.name}, ${voice.description}. ${
                    chosen ? "Selected. " : ""
                  }Speaks ${voice.supportedLanguages
                    .map((id) => LANG_LABELS[id])
                    .join(", ")}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  onPress={() => {
                    if (selected !== voice.id)
                      showToast(`Liqrai will speak as ${voice.name}`);
                    setApp({ voiceId: voice.id });
                    void play(voice, { toggle: true });
                  }}
                  style={{ width: cardWidth }}
                >
                  <Box
                    bg={chosen ? t.accentSoft : t.chip}
                    borderColor={chosen ? t.accentMid : t.line}
                    borderWidth={1}
                    gap={8}
                    padding={14}
                    rounded={16}
                    style={{ minHeight: 148 }}
                  >
                    <Box align="center" direction="row" gap={8}>
                      <Text size={15} weight="600">
                        {voice.name}
                      </Text>
                      {chosen ? <IconCheck color={t.accent} size={14} /> : null}
                    </Box>
                    <Text color={t.sub} size={12}>
                      {voice.description}
                    </Text>
                    <Text color={t.sub} size={11}>
                      {voice.supportedLanguages
                        .map((id) => LANG_LABELS[id])
                        .join(" · ")}
                    </Text>

                    <Box align="center" direction="row" gap={8} height={24}>
                      {playing && loading ? (
                        <>
                          <ActivityIndicator color={t.accent} size="small" />
                          <Text color={t.sub} size={11}>
                            Loading…
                          </Text>
                        </>
                      ) : playing ? (
                        <>
                          <SpeakingWave color={t.accent} />
                          <Text color={t.accent} size={11} weight="600">
                            Speaking
                          </Text>
                        </>
                      ) : !supported ? (
                        <Text color={t.sub} size={11}>
                          Not in this language
                        </Text>
                      ) : !available ? (
                        <Text color={t.sub} size={11}>
                          Sample not available yet
                        </Text>
                      ) : (
                        <Text color={t.sub} size={11}>
                          {chosen ? "Liqrai's voice" : "Tap to choose"}
                        </Text>
                      )}
                    </Box>
                  </Box>
                </Pressable>
              );
            })}
          </ScrollView>
        </GestureDetector>
      )}
    </Card>
  );
}
