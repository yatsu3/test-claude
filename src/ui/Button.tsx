// src/ui/Button.tsx
import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors, radius, spacing, TOUCH_MIN } from './theme';

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inactive = disabled || loading;
  const filled = variant === 'primary';
  const textColor = filled ? colors.onPrimary : variant === 'danger' ? colors.error : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => ({
        minHeight: TOUCH_MIN + 4,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: filled
          ? inactive
            ? colors.disabled
            : pressed
              ? colors.primaryPressed
              : colors.primary
          : pressed
            ? colors.surfaceMuted
            : colors.surface,
        borderWidth: filled ? 0 : 1,
        borderColor: variant === 'danger' ? colors.errorSoft : colors.border,
      })}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : null}
      <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}
