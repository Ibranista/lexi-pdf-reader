import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Box } from "@/components/atoms";
import { Card, SectionLabel, Text } from "@/components/lexi-components";
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

export function VoiceSettings({
  registerStop,
}: {
  registerStop: (stop: () => void) => void;
}) {
  const t = useProtoTheme();
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
  const play = async (voice: AiVoice) => {
    const isCurrent = preview === voice.id;
    stop();
    if (isCurrent) return;
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
        "Couldn't play this sample. Check your connection and try again.",
      );
    }
  };
  return (
    <Card gap={12}>
      <SectionLabel>Voice</SectionLabel>
      <Text size={12} color={t.sub}>
        Choose Liqrai’s voice for future conversations and spoken replies.
      </Text>
      <Text size={12} weight="600">
        Preview language
      </Text>
      <Box direction="row" gap={6}>
        {languages.map((lang) => (
          <Pressable
            key={lang.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: language === lang.id }}
            accessibilityLabel={`Preview language: ${lang.name}`}
            onPress={() => {
              stop();
              setLanguage(lang.id);
            }}
            style={{
              flex: 1,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 12,
              backgroundColor: language === lang.id ? t.accentSoft : t.chip,
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
          accessibilityRole="button"
          accessibilityLabel="Retry loading voices"
          onPress={() => void voices.refetch()}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text size={13}>Couldn’t load voices · Retry</Text>
        </Pressable>
      ) : (
        voices.data.map((voice) => {
          const supported = voice.supportedLanguages.includes(language);
          const available = supported && Boolean(voice.samples[language]);
          return (
            <Box
              key={voice.id}
              bg={selected === voice.id ? t.accentSoft : t.chip}
              rounded={12}
              padding={12}
            >
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === voice.id }}
                accessibilityLabel={`Select ${voice.name}, ${voice.description}`}
                onPress={() => setApp({ voiceId: voice.id })}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Text size={14} weight="600">
                  {voice.name}
                  {selected === voice.id ? " · Selected" : ""}
                </Text>
                <Text size={12} color={t.sub}>
                  {voice.description}
                </Text>
              </Pressable>
              <Text size={12} color={t.sub}>
                {voice.supportedLanguages
                  .map(
                    (id) =>
                      ({ en: "English", am: "Amharic", ar: "Arabic" }[id]),
                  )
                  .join(" · ")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !available }}
                accessibilityLabel={
                  preview === voice.id
                    ? `Stop ${voice.name} preview`
                    : `Preview ${voice.name} in ${language}`
                }
                disabled={!available}
                onPress={() => void play(voice)}
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  opacity: available ? 1 : 0.55,
                }}
              >
                <Text size={13} color={t.accent}>
                  {!supported
                    ? "Language not supported"
                    : !available
                    ? "Sample not available yet"
                    : preview === voice.id
                    ? loading
                      ? "Loading… · Stop"
                      : "Stop preview"
                    : "Play preview"}
                </Text>
              </Pressable>
            </Box>
          );
        })
      )}
    </Card>
  );
}
