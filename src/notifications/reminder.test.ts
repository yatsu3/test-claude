import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermission,
  getNotificationPermissionDenied,
  scheduleDailyReminder,
  cancelDailyReminder,
  cancelAllReminders,
  configureNotificationHandler,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from './reminder';

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { CALENDAR: 'calendar' },
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('constants', () => {
  it('defaults to 21:00', () => {
    expect(DEFAULT_REMINDER_HOUR).toBe(21);
    expect(DEFAULT_REMINDER_MINUTE).toBe(0);
  });
});

describe('requestNotificationPermission', () => {
  it('returns true when granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermission();
    expect(result).toBe(true);
  });

  it('returns false when denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });

  it('skips the prompt and returns true when already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermission();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleDailyReminder', () => {
  it('schedules a repeating daily notification and returns its id', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('reminder-id-1');

    const id = await scheduleDailyReminder(21, 0);

    expect(id).toBe('reminder-id-1');
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 21, minute: 0, repeats: true }),
      })
    );
  });

  it('returns null without scheduling when permission is not granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const id = await scheduleDailyReminder(21, 0);

    expect(id).toBeNull();
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelDailyReminder', () => {
  it('cancels the scheduled notification by id', async () => {
    await cancelDailyReminder('reminder-id-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-id-1');
  });
});

describe('cancelAllReminders', () => {
  it('cancels every scheduled notification', async () => {
    await cancelAllReminders();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });
});

describe('getNotificationPermissionDenied', () => {
  it('is true only when permission is explicitly denied, without prompting', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    expect(await getNotificationPermissionDenied()).toBe(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    expect(await getNotificationPermissionDenied()).toBe(false);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    expect(await getNotificationPermissionDenied()).toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('configureNotificationHandler', () => {
  it('registers a handler once that shows banners/list and plays sound in the foreground', async () => {
    configureNotificationHandler();
    configureNotificationHandler();
    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    await expect(handler.handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
});
