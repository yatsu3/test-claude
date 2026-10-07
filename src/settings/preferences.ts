import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reminderPreference';

export type ReminderPreference = {
  hour: number;
  minute: number;
  notificationId: string | null;
};

export async function getReminderPreference(): Promise<ReminderPreference | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ReminderPreference;
  } catch {
    return null;
  }
}

export async function saveReminderPreference(pref: ReminderPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
