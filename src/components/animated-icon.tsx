import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
// Matches the original keyframe: hold at opacity 1 for the first 20% of DURATION,
// fade to 0 by 70%. The overlay unmounts as soon as the fade completes.
const FADE_DELAY = DURATION * 0.2;
const FADE_DURATION = DURATION * 0.5;

// Survives Fast Refresh remounts of the root layout, so the intro doesn't replay
// over an already-visible home screen. A full app reload resets the module (and this flag).
let hasPlayedSplashIntro = false;

export function AnimatedSplashOverlay() {
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
        FADE_DELAY,
        withTiming(0, { duration: FADE_DURATION, easing: Easing.out(Easing.quad) }, (finished) => {
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
    <Animated.View onLayout={startFadeOut} style={[styles.splashOverlay, fadeStyle]}>
      <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
    </Animated.View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
