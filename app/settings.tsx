import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  cancelAllReminders,
  getNotificationPermissionDenied,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from '../src/notifications/reminder';
import { getReminderPreference, saveReminderPreference } from '../src/settings/preferences';
import { Button } from '../src/ui/Button';
import { cardStyle, colors, font, radius, spacing, TOUCH_MIN } from '../src/ui/theme';

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function SettingsScreen() {
  const [hour, setHourState] = useState(DEFAULT_REMINDER_HOUR);
  const [minute, setMinuteState] = useState(DEFAULT_REMINDER_MINUTE);
  // Mirror hour/minute so queued operations use the latest applied time.
  const hourRef = useRef(DEFAULT_REMINDER_HOUR);
  const minuteRef = useRef(DEFAULT_REMINDER_MINUTE);
  const setHour = (h: number) => {
    hourRef.current = h;
    setHourState(h);
  };
  const setMinute = (m: number) => {
    minuteRef.current = m;
    setMinuteState(m);
  };
  const [notificationId, setNotificationIdState] = useState<string | null>(null);
  // Mirrors notificationId so serialized time changes always see the latest value.
  const notificationIdRef = useRef<string | null>(null);
  const setNotificationId = (id: string | null) => {
    notificationIdRef.current = id;
    setNotificationIdState(id);
  };
  // Enable, disable and time changes all run through one queue so they never interleave.
  // An operation starts immediately when the queue is idle. Operations never reject.
  const queueTail = useRef<Promise<void> | null>(null);
  const enqueue = (op: () => Promise<void>) => {
    const prev = queueTail.current;
    const run = prev ? prev.then(op) : op();
    const tail: Promise<void> = run.finally(() => {
      if (queueTail.current === tail) {
        queueTail.current = null;
      }
    });
    queueTail.current = tail;
  };
  // Whether the user currently wants the reminder on (set when they tap, before the queued
  // operation runs). Queued time changes after a disable must not reschedule.
  const desiredEnabled = useRef(false);
  const toggleSeq = useRef(0);
  // Picker onChange can fire rapidly; the most recent requested time wins.
  const pendingTime = useRef<Date | null>(null);
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
          desiredEnabled.current = pref.notificationId !== null;
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

  // Re-checks OS notification permission on mount/focus and when the app returns from
  // iOS Settings.
  const checkPermission = useCallback(() => {
    let cancelled = false;
    getNotificationPermissionDenied()
      .then((denied) => {
        if (!cancelled) {
          setPermissionOff(denied);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(checkPermission);

  useEffect(() => {
    let cancelPrevious: (() => void) | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        cancelPrevious?.();
        cancelPrevious = checkPermission();
      }
    });
    return () => {
      cancelPrevious?.();
      subscription.remove();
    };
  }, [checkPermission]);

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

  const handleEnable = () => {
    setError(null);
    desiredEnabled.current = true;
    const seq = ++toggleSeq.current;
    enqueue(async () => {
      if (!desiredEnabled.current) {
        return; // disabled again before this ran
      }
      try {
        await scheduleAndPersist(hourRef.current, minuteRef.current);
      } catch {
        setError('リマインドの設定に失敗しました');
      }
      if (seq === toggleSeq.current) {
        desiredEnabled.current = notificationIdRef.current !== null;
      }
    });
  };

  const handleDisable = () => {
    setError(null);
    desiredEnabled.current = false;
    toggleSeq.current++;
    enqueue(async () => {
      try {
        // Clear every scheduled notification, not just the stored id, so no stray duplicate survives.
        await cancelAllReminders();
        await saveReminderPreference({
          hour: hourRef.current,
          minute: minuteRef.current,
          notificationId: null,
        });
        setNotificationId(null);
      } catch {
        // Still enabled: keep the desired state consistent with the UI.
        desiredEnabled.current = notificationIdRef.current !== null;
        setError('リマインドの解除に失敗しました');
      }
    });
  };

  const applyTimeChange = async (date: Date) => {
    const h = date.getHours();
    const m = date.getMinutes();
    setError(null);
    try {
      if (desiredEnabled.current && notificationIdRef.current) {
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

  const handleTimeChange = (date: Date | undefined) => {
    if (!date) {
      return;
    }
    pendingTime.current = date;
    enqueue(async () => {
      if (pendingTime.current !== date) {
        return; // superseded by a newer change
      }
      pendingTime.current = null;
      await applyTimeChange(date);
    });
  };

  if (!loaded) {
    return null;
  }

  const pickerValue = new Date();
  pickerValue.setHours(hour, minute, 0, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      {permissionOff && (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: colors.errorSoft,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.xs,
          }}
        >
          <Text style={{ color: colors.error, fontWeight: '700', fontSize: 15 }}>通知がオフになっています</Text>
          <Text style={{ color: colors.error }}>iOSの設定アプリでこのアプリの通知を許可してください</Text>
        </View>
      )}

      <View style={cardStyle}>
        <Text accessibilityRole="header" style={font.heading}>
          記録リマインド
        </Text>
        <Text style={{ ...font.caption, marginTop: spacing.xs }}>毎日決まった時刻に記録を促す通知を送ります</Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.lg,
            minHeight: TOUCH_MIN,
          }}
        >
          <Text style={font.body}>リマインド時刻: {formatTime(hour, minute)}</Text>
          <DateTimePicker
            value={pickerValue}
            mode="time"
            accentColor={colors.primary}
            onChange={(_event, date) => {
              handleTimeChange(date);
            }}
          />
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.lg }} />

        {notificationId ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
              <Text style={{ ...font.body, color: colors.success, fontWeight: '600' }}>
                {`${formatTime(hour, minute)} にリマインドします`}
              </Text>
            </View>
            <Button title="リマインドを無効にする" variant="danger" onPress={handleDisable} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Button title="リマインドを有効にする" onPress={handleEnable} />
            {permissionDenied && (
              <Text accessibilityRole="alert" style={{ color: colors.error }}>
                通知が許可されていないため、リマインドをオンにできません
              </Text>
            )}
          </View>
        )}
        {error && (
          <Text accessibilityRole="alert" style={{ marginTop: spacing.md, color: colors.error }}>
            {error}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}
