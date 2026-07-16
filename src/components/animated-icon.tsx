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

// The native splash (app.json) renders the static glyph at imageWidth 180dp
// with the glyph filling 72% of that image. Matching the drawing area here
// keeps the glyph the same on-screen size across the handoff:
// 180 * 0.72 = 129.6dp glyph height = (32/44) * DRAW_SIZE.
const DRAW_SIZE = 178;
// The glyph is optically left of its drawing box center (bbox center x is
// 23.5 of 44 units); the native splash centers the glyph itself, so shift to match.
const CENTER_OFFSET_X = -1.5 * (DRAW_SIZE / 44);

const SPEED = 6;
const INTRO_MS = SPEED * 0.35 * 1000;
// Let the dot start its first circle -> document morph before fading out.
const HOLD_MS = 900;
const FADE_MS = 450;

// Cross-fade the native splash into the overlay instead of an instant swap
// (iOS only; Android swaps instantly regardless).
SplashScreen.setOptions({ fade: true, duration: 350 });

// Survives Fast Refresh remounts of the root layout, so the intro doesn't replay
// over an already-visible home screen. A full app reload resets the module (and this flag).
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

  // The overlay stays mounted for the whole intro and only its opacity is driven,
  // avoiding the first-frame flicker of mount-time `entering` animations.
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
