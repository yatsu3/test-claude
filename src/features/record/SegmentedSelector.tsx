// src/features/record/SegmentedSelector.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';

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
    <View style={{ marginBottom: 16 }}>
      <Text style={{ marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: value === option.value ? '#333' : '#eee',
            }}
          >
            <Text style={{ color: value === option.value ? '#fff' : '#333' }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
