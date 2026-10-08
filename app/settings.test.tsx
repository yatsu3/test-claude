import React from 'react';
import { AppState } from 'react-native';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from './settings';

const mockGetPref = jest.fn();
const mockSavePref = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
const mockCancelAll = jest.fn();
const mockPermission = jest.fn();
let mockPickerOnChange: ((e: unknown, d?: Date) => void) | undefined;

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: { onChange: (e: unknown, d?: Date) => void }) => {
    mockPickerOnChange = props.onChange;
    return null;
  },
}));

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(cb, [cb]);
    },
  };
});
jest.mock('../src/settings/preferences', () => ({
  getReminderPreference: (...args: unknown[]) => mockGetPref(...args),
  saveReminderPreference: (...args: unknown[]) => mockSavePref(...args),
}));
jest.mock('../src/notifications/reminder', () => ({
  scheduleDailyReminder: (...args: unknown[]) => mockSchedule(...args),
  cancelDailyReminder: (...args: unknown[]) => mockCancel(...args),
  cancelAllReminders: (...args: unknown[]) => mockCancelAll(...args),
  getNotificationPermissionDenied: (...args: unknown[]) => mockPermission(...args),
  DEFAULT_REMINDER_HOUR: 21,
  DEFAULT_REMINDER_MINUTE: 0,
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockPermission.mockResolvedValue(false); // not denied
    mockCancel.mockResolvedValue(undefined);
    mockCancelAll.mockResolvedValue(undefined);
    mockSavePref.mockResolvedValue(undefined);
  });
  afterEach(() => jest.clearAllMocks());

  it('shows that reminders are off when scheduling returns null (permission denied)', async () => {
    mockGetPref.mockResolvedValue(null);
    mockSchedule.mockResolvedValue(null);

    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByText('リマインドを有効にする'));

    await waitFor(() => {
      expect(screen.getByText('通知が許可されていないため、リマインドをオンにできません')).toBeTruthy();
    });
    expect(mockSavePref).not.toHaveBeenCalled();
  });

  it('enables the reminder and persists the preference when permission is granted', async () => {
    mockGetPref.mockResolvedValue(null);
    mockSchedule.mockResolvedValue('notif-1');

    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByText('リマインドを有効にする'));

    await waitFor(() => {
      expect(mockSavePref).toHaveBeenCalledWith({ hour: 21, minute: 0, notificationId: 'notif-1' });
      expect(screen.getByText('21:00 にリマインドします')).toBeTruthy();
    });
  });

  it('disables an existing reminder by cancelling all scheduled notifications and clears the stored id', async () => {
    mockGetPref.mockResolvedValue({ hour: 21, minute: 0, notificationId: 'notif-9' });

    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByText('リマインドを無効にする'));

    await waitFor(() => {
      expect(mockCancelAll).toHaveBeenCalled();
      expect(mockSavePref).toHaveBeenCalledWith({ hour: 21, minute: 0, notificationId: null });
      expect(screen.getByText('リマインドを有効にする')).toBeTruthy();
    });
  });

  it('shows an error instead of crashing when scheduling throws', async () => {
    mockGetPref.mockResolvedValue(null);
    mockSchedule.mockRejectedValue(new Error('boom'));

    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByText('リマインドを有効にする'));

    await waitFor(() => {
      expect(screen.getByText('リマインドの設定に失敗しました')).toBeTruthy();
    });
  });

  it('still renders the enable button when loading preferences fails', async () => {
    mockGetPref.mockRejectedValue(new Error('boom'));

    await render(<SettingsScreen />);

    expect(await screen.findByText('リマインドを有効にする')).toBeTruthy();
  });

  it('cancels the new notification and stays disabled when saving fails', async () => {
    mockGetPref.mockResolvedValue(null);
    mockSchedule.mockResolvedValue('notif-2');
    mockSavePref.mockRejectedValue(new Error('disk'));

    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByText('リマインドを有効にする'));

    await waitFor(() => {
      expect(screen.getByText('リマインドの設定に失敗しました')).toBeTruthy();
    });
    expect(mockCancel).toHaveBeenCalledWith('notif-2');
    expect(screen.getByText('リマインドを有効にする')).toBeTruthy();
  });

  it('reschedules at the new time when the time changes while enabled', async () => {
    mockGetPref.mockResolvedValue({ hour: 21, minute: 0, notificationId: 'notif-1' });
    mockSchedule.mockResolvedValue('notif-3');

    await render(<SettingsScreen />);
    await screen.findByText('リマインドを無効にする');
    const d = new Date();
    d.setHours(7, 5, 0, 0);
    await act(async () => {
      mockPickerOnChange?.({}, d);
    });

    await waitFor(() => {
      expect(mockSchedule).toHaveBeenCalledWith(7, 5);
      expect(mockSavePref).toHaveBeenCalledWith({ hour: 7, minute: 5, notificationId: 'notif-3' });
      expect(screen.getByText('07:05 にリマインドします')).toBeTruthy();
    });
  });

  it('only persists the time when the reminder is disabled', async () => {
    mockGetPref.mockResolvedValue(null);

    await render(<SettingsScreen />);
    await screen.findByText('リマインドを有効にする');
    const d = new Date();
    d.setHours(6, 30, 0, 0);
    await act(async () => {
      mockPickerOnChange?.({}, d);
    });

    await waitFor(() => {
      expect(mockSavePref).toHaveBeenCalledWith({ hour: 6, minute: 30, notificationId: null });
      expect(screen.getByText('リマインド時刻: 06:30')).toBeTruthy();
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('shows a banner when notification permission is denied', async () => {
    mockGetPref.mockResolvedValue(null);
    mockPermission.mockResolvedValue(true);

    await render(<SettingsScreen />);

    expect(await screen.findByText('通知がオフになっています')).toBeTruthy();
  });

  it('shows no banner when notification permission is not denied (granted or undetermined)', async () => {
    mockGetPref.mockResolvedValue(null);

    await render(<SettingsScreen />);
    await screen.findByText('リマインドを有効にする');

    expect(screen.queryByText('通知がオフになっています')).toBeNull();
  });

  it('serializes rapid time changes so reschedules never interleave and the last time wins', async () => {
    mockGetPref.mockResolvedValue({ hour: 21, minute: 0, notificationId: 'notif-1' });
    let resolveFirst: (id: string) => void = () => {};
    mockSchedule
      .mockImplementationOnce(() => new Promise<string>((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce('notif-last');

    await render(<SettingsScreen />);
    await screen.findByText('リマインドを無効にする');
    const at = (h: number, m: number) => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    await act(async () => {
      mockPickerOnChange?.({}, at(7, 0));
      mockPickerOnChange?.({}, at(7, 1));
      mockPickerOnChange?.({}, at(7, 2));
    });

    // Only the first reschedule is in flight; later changes wait.
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFirst('notif-first');
    });

    await waitFor(() => {
      expect(screen.getByText('07:02 にリマインドします')).toBeTruthy();
    });
    expect(mockSchedule).toHaveBeenCalledTimes(2);
    expect(mockSchedule).toHaveBeenNthCalledWith(1, 7, 0);
    expect(mockSchedule).toHaveBeenNthCalledWith(2, 7, 2);
    expect(mockSavePref).toHaveBeenLastCalledWith({ hour: 7, minute: 2, notificationId: 'notif-last' });
  });

  it('does not re-enable the reminder when disabled while a reschedule is in flight', async () => {
    mockGetPref.mockResolvedValue({ hour: 21, minute: 0, notificationId: 'notif-1' });
    let resolveSchedule: (id: string) => void = () => {};
    mockSchedule.mockImplementationOnce(() => new Promise<string>((r) => { resolveSchedule = r; }));
    const order: string[] = [];
    mockCancelAll.mockImplementation(async () => { order.push('cancelAll'); });
    mockSchedule.mockImplementation(async () => { order.push('schedule'); return 'late'; });
    mockSchedule.mockImplementationOnce(
      () => new Promise<string>((r) => { order.push('schedule'); resolveSchedule = r; })
    );
    mockSavePref.mockImplementation(async (p: { notificationId: string | null }) => {
      order.push(`save:${p.notificationId}`);
    });

    await render(<SettingsScreen />);
    await screen.findByText('リマインドを無効にする');
    const at = (h: number, m: number) => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    await act(async () => {
      mockPickerOnChange?.({}, at(7, 0)); // in flight
      mockPickerOnChange?.({}, at(7, 1)); // queued
    });
    await fireEvent.press(screen.getByText('リマインドを無効にする'));
    await act(async () => {
      resolveSchedule('notif-first');
    });

    await waitFor(() => expect(screen.getByText('リマインドを有効にする')).toBeTruthy());
    await act(async () => {});
    const cancelIdx = order.lastIndexOf('cancelAll');
    expect(cancelIdx).toBeGreaterThanOrEqual(0);
    expect(order.slice(cancelIdx + 1).filter((o) => o === 'schedule' || o === 'save:late' || o === 'save:notif-first')).toEqual([]);
    expect(order[order.length - 1]).toBe('save:null');
    expect(screen.queryByText(/にリマインドします/)).toBeNull();
  });

  it('refreshes the permission banner when the app becomes active again', async () => {
    mockGetPref.mockResolvedValue(null);
    mockPermission.mockResolvedValueOnce(true).mockResolvedValue(false);
    const addListener = jest.spyOn(AppState, 'addEventListener');

    await render(<SettingsScreen />);
    expect(await screen.findByText('通知がオフになっています')).toBeTruthy();

    const onChange = addListener.mock.calls[0][1] as (state: string) => void;
    await act(async () => {
      onChange('active');
    });
    await waitFor(() => expect(screen.queryByText('通知がオフになっています')).toBeNull());
    addListener.mockRestore();
  });
});
