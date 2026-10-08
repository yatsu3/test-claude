import * as Notifications from 'expo-notifications';

export const DEFAULT_REMINDER_HOUR = 21;
export const DEFAULT_REMINDER_MINUTE = 0;

let handlerConfigured = false;

// Lets reminders show as a banner (and in Notification Center) while the app is in the foreground.
export function configureNotificationHandler(): void {
  if (handlerConfigured) {
    return;
  }
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// True only when the user has explicitly denied notifications (not when still undetermined).
export async function getNotificationPermissionDenied(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return current.status === 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }

  // The app only ever has one reminder; clear any previous one so scheduling is idempotent.
  await Notifications.cancelAllScheduledNotificationsAsync();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: '今日の記録をつけましょう',
      body: '睡眠時間とコンディションを記録しましょう。',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function cancelDailyReminder(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

// The app only ever owns one reminder, so disabling clears every scheduled notification
// (covers any stray duplicate left by an interrupted reschedule).
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
