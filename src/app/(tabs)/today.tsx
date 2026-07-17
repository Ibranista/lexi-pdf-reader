import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Box } from '@/components/atoms';
import {
  Card,
  Cover,
  Divider,
  IconCheck,
  IconChevron,
  ProtoScreen,
  PText,
  ScreenHeader,
  Tap,
} from '@/components/proto';
import { BOOK_PAGES, BOOK_TITLE } from '@/constants/library';
import { useAppStore } from '@/stores/app-store';
import { useProtoTheme } from '@/theme/proto';

export default function TodayScreen() {
  const t = useProtoTheme();
  const insets = useSafeAreaInsets();
  const page = useAppStore((s) => s.page);

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ProtoScreen>
      <ScreenHeader onBack={() => router.back()} subtitle={dateLabel} title="Today" titleSize={24} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24 + insets.bottom, gap: 14, flexGrow: 1 }}
        style={{ flex: 1 }}
      >
        <Card padding={0} rounded={18} style={{ paddingHorizontal: 18, paddingVertical: 6 }}>
          <Box align="center" direction="row" gap={14} paddingY={14}>
            <Box align="center" bg={t.accent} height={26} justify="center" rounded={13} width={26}>
              <IconCheck color={t.onAccent} size={14} strokeWidth={2.4} />
            </Box>
            <Box flex={1}>
              <PText color={t.sub} size={15} style={{ textDecorationLine: 'line-through' }} weight="600">
                Read 10 pages
              </PText>
              <PText color={t.faint} size={12} style={{ marginTop: 2 }}>
                Done during your 18-min focus session
              </PText>
            </Box>
          </Box>
          <Divider />
          <Box align="center" direction="row" gap={14} paddingY={14}>
            <Box
              align="center"
              borderColor={t.line}
              borderWidth={2}
              height={26}
              justify="center"
              rounded={13}
              width={26}
            >
              <PText color={t.sub} size={10} weight="600">
                ⅔
              </PText>
            </Box>
            <Box flex={1}>
              <PText size={15} weight="600">
                Review 3 notes
              </PText>
              <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                2 of 3 · about 2 minutes left
              </PText>
            </Box>
            <Tap onPress={() => router.push('/review')}>
              <PText color={t.accentText} size={13} weight="600">
                Continue
              </PText>
            </Tap>
          </Box>
        </Card>

        <Box bg={t.accentSoft} paddingX={18} paddingY={16} rounded={16}>
          <PText lh={21} size={13.5}>
            That’s the whole plan. No streaks, no leaderboards — missing a day changes nothing.
          </PText>
        </Box>

        <Tap onPress={() => router.push({ pathname: '/reader', params: { resume: '1' } })} scale={0.985}>
          <Card rounded={18} style={{ paddingHorizontal: 18 }}>
            <Box align="center" direction="row" gap={14}>
              <Cover height={58} width={44} />
              <Box flex={1}>
                <PText color={t.accentText} ls={0.7} size={11} upper weight="600">
                  Pick up where you left off
                </PText>
                <PText serif size={15} style={{ marginTop: 4 }} weight="600">
                  {BOOK_TITLE}
                </PText>
                <PText color={t.sub} size={12} style={{ marginTop: 2 }}>
                  Page {page} of {BOOK_PAGES} · “Reread the Pearl Street section”
                </PText>
              </Box>
              <IconChevron color={t.faint} size={18} />
            </Box>
          </Card>
        </Tap>

        <Box flex={1} />

        <Tap onPress={() => router.push({ pathname: '/reader', params: { focus: '1' } })} scale={0.98}>
          <Box align="center" bg={t.accent} direction="row" gap={9} height={54} justify="center" rounded={16}>
            <Box bg={t.onAccent} height={7} rounded={4} width={7} />
            <PText color={t.onAccent} size={15} weight="600">
              Start a focus session
            </PText>
          </Box>
        </Tap>
      </ScrollView>
    </ProtoScreen>
  );
}
