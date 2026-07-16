import { SymbolView } from 'expo-symbols';
import { type PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CollapsibleProps = PropsWithChildren<{
  title: string;
}>;

export function Collapsible({ children, title }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();
  const rotation = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    rotation.value = withTiming(next ? 90 : 0, { duration: 200 });
  };

  return (
    <ThemedView>
      <Pressable
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={styles.heading}>
        <Animated.View style={chevronStyle}>
          <SymbolView
            tintColor={theme.text}
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={18}
          />
        </Animated.View>
        <ThemedText type="smallBold">{title}</ThemedText>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.content}>
          {children}
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  content: {
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginLeft: Spacing.four,
  },
});
