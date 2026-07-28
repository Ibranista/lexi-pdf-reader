/**
 * The word card: what a selected word means *in this passage*, in the reader's
 * language, with the two explanation lines and Hear it / Save word / Highlight.
 *
 * A centred card rather than a sheet — it's an aside about one word, and the
 * sentence it came from should stay visible above and below it.
 */
import { useEffect, useMemo, useState } from "react";
import { WebView } from "react-native-webview";

import { Box } from "@/components/atoms";
import {
  Backdrop,
  IconClose,
  IconSpark,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useWordLookup } from "@/hooks/use-lexi-ai";
import { speak, type TranslateResult } from "@/services/lexi-ai";
import { useAppStore, useToastStore, type Lang } from "@/stores/app-store";
import { useProtoTheme } from "@/theme/proto";

/** The tiny in-card language switch. Short labels so three fit on one row. */
const LANGS: { key: Lang; label: string }[] = [
  { key: "am", label: "አማ" },
  { key: "ar", label: "ع" },
  { key: "en", label: "EN" },
];

export interface TranslateTarget {
  /** The selected word or short phrase. */
  text: string;
  page: number;
  /** Sentence around the selection, so the answer can be about this passage. */
  context?: string;
  /**
   * Sync key of the document it was read in — 64 hex characters from
   * `docKeyFor`. Distinct from `uri`: this is what the *server* calls the
   * document, and it's stable across devices.
   */
  docKey: string;
  /**
   * Device path of the document, kept on the saved word so the vocabulary list
   * can reopen it. Not interchangeable with `docKey` — this one is local, and
   * changes between devices and reinstalls.
   */
  uri?: string;
  /** Document title, kept on the saved word so lists can name its source. */
  source?: string;
}

