import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/constants/colors';
import { sansFamily } from '@/theme/app-fonts';

// ============================================================================
// FeatureRow — icon slot + title + description (paywall / feature lists)
// ============================================================================

interface FeatureRowProps {
  title: string;
  description?: string;
  /** Leading icon slot (defaults to a small accent sparkle). */
  icon?: ReactNode;
}

export function FeatureRow({ title, description, icon }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>{icon ?? <Sparkle />}</View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {description != null && <Text style={styles.description}>{description}</Text>}
      </View>
    </View>
  );
}

// Small default accent sparkle, matching the design's feature bullets.
function Sparkle() {
  return (
    <Svg width={16} height={16} viewBox="0 0 20 20">
      <Path
        d="M10 2l1.8 6.2L18 10l-6.2 1.8L10 18l-1.8-6.2L2 10l6.2-1.8Z"
        fill={colors.light.accent}
      />
    </Svg>
  );
}

const c = colors.light;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
  },
  icon: { marginTop: 2 },
  text: { flex: 1 },
  title: {
    fontFamily: sansFamily['600'],
    fontSize: 14,
    color: c.text,
  },
  description: {
    fontFamily: sansFamily['400'],
    fontSize: 12.5,
    lineHeight: 18,
    color: c.textSecondary,
    marginTop: 1,
  },
});
