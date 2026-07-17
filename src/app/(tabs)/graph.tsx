import { router } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { Box } from '@/components/atoms';
import { Card, IconChevron, ProtoScreen, PText, ScreenHeader, Tap } from '@/components/proto';
import { useProtoTheme } from '@/theme/proto';

interface GraphNode {
  label: string;
  x: number; // percentage
  y: number; // percentage
  primary?: boolean;
  accent?: boolean;
}

const NODES: GraphNode[] = [
  { label: 'Electric Light', x: 50, y: 17, primary: true },
  { label: 'Gaslight Economy', x: 50, y: 42, primary: true },
  { label: 'Subscription utility', x: 20, y: 56 },
  { label: 'Labor displacement', x: 80, y: 56 },
  { label: 'Time reclaimed', x: 50, y: 67, accent: true },
  { label: 'Evening editions', x: 26, y: 83 },
];

export default function GraphScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const px = (nx: number) => (nx / 100) * size.w;
  const py = (ny: number) => (ny / 100) * size.h;

  return (
    <ProtoScreen>
      <ScreenHeader
        onBack={() => router.back()}
        subtitle="Built from your highlights in The Age of Light"
        title="Connections"
      />

      <Box
        bg={t.card}
        borderColor={t.line}
        borderWidth={1}
        flex={1}
        margin={20}
        marginBottom={18}
        marginTop={18}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        rounded={20}
        style={{ overflow: 'hidden' }}
      >
        {size.w > 0 ? (
          <Svg height={size.h} style={{ position: 'absolute' }} width={size.w}>
            <Line stroke={t.line} strokeWidth={1.5} x1={px(50)} x2={px(50)} y1={py(17)} y2={py(42)} />
            <Line stroke={t.accent} strokeWidth={2} x1={px(50)} x2={px(50)} y1={py(42)} y2={py(67)} />
            <Line stroke={t.line} strokeWidth={1.5} x1={px(50)} x2={px(20)} y1={py(42)} y2={py(56)} />
            <Line stroke={t.line} strokeWidth={1.5} x1={px(50)} x2={px(80)} y1={py(42)} y2={py(56)} />
            <Line stroke={t.line} strokeWidth={1.5} x1={px(50)} x2={px(26)} y1={py(67)} y2={py(83)} />
          </Svg>
        ) : null}

        {NODES.map((n) => (
          <Box
            bg={n.accent ? t.accent : t.bg}
            borderColor={n.accent ? undefined : t.line}
            borderWidth={n.accent ? 0 : 1}
            key={n.label}
            paddingX={n.accent ? 18 : n.primary ? 16 : 14}
            paddingY={n.accent ? 10 : n.primary ? 9 : 8}
            rounded={20}
            style={{
              position: 'absolute',
              left: `${n.x}%`,
              top: `${n.y}%`,
              transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
              ...(n.accent
                ? {
                    shadowColor: '#201B15',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.25,
                    shadowRadius: 24,
                    elevation: 8,
                  }
                : {}),
            }}
          >
            <PText
              color={n.accent ? t.onAccent : n.primary ? t.ink : t.sub}
              size={n.accent ? 13.5 : n.primary ? 13 : 12}
              weight={n.accent || n.primary ? '600' : '500'}
            >
              {n.label}
            </PText>
          </Box>
        ))}
      </Box>

      <Box marginX={20} style={{ marginBottom: 26 + insets.bottom }}>
        <Card gap={8}>
          <PText size={13.5} weight="600">
            Time reclaimed
          </PText>
          <PText color={t.sub} lh={18} size={12}>
            2 highlights · 1 note · 1 review card · linked to Gaslight Economy by your Ch. 2 highlight
          </PText>
          <Tap onPress={() => router.push('/notes')}>
            <Box align="center" direction="row" gap={6}>
              <PText color={t.accentText} size={12.5} weight="600">
                Open highlights
              </PText>
              <IconChevron color={t.accent} size={13} strokeWidth={2} />
            </Box>
          </Tap>
        </Card>
      </Box>
    </ProtoScreen>
  );
}