export function TranslateCard({
  onClose,
  onHighlight,
  target,
}: {
  onClose: () => void;
  /** Highlights the passage as well as saving the word. */
  onHighlight?: (result: TranslateResult) => void;
  target: TranslateTarget;
}) {
  const t = useProtoTheme();
  const showToast = useToastStore((s) => s.showToast);
  const addVocab = useAppStore((s) => s.addVocab);
  // The word lookup reads its target language from the app store, so switching
  // it here re-runs the lookup in the chosen language automatically.
  const lang = useAppStore((s) => s.lang);
  const setApp = useAppStore((s) => s.set);

  // "Hear it" plays the model's audio through a tiny off-screen WebView rather
  // than a native audio module — react-native-webview is already a dependency,
  // so this needs no extra native build. `mediaPlaybackRequiresUserAction`
  // false lets the clip autoplay; `seq` bumps to replay the same word (a new
  // key remounts the player and starts it again).
  const [heard, setHeard] = useState<{ url: string; seq: number } | null>(null);
  const audioNode = useMemo(() => {
    if (!heard) return null;
    const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0"><audio autoplay playsinline src="${heard.url}"></audio></body></html>`;
    return (
      <WebView
        allowsInlineMediaPlayback
        key={heard.seq}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        pointerEvents="none"
        source={{ html }}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
      />
    );
  }, [heard]);

  const hearIt = async (r: TranslateResult) => {
    const url = r.audioUrl ?? (await speak(r.tr ?? r.word, r.lang));
    // No voice for this language yet (e.g. Amharic) — say so rather than
    // failing silently on a button that looks live.
    if (!url) {
      showToast("No audio for this language yet");
      return;
    }
    setHeard((prev) => ({ url, seq: (prev?.seq ?? 0) + 1 }));
    showToast(`🔊 ${r.tr}`);
  };

  // Cached per word+page+language, so re-opening a word you've already looked
  // up costs nothing and lands instantly.
  const { data: result, isError, quotaBlocked } = useWordLookup(target);

  // Out of credits: the wall is already up behind this, and stacking the card
  // on top of it would bury the thing being asked for.
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

  return (
    <>
      {audioNode}
      <Backdrop onPress={onClose} opacity={0.22} />
      <Box
        bg={t.card}
        borderColor={t.line}
        borderWidth={1}
        padding={20}
        rounded={20}
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          top: "30%",
          zIndex: 41,
          shadowColor: "#14100C",
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.35,
          shadowRadius: 60,
          elevation: 24,
        }}
      >
        {/* Tiny language switch — kept above the content so it's usable while
            the lookup loads and re-runs in whichever language is tapped. */}
        <Box align="center" direction="row" gap={6} marginBottom={14}>
          <Text color={t.faint} ls={0.4} size={10} upper weight="700">
            Explain in
          </Text>
          <Box flex={1} />
          {LANGS.map((l) => (
            <Tap key={l.key} onPress={() => setApp({ lang: l.key })} scale={0.9}>
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

        {result ? (
          <>
            <Box
              direction="row"
              justify="between"
              marginBottom={4}
              style={{ alignItems: "baseline" }}
            >
              <Box flex={1}>
                <Text numberOfLines={1} serif size={20} weight="600">
                  {result.word}
                </Text>
              </Box>
              <Box bg={t.chip} paddingX={9} paddingY={3} rounded={14}>
                <Text color={t.sub} size={11} weight="500">
                  {result.pos}
                </Text>
              </Box>
            </Box>

            {/* Translation line — omitted when the selection is already in the
                target language, so the card is just the explanation. */}
            {result.tr ? (
              <Box
                align="center"
                direction="row"
                gap={8}
                marginBottom={14}
                wrap="wrap"
              >
                <Text color={t.accentText} size={22} weight="600">
                  {result.tr}
                </Text>
                <Text color={t.sub} size={12}>
                  {result.translit ? `· ${result.translit} ` : ""}·{" "}
                  {result.langName}
                </Text>
              </Box>
            ) : (
              <Box marginBottom={10} />
            )}

            <Box bg={t.line} height={1} marginBottom={14} />

            <Bullet color={t.accent}>{result.s1}</Bullet>
            <Bullet color={t.accentMid}>{result.s2}</Bullet>

            {result.example ? (
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
                  style={{ marginBottom: 4, letterSpacing: 0.6 }}
                  weight="700"
                >
                  EXAMPLE
                </Text>
                <Text color={t.sub} lh={19} serif size={13}>
                  {result.example}
                </Text>
              </Box>
            ) : null}

            <Box direction="row" gap={8} wrap="wrap">
              <Action label="Hear it" onPress={() => hearIt(result)} />
              <Action
                label="Save word"
                onPress={() => {
                  saveWord(result);
                  onClose();
                  showToast(`"${result.word}" saved to vocabulary`);
                }}
              />
              <Action
                accent
                label="Highlight"
                onPress={() => {
                  saveWord(result);
                  onHighlight?.(result);
                  onClose();
                  showToast("Highlighted + saved to vocabulary");
                }}
              />
            </Box>

            {result.offline ? (
              <Text color={t.faint} size={11} style={{ marginTop: 12 }}>
                Offline definition — Lexi wasn&apos;t reachable.
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
              &ldquo;{target.text}&rdquo; isn&apos;t in the offline dictionary, and
              Lexi couldn&apos;t be reached. Try again when you&apos;re online.
            </Text>
          </Box>
        ) : (
          <Box gap={12}>
            <Box bg={t.chip} height={16} rounded={5} style={{ width: "45%" }} />
            <Box bg={t.chip} height={22} rounded={6} style={{ width: "62%" }} />
            <Box bg={t.line} height={1} />
            <Box bg={t.chip} height={12} rounded={4} />
            <Box bg={t.chip} height={12} rounded={4} style={{ width: "80%" }} />
            <Text color={t.faint} size={12}>
              Looking up &ldquo;{target.text}&rdquo;…
            </Text>
          </Box>
        )}
      </Box>
    </>
  );
}

function Bullet({ children, color }: { children: string; color: string }) {
  return (
    <Box direction="row" gap={9} marginBottom={12}>
      <Box paddingTop={2}>
        <IconSpark color={color} size={14} />
      </Box>
      <Box flex={1}>
        <Text lh={21} size={13.5}>
          {children}
        </Text>
      </Box>
    </Box>
  );
}

function Action({
  accent,
  label,
  onPress,
}: {
  accent?: boolean;
  label: string;
  onPress: () => void;
}) {
  const t = useProtoTheme();
  return (
    <Tap onPress={onPress} scale={0.95}>
      <Box
        bg={accent ? t.accentSoft : t.chip}
        paddingX={14}
        paddingY={9}
        rounded={11}
      >
        <Text color={accent ? t.accentText : t.ink} size={12} weight="600">
          {label}
        </Text>
      </Box>
    </Tap>
  );
}
