import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReminderPreference, saveReminderPreference } from './preferences';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('reminder preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when no preference has been saved', async () => {
    const pref = await getReminderPreference();
    expect(pref).toBeNull();
  });

  it('round-trips a saved preference', async () => {
    await saveReminderPreference({ hour: 22, minute: 30, notificationId: 'abc' });
    const pref = await getReminderPreference();
    expect(pref).toEqual({ hour: 22, minute: 30, notificationId: 'abc' });
  });

  it('returns null when stored data is corrupt', async () => {
    await AsyncStorage.setItem('reminderPreference', '{not json');
    expect(await getReminderPreference()).toBeNull();
  });
});
