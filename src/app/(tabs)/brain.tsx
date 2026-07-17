import type { ReactNode } from 'react';

import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';

import { Box } from '@/components/atoms';
import { BrainCanvas } from '@/components/brain/BrainCanvas';
import { IconBack, IconCheck, IconExternal, IconStar, PText, Tap } from '@/components/proto';
import { useAppStore, useToastStore } from '@/stores/app-store';

const INK = '#EDF0FA';
const SUB = 'rgba(226,232,255,.45)';
const BODY = 'rgba(226,232,255,.72)';
const CARD_BG = 'rgba(255,255,255,.045)';
const CARD_BD = 'rgba(255,255,255,.08)';
const INDIGO = '#8B93FF';
const INDIGO_SOFT = '#AEB4FF';

const MILESTONES = [10, 25, 50, 75, 100];
const MILESTONE_NAMES = ['Spark', 'Foundation', 'Momentum', 'Scholar', 'Charged'];
const LEVEL_NAMES = ['Dormant', 'Spark', 'Foundation', 'Momentum', 'Scholar', 'Charged'];

const BRAIN_TARGET = 50;

export default function BrainScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const books = useAppStore((s) => s.books);
  const showToast = useToastStore((s) => s.showToast);
  const [pct, setPct] = useState(0);

  const headerBottom = insets.top + 48;

  const doneBooks = Math.min(books, BRAIN_TARGET);
  const lvl = pct >= 100 ? 5 : pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : pct >= 10 ? 1 : 0;
  const msg =
    pct >= 100
      ? 'Incredible. Your brain is fully charged. Time to begin the next journey.'
      : pct >= 90
        ? "You're close to mastering this level."
        : pct >= 75
          ? 'Your knowledge is becoming impressive.'
          : pct >= 50
            ? "You're ahead of most readers. Stay consistent."
            : pct >= 25
              ? "You're building a strong foundation of knowledge."
              : pct >= 10
                ? 'Your mind is beginning to expand. Keep going.'
                : 'Every expert starts with a single book.';

  let frac = 0;
  if (pct >= 100) frac = 1;
  else if (pct >= 10) {
    let i = 0;
    while (i < 4 && pct >= MILESTONES[i + 1]) i++;
    frac = (i + (pct - MILESTONES[i]) / (MILESTONES[i + 1] - MILESTONES[i] || 1)) / 4;
  }

  const nextMilestone = MILESTONES.find((m) => pct < m);
  const nextLabel =
    nextMilestone === undefined
      ? 'Level complete — a new journey awaits.'
      : (() => {
          const need = Math.max(1, Math.ceil((nextMilestone / 100) * BRAIN_TARGET) - doneBooks);
          return `${need} ${need === 1 ? 'book' : 'books'} to unlock ${MILESTONE_NAMES[MILESTONES.indexOf(nextMilestone)]}`;
        })();

  const stats = [
    { v: `${doneBooks}`, l: 'Books done' },
    { v: `${pct}%`, l: 'Brain fill' },
    { v: '12 d', l: 'Streak' },
    { v: `${Math.round(doneBooks * 7.5)} h`, l: 'Read time' },
    { v: (doneBooks * 214).toLocaleString(), l: 'Pages read' },
    { v: LEVEL_NAMES[lvl], l: 'Level' },
  ];

  return (
    <Box bg="#07080D" flex={1} style={{ paddingTop: insets.top }}>
      <Svg
        height="100%"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        width="100%"
      >
        <Defs>
          <RadialGradient cx="50%" cy="24%" id="brainBg" rx="85%" ry="46%">
            <Stop offset="0" stopColor="#161C40" />
            <Stop offset="0.62" stopColor="#07080D" />
            <Stop offset="1" stopColor="#07080D" />
          </RadialGradient>
        </Defs>
        <Rect fill="url(#brainBg)" height="100%" width="100%" />
      </Svg>

      <Box align="center" direction="row" justify="between" paddingLeft={20} paddingRight={20} paddingTop={8}>
        <Tap onPress={() => router.back()} scale={0.94}>
          <Box
            align="center"
            bg="rgba(255,255,255,.06)"
            borderColor="rgba(255,255,255,.1)"
            borderWidth={1}
            height={40}
            justify="center"
            rounded={12}
            width={40}
          >
            <IconBack color={INK} size={18} />
          </Box>
        </Tap>
        <PText color={INK} ls={-0.2} size={17} weight="600">
          Brain Progress
        </PText>
        <Box
          bg="rgba(139,147,255,.12)"
          borderColor="rgba(139,147,255,.32)"
          borderWidth={1}
          paddingX={10}
          paddingY={6}
          rounded={999}
        >
          <PText color={INDIGO_SOFT} size={10.5} weight="600">
            Lv {lvl + 1} · {LEVEL_NAMES[lvl]}
          </PText>
        </Box>
      </Box>

      <ScrollView
        bounces={false}
        contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}
        overScrollMode="never"
        stickyHeaderIndices={[0]}
        style={{ flex: 1 }}
      >
        <Box height={308} style={{ overflow: 'hidden' }}>
          <Svg
            height={screenH}
            pointerEvents="none"
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: -headerBottom, left: 0, right: 0 }}
            width="100%"
          >
            <Defs>
              <RadialGradient cx="50%" cy="24%" id="brainBgSticky" rx="85%" ry="46%">
                <Stop offset="0" stopColor="#161C40" />
                <Stop offset="0.62" stopColor="#07080D" />
                <Stop offset="1" stopColor="#07080D" />
              </RadialGradient>
              <LinearGradient id="stickyFadeGrad" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.86} />
                <Stop offset={`${((headerBottom + 218) / screenH).toFixed(4)}`} stopColor="#FFFFFF" stopOpacity={0.86} />
                <Stop offset={`${((headerBottom + 308) / screenH).toFixed(4)}`} stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <Mask height="100%" id="stickyFade" width="100%" x="0" y="0">
                <Rect fill="url(#stickyFadeGrad)" height="100%" width="100%" />
              </Mask>
            </Defs>
            <Rect fill="url(#brainBgSticky)" height="100%" mask="url(#stickyFade)" width="100%" />
          </Svg>
          <Box
            align="center"
            justify="center"
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          >
            <Svg height={290} width={290}>
              <Defs>
                <RadialGradient cx="50%" cy="50%" id="brainGlow" r="50%">
                  <Stop offset="0" stopColor="#4C3FD4" stopOpacity={0.32} />
                  <Stop offset="0.45" stopColor="#588CFF" stopOpacity={0.1} />
                  <Stop offset="0.7" stopColor="#588CFF" stopOpacity={0} />
                  <Stop offset="1" stopColor="#588CFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={145} cy={145} fill="url(#brainGlow)" r={145} />
            </Svg>
          </Box>
          <BrainCanvas
            booksDone={doneBooks}
            onMilestone={showToast}
            onPct={setPct}
            target={BRAIN_TARGET}
          />
          <Box pointerEvents="none" style={{ position: 'absolute', right: 16, bottom: 8 }}>
            <PText color="rgba(226,232,255,.35)" ls={0.76} size={9.5} weight="500">
              DRAG TO ROTATE
            </PText>
          </Box>
        </Box>

        <Box align="center" paddingTop={4} paddingX={28}>
          <PText color={SUB} ls={1.9} size={10.5} weight="600">
            BRAIN CAPACITY
          </PText>
          <Svg height={60} width={240}>
            <Defs>
              <LinearGradient id="brainNum" x1="0" x2="0.866" y1="0" y2="0.5">
                <Stop offset="0" stopColor="#AEB4FF" />
                <Stop offset="1" stopColor="#58C8FF" />
              </LinearGradient>
            </Defs>
            <SvgText
              fill="url(#brainNum)"
              fontSize={54}
              fontWeight="300"
              letterSpacing="-1.5"
              textAnchor="middle"
              x="120"
              y="48"
            >
              {pct}
              <TSpan fontSize={28} fontWeight="400" letterSpacing="0">
                %
              </TSpan>
            </SvgText>
          </Svg>
          <PText color="rgba(226,232,255,.4)" ls={1.7} size={11} weight="500">
            FILLED
          </PText>
          <Box marginTop={11} maxWidth={280}>
            <PText align="center" color="rgba(226,232,255,.7)" lh={20} size={13}>
              {msg}
            </PText>
          </Box>
        </Box>

        <Box direction="row" marginTop={20} marginX={20} style={{ flexWrap: 'wrap', gap: 9 }}>
          {stats.map((st) => (
            <Box
              align="center"
              bg={CARD_BG}
              borderColor={CARD_BD}
              borderWidth={1}
              key={st.l}
              paddingBottom={10}
              paddingTop={12}
              paddingX={6}
              rounded={14}
              style={{ width: '31%', flexGrow: 1 }}
            >
              <PText color="#EEF1FF" ls={-0.2} numberOfLines={1} size={15} weight="600">
                {st.v}
              </PText>
              <PText color={SUB} ls={0.9} numberOfLines={1} size={9} style={{ marginTop: 4 }} upper weight="500">
                {st.l}
              </PText>
            </Box>
          ))}
        </Box>

        <Box marginTop={22} marginX={20}>
          <PText color={SUB} ls={1.7} size={10.5} style={{ paddingBottom: 13 }} weight="600">
            MILESTONES
          </PText>
          <Box>
            <Box
              bg="rgba(255,255,255,.09)"
              height={2}
              rounded={2}
              style={{ position: 'absolute', top: 16, left: '10%', right: '10%' }}
            />
            <Box
              height={2}
              style={{
                position: 'absolute',
                top: 16,
                left: '10%',
                width: `${Math.round(frac * 800) / 10}%`,
                shadowColor: '#588CFF',
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }}
            >
              <Svg height={2} preserveAspectRatio="none" viewBox="0 0 100 2" width="100%">
                <Defs>
                  <LinearGradient id="mlFill" x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0" stopColor="#4C3FD4" />
                    <Stop offset="1" stopColor="#58C8FF" />
                  </LinearGradient>
                </Defs>
                <Rect fill="url(#mlFill)" height={2} rx={1} width={100} />
              </Svg>
            </Box>
            <Box direction="row">
              {MILESTONES.map((m, i) => {
                const on = pct >= m;
                return (
                  <Box align="center" flex={1} gap={7} key={m}>
                    <Box
                      align="center"
                      bg={on ? undefined : 'rgba(255,255,255,.05)'}
                      borderColor={on ? 'rgba(139,147,255,.6)' : 'rgba(255,255,255,.12)'}
                      borderWidth={1}
                      height={33}
                      justify="center"
                      rounded={17}
                      style={
                        on
                          ? { shadowColor: '#588CFF', shadowOpacity: 0.45, shadowRadius: 16, elevation: 6 }
                          : undefined
                      }
                      width={33}
                    >
                      {on ? (
                        <Svg
                          height={31}
                          style={{ position: 'absolute', top: 0, left: 0 }}
                          width={31}
                        >
                          <Defs>
                            <LinearGradient id={`ml${m}`} x1="0" x2="1" y1="0" y2="1">
                              <Stop offset="0" stopColor="#4C3FD4" />
                              <Stop offset="1" stopColor="#3D7BFF" />
                            </LinearGradient>
                          </Defs>
                          <Circle cx={15.5} cy={15.5} fill={`url(#ml${m})`} r={15.5} />
                        </Svg>
                      ) : null}
                      {on ? (
                        <IconCheck color="#fff" size={13} strokeWidth={2.6} />
                      ) : (
                        <PText color="rgba(226,232,255,.55)" size={9.5} weight="600">
                          {m}%
                        </PText>
                      )}
                    </Box>
                    <PText color={on ? INDIGO_SOFT : 'rgba(226,232,255,.35)'} ls={0.4} size={9} weight="500">
                      {MILESTONE_NAMES[i]}
                    </PText>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        <Box
          align="center"
          bg={CARD_BG}
          borderColor={CARD_BD}
          borderWidth={1}
          direction="row"
          gap={9}
          justify="center"
          marginTop={22}
          marginX={20}
          paddingX={16}
          paddingY={13}
          rounded={14}
        >
          <IconStar color={INDIGO} size={15} />
          <PText color="rgba(226,232,255,.75)" size={12.5} weight="500">
            {nextLabel}
          </PText>
        </Box>

        <Box
          borderColor="rgba(139,147,255,.22)"
          borderWidth={1}
          marginTop={22}
          marginX={20}
          rounded={16}
          style={{ overflow: 'hidden' }}
        >
          <GradientRect
            from="#4C3FD4"
            fromOpacity={0.16}
            id="science"
            to="#58C8FF"
            toOpacity={0.05}
            x2="0.34"
            y2="1"
          />
          <Box paddingBottom={15} paddingTop={16} paddingX={16}>
            <PText color={INDIGO_SOFT} ls={1.7} size={10.5} weight="600">
              THE SCIENCE
            </PText>
            <PText color={BODY} lh={20} size={12.5} style={{ marginTop: 9 }}>
              Your brain fills automatically as you read — every book you finish in your library counts toward
              capacity. And it’s not just a metaphor: fMRI studies at Emory University found that reading a novel
              increases connectivity in the left temporal cortex — the brain’s language region — with the changes
              persisting for days after you finish.
            </PText>
            <Tap onPress={() => Linking.openURL('https://pubmed.ncbi.nlm.nih.gov/24382981/')}>
              <Box align="center" direction="row" gap={6} marginTop={11}>
                <PText color={INDIGO} size={12} weight="600">
                  Read the study
                </PText>
                <IconExternal color={INDIGO} size={12} />
              </Box>
            </Tap>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}

function GradientRect({
  from,
  fromOpacity = 1,
  id,
  to,
  toOpacity = 1,
  x2,
  y2,
  children,
}: {
  children?: ReactNode;
  from: string;
  fromOpacity?: number;
  id: string;
  to: string;
  toOpacity?: number;
  x2: string;
  y2: string;
}) {
  return (
    <>
      <Svg
        height="100%"
        preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        width="100%"
      >
        <Defs>
          <LinearGradient id={id} x1="0" x2={x2} y1="0" y2={y2}>
            <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
            <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" />
      </Svg>
      {children}
    </>
  );
}
