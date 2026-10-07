import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  getNotificationPermissionGranted,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from '../src/notifications/reminder';
import { getReminderPreference, saveReminderPreference } from '../src/settings/preferences';

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function SettingsScreen() {
  const [hour, setHour] = useState(DEFAULT_REMINDER_HOUR);
  const [minute, setMinute] = useState(DEFAULT_REMINDER_MINUTE);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [permissionOff, setPermissionOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReminderPreference()
      .then((pref) => {
        if (!cancelled && pref) {
          setHour(pref.hour);
          setMinute(pref.minute);
          setNotificationId(pref.notificationId);
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
    getNotificationPermissionGranted()
      .then((granted) => {
        if (!cancelled) {
          setPermissionOff(!granted);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Schedules at the given time, persists first, then updates state.
  // If persisting fails, the just-scheduled notification is cancelled.
  const scheduleAndPersist = async (h: number, m: number) => {
    const id = await scheduleDailyReminder(h, m);
    if (!id) {
      // Any previous reminder may have been left in place; keep state as is.
      setPermissionDenied(true);
      setPermissionOff(true);
      return;
    }
    try {
      await saveReminderPreference({ hour: h, minute: m, notificationId: id });
    } catch (e) {
      await cancelDailyReminder(id).catch(() => {});
      setNotificationId(null);
      throw e;
    }
    setPermissionDenied(false);
    setPermissionOff(false);
    setHour(h);
    setMinute(m);
    setNotificationId(id);
  };

  const handleEnable = async () => {
    setError(null);
    try {
      await scheduleAndPersist(hour, minute);
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
      await saveReminderPreference({ hour, minute, notificationId: null });
      setNotificationId(null);
    } catch {
      setError('リマインドの解除に失敗しました');
    }
  };

  const handleTimeChange = async (date: Date | undefined) => {
    if (!date) {
      return;
    }
    const h = date.getHours();
    const m = date.getMinutes();
    setError(null);
    try {
      if (notificationId) {
        await scheduleAndPersist(h, m);
      } else {
        await saveReminderPreference({ hour: h, minute: m, notificationId: null });
        setHour(h);
        setMinute(m);
      }
    } catch {
      setError('リマインド時刻の変更に失敗しました');
    }
  };

  if (!loaded) {
    return null;
  }

  const pickerValue = new Date();
  pickerValue.setHours(hour, minute, 0, 0);

  return (
    <View style={{ padding: 16 }}>
      {permissionOff && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: '#b00', fontWeight: 'bold' }}>通知がオフになっています</Text>
          <Text style={{ color: '#b00' }}>iOSの設定アプリでこのアプリの通知を許可してください</Text>
        </View>
      )}
      <Text style={{ marginBottom: 8 }}>リマインド時刻: {formatTime(hour, minute)}</Text>
      <DateTimePicker
        value={pickerValue}
        mode="time"
        onChange={(_event, date) => {
          void handleTimeChange(date);
        }}
      />
      {notificationId ? (
        <>
          <Text style={{ marginVertical: 12 }}>{`${formatTime(hour, minute)} にリマインドします`}</Text>
          <Pressable onPress={handleDisable}>
            <Text>リマインドを無効にする</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={handleEnable} style={{ marginTop: 12 }}>
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
