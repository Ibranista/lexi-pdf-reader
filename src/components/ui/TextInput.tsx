import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/constants/colors';
import { fonts, radius } from './tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
}

export function TextInput({ label, error, helper, style, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const c = colors.light;

  return (
    <View style={styles.container}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          focused && { borderColor: c.accent },
          error != null && { borderColor: c.accent },
          style,
        ]}
        placeholderTextColor={c.placeholder}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        accessibilityLabel={label}
        {...props}
      />
      {error != null ? (
        <Text style={[styles.helper, styles.error]} accessibilityRole="alert">
          {error}
        </Text>
      ) : helper != null ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const c = colors.light;

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  label: {
    fontFamily: fonts.sans,
    fontWeight: '500',
    fontSize: 13,
    color: c.textSecondary,
    marginBottom: 6,
  },
  input: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    height: 50,
  },
  helper: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 6,
  },
  error: { color: c.accentText },
});
