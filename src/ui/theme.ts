// src/ui/theme.ts
// Design tokens: "night indigo" palette on a soft, non-pure-white light surface.
// Text colors keep >= 4.5:1 contrast against both `background` and `surface`.

export const colors = {
  background: '#F4F5FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0FA',
  border: '#E2E5F1',
  text: '#0F172A',
  textMuted: '#475569',
  primary: '#4338CA',
  primaryPressed: '#3730A3',
  primarySoft: '#E0E7FF',
  onPrimary: '#FFFFFF',
  disabled: '#A5B4CB',
  error: '#B91C1C',
  errorSoft: '#FEE2E2',
  success: '#15803D',
  successSoft: '#DCFCE7',
} as const;

// 1 (poor) → 5 (great). Used for condition badges and the selector.
export const conditionColors: Record<number, string> = {
  1: '#B91C1C',
  2: '#C2410C',
  3: '#A16207',
  4: '#4D7C0F',
  5: '#15803D',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const font = {
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.textMuted },
  caption: { fontSize: 13, color: colors.textMuted },
};

// Minimum touch target (iOS HIG).
export const TOUCH_MIN = 44;

export const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  padding: spacing.lg,
};
