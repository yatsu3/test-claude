import React from 'react';
import { Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Icon, type IconName } from '../../src/ui/Icon';
import { colors, spacing, TOUCH_MIN } from '../../src/ui/theme';

const tabIcon =
  (name: IconName) =>
  ({ focused, size }: { focused: boolean; size: number }) => (
    <Icon name={name} color={focused ? colors.primary : colors.textMuted} size={size} />
  );

export default function TabsLayout() {
  const router = useRouter();
  const settingsButton = () => (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel="設定"
      hitSlop={8}
      style={({ pressed }) => ({
        minWidth: TOUCH_MIN,
        minHeight: TOUCH_MIN,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.xs,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Icon name="settings" color={colors.text} size={22} />
    </Pressable>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: settingsButton,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '記録', tabBarIcon: tabIcon('moon') }} />
      <Tabs.Screen name="history" options={{ title: '履歴', tabBarIcon: tabIcon('calendar') }} />
      <Tabs.Screen name="analysis" options={{ title: '分析', tabBarIcon: tabIcon('chart') }} />
    </Tabs>
  );
}
