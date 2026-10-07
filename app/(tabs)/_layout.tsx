import React from 'react';
import { Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';

export default function TabsLayout() {
  const router = useRouter();
  const settingsButton = () => (
    <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 12 }}>
      <Text>設定</Text>
    </Pressable>
  );

  return (
    <Tabs screenOptions={{ headerShown: true, headerRight: settingsButton }}>
      <Tabs.Screen name="index" options={{ title: '記録' }} />
      <Tabs.Screen name="history" options={{ title: '履歴' }} />
      <Tabs.Screen name="analysis" options={{ title: '分析' }} />
    </Tabs>
  );
}
