/**
 * The word card: what a selected word means *in this passage*, in the reader's
 * language, with the two explanation lines and Hear it / Save word / Highlight.
 *
 * A centred card rather than a sheet — it's an aside about one word, and the
 * sentence it came from should stay visible above and below it.
 */
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

/** The tiny in-card language switch. Short labels so three fit on one row. */
const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "EN" },
  { key: "ar", label: "ع" },
  { key: "am", label: "አማ" },
];

/**
 * The card's own chrome, written in the language the card is written in. An
 * Arabic card headed by the English word "EXAMPLE" is the same mixing the
 * content rules exist to prevent — the reader asked to be spoken to in one
 * language, and that has to include the labels.
 */
const EXAMPLE_LABEL: Record<Lang, string> = {
  am: "ምሳሌ",
  ar: "مثال",
  en: "EXAMPLE",
};

/**
 * Language names as their own speakers write them. The server sends `langName`
 * as an English exonym ("Arabic"), which is the wrong word to end an Arabic
 * card with.
 */
const ENDONYM: Record<Lang, string> = {
  am: "አማርኛ",
  ar: "العربية",
  en: "English",
};

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
  const insets = useSafeAreaInsets();
  const showToast = useToastStore((s) => s.showToast);
  const addVocab = useAppStore((s) => s.addVocab);
  // The word lookup reads its target language from the app store, so switching
  // it here re-runs the lookup in the chosen language automatically.
  const lang = useAppStore((s) => s.lang);
  const setApp = useAppStore((s) => s.set);

  // Arabic reads right to left, so the card's *content* is laid out that way:
  // the word and its part of speech, the translation line, the two
  // explanation bullets and the example. The chrome around them — the
  // language switch and the action chips — deliberately stays where it is,
  // since those are controls whose position the reader learns rather than
  // prose that has to read in order.
  const rtl = lang === "ar";
  /** Content rows, mirrored so they start from the right edge. */
  const rowDir: ViewStyle = { flexDirection: rtl ? "row-reverse" : "row" };
  /**
   * `writingDirection` is what actually orders a mixed Arabic/Latin line —
   * an Arabic sentence quoting an English word. `textAlign` alone would push
   * a line to the right that is still assembled left to right.
   */
  const rtlText: TextStyle | undefined = rtl
    ? { textAlign: "right", writingDirection: "rtl" }
    : undefined;

  // "Hear it" plays the model's audio through a tiny off-screen WebView rather
  // than a native audio module — react-native-webview is already a dependency,
  // so this needs no extra native build. `mediaPlaybackRequiresUserAction`
  // false lets the clip autoplay; `seq` bumps to replay the same word (a new
  // key remounts the player and starts it again).
  //
  // `url` is absent while the clip is still being fetched and present once it
  // is playing — a second tap on "Hear it" always stops, whichever phase it's
  // in, by dropping `heard` back to null. `seqRef` outlives `heard` so a stop
  // (or a newer tap) can outrun a fetch that was already in flight.
  const [heard, setHeard] = useState<{ seq: number; url?: string } | null>(
    null
  );
  const seqRef = useRef(0);
  const audioNode = useMemo(() => {
    if (!heard?.url) return null;
    // Reports back when the clip runs out, which is what flips the button
    // back to "Hear it" without the reader having to tap stop themselves.
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

  // Streamed field by field, and cached per word+page+language — so a word
  // you've already looked up lands instantly and costs nothing.
  const {
    data: result,
    isError,
    partial,
    quotaBlocked,
    streaming,
  } = useWordLookupStream(target);

  // What the card renders: the finished result once it lands, and until then
  // whichever fields have streamed in. Null before the first one arrives, which
  // is what still shows the skeleton. "(none)" is the model's way of saying a
  // field doesn't apply — it must never reach the screen.
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

  /** Find this card's audio and play it, or say why there isn't any. */
  const startVoice = useCallback(
    async (seq: number, r: TranslateResult) => {
      let url = r.audioUrl;
      if (!url) {
        try {
          url = await speak(r.tr ?? r.word, r.lang);
        } catch {
          // The request failed — a blip or a sick server, not a language
          // without a voice. Saying the latter would send the reader off
          // hunting a problem that isn't theirs.
          if (seqRef.current !== seq) return;
          setHeard(null);
          showToast("Couldn't play that just now");
          return;
        }
      }
      // A stop, or a tap that started a newer fetch, happened while this one
      // was in flight — that newer intent wins.
      if (seqRef.current !== seq) return;
      // The server answered and genuinely has no voice for this language
      // (e.g. Amharic) — say so rather than failing silently on a button
      // that looks live.
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

  // A tap that landed before the lookup finished. The spinner stays up and the
  // effect below starts playback once the card lands, rather than firing at a
  // half-written result whose `audioUrl` simply hasn't arrived yet.
  const pendingRef = useRef<number | null>(null);

  /** Play the card aloud, or stop it — fetching or playing — on a second tap. */
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
      // The lookup itself died — drop the spinner instead of leaving it
      // turning against an answer that is never coming.
      pendingRef.current = null;
      if (seqRef.current === seq) setHeard(null);
    }
  }, [isError, result, startVoice]);

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

  /**
   * Save word / Highlight, held until the card is whole.
   *
   * Both write the finished card into the reader's vocabulary, so neither can
   * act on a half-streamed one. Rather than greying the chips out — which
   * reads as broken for the second or two the lookup takes — the tap is
   * recorded here and the effect below runs it the moment the result lands.
   * Tapping one of these always does the thing you asked for; the only
   * variable is whether it happens now or in a moment.
   */
  const [pendingAction, setPendingAction] = useState<
    "highlight" | "save" | null
  >(null);

  // Spinning only while there is still something to wait for. Derived rather
  // than cleared from the effect below, so a lookup that dies takes the
  // spinner with it instead of leaving it turning on a card that failed.
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
    // `saveWord` and the callbacks are redefined every render; re-running is
    // harmless because the card unmounts on `onClose` and the guards above
    // hold until there is something to commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, pendingAction, result]);

  return (
    <>
      {audioNode}
      <Backdrop onPress={onClose} opacity={0.22} />
      {/* Full-screen wrapper, but the card is pinned to the top of it and only
          ever grows downward into the space below — the top edge holding still
          is what stops the whole card sliding around under the reader's eyes
          as fields stream in. `stretch` fixes its width to this padded column
          so it never resizes sideways either; the only thing that changes as
          content arrives is the bottom edge, until `maxHeight` stops that too
          and the content scrolls instead.
          `box-none` keeps it from eating the backdrop's own tap-to-close. */}
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
        {/* Shadow lives on the outer box; the inner one clips to the rounded
            corners so a scrolled example sentence doesn't spill past them. */}
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
            {/* Tiny language switch — kept above the scrollable content so
                it's usable while the lookup loads and re-runs in whichever
                language is tapped. */}
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

                  {/* Translation line — omitted when the selection is already in the
                target language, so the card is just the explanation. */}
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

                  {/* Placeholders for the lines still on the wire, so the card grows
                into its final height instead of jumping as each one lands. */}
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
                        // Tracked-out capitals are Latin typography; Arabic
                        // and Ethiopic have no case and letter-spacing breaks
                        // Arabic's joins, so it stays off for them.
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

                  {/* All three are live from the first frame — no popping in
                      and no greying out. A tap that arrives before the lookup
                      finishes spins in place and completes on its own. */}
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
  /** Right-to-left script: the spark moves to the right of its line. */
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
  /** Tapped, but waiting on the lookup to finish before it can act. */
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

/**
 * "Hear it", but stoppable — a second tap always stops, whether the clip is
 * still being fetched or already playing. Fetching shows a spinner in place
 * of the speaker glyph rather than the button waiting to appear at all, and
 * playing swaps in the same waving-bars indicator `lexi.tsx` uses for a
 * reply that's speaking.
 */
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
