// src/features/record/SegmentedSelector.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, font, radius, spacing, TOUCH_MIN } from '../../ui/theme';

type Option<T extends string> = { value: T; label: string };

export function SegmentedSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...font.label, marginBottom: spacing.sm }}>{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceMuted,
          borderRadius: radius.md,
          padding: 3,
          gap: 3,
        }}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label} ${option.label}`}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: TOUCH_MIN,
                borderRadius: radius.sm + 2,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: selected ? colors.primary : pressed ? colors.primarySoft : 'transparent',
              })}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: selected ? '700' : '500',
                  color: selected ? colors.onPrimary : colors.text,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
