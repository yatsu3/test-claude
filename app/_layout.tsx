import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';
import { configureNotificationHandler } from '../src/notifications/reminder';
import { StatusView } from '../src/ui/StatusView';
import { colors } from '../src/ui/theme';

// Show reminders even while the app is in the foreground.
configureNotificationHandler();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  const router = useRouter();

  useEffect(() => {
    if (!success) {
      return;
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/');
    });
    return () => subscription.remove();
  }, [success, router]);

  if (error) {
    return (
      <StatusView tone="error" title="データベースの初期化に失敗しました" description="アプリを再起動してください" />
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="settings" options={{ headerShown: true, title: '設定' }} />
      <Stack.Screen
        name="record-edit/[date]"
        options={{ headerShown: true, title: '記録の編集', headerBackTitle: '戻る' }}
      />
    </Stack>
  );
}
