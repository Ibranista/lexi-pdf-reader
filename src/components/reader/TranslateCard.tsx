import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TextStyle, ViewStyle } from "react-native";

import { ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Box } from "@/components/atoms";
import {
  Backdrop,
  IconClose,
  IconSpark,
  IconSpeaker,
  SpeakingWave,
  Tap,
  Text,
} from "@/components/lexi-components";
import { LANG_NAMES } from "@/constants/library";
import { useWordLookupStream } from "@/hooks/use-lexi-ai";
import { speak, type TranslateResult } from "@/services/lexi-ai";
import { useAppStore, useToastStore, type Lang } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "EN" },
  { key: "ar", label: "ع" },
  { key: "am", label: "አማ" },
];

const EXAMPLE_LABEL: Record<Lang, string> = {
  am: "ምሳሌ",
  ar: "مثال",
  en: "EXAMPLE",
};

const ENDONYM: Record<Lang, string> = {
  am: "አማርኛ",
  ar: "العربية",
  en: "English",
};

export interface TranslateTarget {
  text: string;
  page: number;
  context?: string;
  docKey: string;
  uri?: string;
  source?: string;
}

export function TranslateCard({
  onClose,
  onHighlight,
  target,
}: {
  onClose: () => void;
  onHighlight?: (result: TranslateResult) => void;
  target: TranslateTarget;
}) {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const addVocab = useAppStore((s) => s.addVocab);
  const lang = useAppStore((s) => s.lang);
  const setApp = useAppStore((s) => s.set);

  const rtl = lang === "ar";
  const rowDir: ViewStyle = { flexDirection: rtl ? "row-reverse" : "row" };
  const rtlText: TextStyle | undefined = rtl
    ? { textAlign: "right", writingDirection: "rtl" }
    : undefined;

  const [heard, setHeard] = useState<{ seq: number; url?: string } | null>(
    null
  );
  const seqRef = useRef(0);
  const audioNode = useMemo(() => {
    if (!heard?.url) return null;
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><audio id="a" autoplay playsinline src="${heard.url}"></audio><script>var a=document.getElementById('a');var done=function(){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage('ended')};a.addEventListener('ended',done);a.addEventListener('error',done);</script></body></html>`;
    return (
      <WebView
        allowsInlineMediaPlayback
        key={heard.seq}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        onMessage={() => setHeard(null)}
        pointerEvents="none"
        source={{ html }}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
      />
    );
  }, [heard]);

  const {
    data: result,
    isError,
    partial,
    quotaBlocked,
    streaming,
  } = useWordLookupStream(target);

  const blank = (value?: string) =>
    !value || value === "(none)" ? undefined : value;
  const shown = result
    ? result
    : partial.word
    ? {
        example: blank(partial.example),
        langName: LANG_NAMES[lang] ?? lang,
        pos: blank(partial.pos),
        s1: blank(partial.s1),
        s2: blank(partial.s2),
        tr: blank(partial.tr),
        translit: blank(partial.translit),
        word: partial.word,
      }
    : null;

  const startVoice = useCallback(
    async (seq: number, r: TranslateResult) => {
      let url = r.audioUrl;
      if (!url) {
        try {
          url = await speak(r.tr ?? r.word, r.lang);
        } catch {
          if (seqRef.current !== seq) return;
          setHeard(null);
          showToast("Couldn't play that just now");
          return;
        }
      }
      if (seqRef.current !== seq) return;
      if (!url) {
        setHeard(null);
        showToast("No audio for this language yet");
        return;
      }
      setHeard({ seq, url });
      showToast(`🔊 ${r.tr ?? r.word}`);
    },
    [showToast]
  );

  const pendingRef = useRef<number | null>(null);

  const hearIt = () => {
    if (heard) {
      pendingRef.current = null;
      setHeard(null);
      return;
    }
    const seq = ++seqRef.current;
    setHeard({ seq });
    if (result) void startVoice(seq, result);
    else pendingRef.current = seq;
  };

  useEffect(() => {
    const seq = pendingRef.current;
    if (seq === null) return;
    if (result) {
      pendingRef.current = null;
      if (seqRef.current === seq) void startVoice(seq, result);
    } else if (isError) {
      pendingRef.current = null;
      if (seqRef.current === seq) setHeard(null);
    }
  }, [isError, result, startVoice]);

  useEffect(() => {
    if (quotaBlocked) onClose();
  }, [onClose, quotaBlocked]);

  const saveWord = (r: TranslateResult) => {
    addVocab({
      example: r.example,
      lang: r.lang,
      p: target.page,
      pos: r.pos,
      s1: r.s1,
      s2: r.s2,
      source: target.source,
      tr: r.tr ?? "",
      translit: r.translit ?? "—",
      uri: target.uri,
      word: r.word,
    });
  };

  const [pendingAction, setPendingAction] = useState<
    "highlight" | "save" | null
  >(null);

  const waitingOn = (action: "highlight" | "save") =>
    pendingAction === action && !result && !isError;

  useEffect(() => {
    if (!pendingAction || !result) return;
    saveWord(result);
    if (pendingAction === "highlight") onHighlight?.(result);
    onClose();
    showToast(
      pendingAction === "highlight"
        ? "Highlighted + saved to vocabulary"
        : `"${result.word}" saved to vocabulary`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, pendingAction, result]);

  return (
    <>
      {audioNode}
      <Backdrop onPress={onClose} opacity={0.22} />
      <Box
        align="stretch"
        justify="start"
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          paddingHorizontal: 22,
          paddingTop: insets.top + 64,
          paddingBottom: insets.bottom + 28,
        }}
      >
        <Box
          style={{
            maxHeight: "100%",
            shadowColor: "#14100C",
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.35,
            shadowRadius: 60,
            elevation: 24,
          }}
        >
          <Box
            bg={t.card}
            borderColor={t.line}
            borderWidth={1}
            rounded={20}
            style={{ maxHeight: "100%", overflow: "hidden" }}
          >
            <Box
              align="center"
              direction="row"
              gap={6}
              paddingBottom={14}
              paddingTop={20}
              paddingX={20}
            >
              <Text color={t.faint} ls={0.4} size={10} upper weight="700">
                Explain in
              </Text>
              <Box flex={1} />
              {LANGS.map((l) => (
                <Tap
                  key={l.key}
                  onPress={() => setApp({ lang: l.key })}
                  scale={0.9}
                >
                  <Box
                    bg={lang === l.key ? t.accent : t.chip}
                    paddingX={11}
                    paddingY={5}
                    rounded={9}
                  >
                    <Text
                      color={lang === l.key ? t.onAccent : t.sub}
                      size={12}
                      weight="600"
                    >
                      {l.label}
                    </Text>
                  </Box>
                </Tap>
              ))}
            </Box>

            <ScrollView
              contentContainerStyle={{
                paddingBottom: 20,
                paddingHorizontal: 20,
              }}
              showsVerticalScrollIndicator={false}
            >
              {shown ? (
                <>
                  <Box
                    direction="row"
                    justify="between"
                    marginBottom={4}
                    style={{ alignItems: "baseline", ...rowDir }}
                  >
                    <Box flex={1}>
                      <Text
                        numberOfLines={1}
                        serif
                        size={20}
                        style={rtlText}
                        weight="600"
                      >
                        {shown.word}
                      </Text>
                    </Box>
                    {shown.pos ? (
                      <Box bg={t.chip} paddingX={9} paddingY={3} rounded={14}>
                        <Text color={t.sub} size={11} weight="500">
                          {shown.pos}
                        </Text>
                      </Box>
                    ) : null}
                  </Box>

                  {shown.tr ? (
                    <Box
                      align="center"
                      direction="row"
                      gap={8}
                      marginBottom={14}
                      style={rowDir}
                      wrap="wrap"
                    >
                      <Text
                        color={t.accentText}
                        size={22}
                        style={rtlText}
                        weight="600"
                      >
                        {shown.tr}
                      </Text>
                      <Text color={t.sub} size={12}>
                        {shown.translit ? `· ${shown.translit} ` : ""}·{" "}
                        {ENDONYM[lang] ?? shown.langName}
                      </Text>
                    </Box>
                  ) : (
                    <Box marginBottom={10} />
                  )}

                  <Box bg={t.line} height={1} marginBottom={14} />

                  {shown.s1 ? (
                    <Bullet color={t.accent} rtl={rtl}>
                      {shown.s1}
                    </Bullet>
                  ) : null}
                  {shown.s2 ? (
                    <Bullet color={t.accentMid} rtl={rtl}>
                      {shown.s2}
                    </Bullet>
                  ) : null}

                  {streaming && !shown.s2 ? (
                    <Box gap={10} marginBottom={12}>
                      <Box bg={t.chip} height={12} rounded={4} />
                      <Box
                        bg={t.chip}
                        height={12}
                        rounded={4}
                        style={{ width: "80%" }}
                      />
                    </Box>
                  ) : null}

                  {shown.example ? (
                    <Box
                      bg={t.chip}
                      marginBottom={14}
                      paddingX={12}
                      paddingY={10}
                      rounded={10}
                    >
                      <Text
                        color={t.faint}
                        size={10}
                        style={{
                          marginBottom: 4,
                          letterSpacing: lang === "en" ? 0.6 : 0,
                          ...rtlText,
                        }}
                        weight="700"
                      >
                        {EXAMPLE_LABEL[lang] ?? EXAMPLE_LABEL.en}
                      </Text>
                      <Text
                        color={t.sub}
                        lh={19}
                        serif
                        size={13}
                        style={rtlText}
                      >
                        {shown.example}
                      </Text>
                    </Box>
                  ) : null}

                  <Box direction="row" gap={8} wrap="wrap">
                    <HearItAction heard={heard} onPress={hearIt} />
                    <Action
                      busy={waitingOn("save")}
                      label="Save word"
                      onPress={() => setPendingAction("save")}
                    />
                    <Action
                      accent
                      busy={waitingOn("highlight")}
                      label="Highlight"
                      onPress={() => setPendingAction("highlight")}
                    />
                  </Box>

                  {result?.offline ? (
                    <Text color={t.faint} size={11} style={{ marginTop: 12 }}>
                      Offline definition — Liqrai wasn&apos;t reachable.
                    </Text>
                  ) : null}
                </>
              ) : isError ? (
                <Box gap={6}>
                  <Box align="center" direction="row" justify="between">
                    <Text size={15} weight="600">
                      Couldn&apos;t look that up
                    </Text>
                    <Tap onPress={onClose} scale={0.9}>
                      <IconClose color={t.sub} size={16} />
                    </Tap>
                  </Box>
                  <Text color={t.sub} lh={19} size={13}>
                    &ldquo;{target.text}&rdquo; isn&apos;t in the offline
                    dictionary, and Liqrai couldn&apos;t be reached. Try again
                    when you&apos;re online.
                  </Text>
                </Box>
              ) : (
                <Box gap={12}>
                  <Box
                    bg={t.chip}
                    height={16}
                    rounded={5}
                    style={{ width: "45%" }}
                  />
                  <Box
                    bg={t.chip}
                    height={22}
                    rounded={6}
                    style={{ width: "62%" }}
                  />
                  <Box bg={t.line} height={1} />
                  <Box bg={t.chip} height={12} rounded={4} />
                  <Box
                    bg={t.chip}
                    height={12}
                    rounded={4}
                    style={{ width: "80%" }}
                  />
                  <Text color={t.faint} size={12}>
                    Looking up &ldquo;{target.text}&rdquo;…
                  </Text>
                </Box>
              )}
            </ScrollView>
          </Box>
        </Box>
      </Box>
    </>
  );
}

function Bullet({
  children,
  color,
  rtl,
}: {
  children: string;
  color: string;
  rtl?: boolean;
}) {
  return (
    <Box
      direction="row"
      gap={9}
      marginBottom={12}
      style={{ flexDirection: rtl ? "row-reverse" : "row" }}
    >
      <Box paddingTop={2}>
        <IconSpark color={color} size={14} />
      </Box>
      <Box flex={1}>
        <Text
          lh={21}
          size={13.5}
          style={
            rtl ? { textAlign: "right", writingDirection: "rtl" } : undefined
          }
        >
          {children}
        </Text>
      </Box>
    </Box>
  );
}

function Action({
  accent,
  busy,
  label,
  onPress,
}: {
  accent?: boolean;
  busy?: boolean;
  label: string;
  onPress: () => void;
}) {
  const t = useProtoTheme();
  return (
    <Tap onPress={onPress} scale={0.95}>
      <Box
        align="center"
        bg={accent ? t.accentSoft : t.chip}
        direction="row"
        gap={6}
        paddingX={14}
        paddingY={9}
        rounded={11}
      >
        {busy ? (
          <ActivityIndicator
            color={accent ? t.accentText : t.ink}
            size="small"
          />
        ) : null}
        <Text color={accent ? t.accentText : t.ink} size={12} weight="600">
          {label}
        </Text>
      </Box>
    </Tap>
  );
}

function HearItAction({
  heard,
  onPress,
}: {
  heard: { seq: number; url?: string } | null;
  onPress: () => void;
}) {
  const t = useProtoTheme();
  const active = heard !== null;
  const loading = active && !heard.url;
  return (
    <Tap onPress={onPress} scale={0.95}>
      <Box
        align="center"
        bg={active ? t.accentSoft : t.chip}
        direction="row"
        gap={6}
        paddingX={14}
        paddingY={9}
        rounded={11}
      >
        {heard?.url ? (
          <SpeakingWave color={t.accentText} />
        ) : loading ? (
          <ActivityIndicator color={t.accentText} size="small" />
        ) : (
          <IconSpeaker color={t.ink} size={14} />
        )}
        <Text color={active ? t.accentText : t.ink} size={12} weight="600">
          {heard?.url ? "Stop" : "Hear it"}
        </Text>
      </Box>
    </Tap>
  );
}
