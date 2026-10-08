// src/ui/StatusView.tsx
// Centered full-screen message for loading errors and empty states.
import React from 'react';
import { Text, View } from 'react-native';
import { Button } from './Button';
import { colors, font, spacing } from './theme';

export function StatusView({
  title,
  description,
  tone = 'neutral',
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  tone?: 'neutral' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      <Text
        accessibilityRole={tone === 'error' ? 'alert' : 'text'}
        style={{ ...font.heading, color: tone === 'error' ? colors.error : colors.text, textAlign: 'center' }}
      >
        {title}
      </Text>
      {description ? (
        <Text style={{ ...font.body, color: colors.textMuted, textAlign: 'center' }}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.md, alignSelf: 'stretch', maxWidth: 280, width: '100%' }}>
          <Button title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
