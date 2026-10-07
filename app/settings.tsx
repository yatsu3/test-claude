import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from '../src/notifications/reminder';
import { getReminderPreference, saveReminderPreference } from '../src/settings/preferences';

export default function SettingsScreen() {
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReminderPreference()
      .then((pref) => {
        if (!cancelled) {
          setNotificationId(pref?.notificationId ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('設定の読み込みに失敗しました');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async () => {
    setError(null);
    try {
      const id = await scheduleDailyReminder(DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE);
      if (!id) {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      setNotificationId(id);
      await saveReminderPreference({
        hour: DEFAULT_REMINDER_HOUR,
        minute: DEFAULT_REMINDER_MINUTE,
        notificationId: id,
      });
    } catch {
      setError('リマインドの設定に失敗しました');
    }
  };

  const handleDisable = async () => {
    setError(null);
    try {
      if (notificationId) {
        await cancelDailyReminder(notificationId);
      }
      setNotificationId(null);
      await saveReminderPreference({
        hour: DEFAULT_REMINDER_HOUR,
        minute: DEFAULT_REMINDER_MINUTE,
        notificationId: null,
      });
    } catch {
      setError('リマインドの解除に失敗しました');
    }
  };

  if (!loaded) {
    return null;
  }

  return (
    <View style={{ padding: 16 }}>
      {notificationId ? (
        <>
          <Text style={{ marginBottom: 12 }}>
            {`${String(DEFAULT_REMINDER_HOUR).padStart(2, '0')}:${String(DEFAULT_REMINDER_MINUTE).padStart(2, '0')} にリマインドします`}
          </Text>
          <Pressable onPress={handleDisable}>
            <Text>リマインドを無効にする</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={handleEnable}>
            <Text>リマインドを有効にする</Text>
          </Pressable>
          {permissionDenied && (
            <Text style={{ marginTop: 12, color: '#b00' }}>
              通知が許可されていないため、リマインドをオンにできません
            </Text>
          )}
        </>
      )}
      {error && <Text style={{ marginTop: 12, color: '#b00' }}>{error}</Text>}
    </View>
  );
}
