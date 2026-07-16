import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { LexiLogo } from '@/components/lexi-logo';

const DRAW_SIZE = 178;
const CENTER_OFFSET_X = -1.5 * (DRAW_SIZE / 44);

const SPEED = 6;
const INTRO_MS = SPEED * 0.35 * 1000;
const HOLD_MS = 900;
const FADE_MS = 450;

SplashScreen.setOptions({ fade: true, duration: 350 });

let hasPlayedSplashIntro = false;

export function AnimatedSplashOverlay() {
  const colorScheme = useColorScheme();
  const [visible, setVisible] = useState(!hasPlayedSplashIntro);
  const started = useRef(false);
  const opacity = useSharedValue(1);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  useEffect(() => {
    if (!visible) {
      hasPlayedSplashIntro = true;
    }
  }, [visible]);

  if (!visible) return null;

  const startFadeOut = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync().finally(() => {
      opacity.value = withDelay(
        INTRO_MS + HOLD_MS,
        withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (finished) => {
          'worklet';
          if (finished) {
            scheduleOnRN(setVisible, false);
          }
        }),
      );
    });
  };

  return (
    <Animated.View
      onLayout={startFadeOut}
      style={[
        styles.splashOverlay,
        { backgroundColor: colorScheme === 'dark' ? '#000000' : '#FFFFFF' },
        fadeStyle,
      ]}
    >
      <LexiLogo
        size={DRAW_SIZE}
        speed={SPEED}
        variant={colorScheme === 'dark' ? 'onDark' : 'onLight'}
        style={{ transform: [{ translateX: CENTER_OFFSET_X }] }}
      />
    </Animated.View>
  );
}

export function AnimatedIcon() {
  return <LexiLogo size={128} speed={SPEED} variant="tile" />;
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
