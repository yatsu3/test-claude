import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TodayScreen from './index';

const mockGet = jest.fn();
let mockFocus: (() => void | (() => void)) | undefined;

jest.mock('../../src/db/client', () => ({ db: {} }));
jest.mock('../../src/db/recordRepository', () => ({
  getRecordByDate: (...args: unknown[]) => mockGet(...args),
}));
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      mockFocus = cb;
      ReactActual.useEffect(cb, [cb]);
    },
  };
});
// The mock form copies initialRecord into state on mount (like the real form),
// so its text only changes when TodayScreen remounts it.
jest.mock('../../src/features/record/RecordForm', () => {
  const ReactActual = require('react');
  const { Text, Pressable } = require('react-native');
  return {
    RecordForm: ({ date, initialRecord, onSaved }: any) => {
      const [condition] = ReactActual.useState(initialRecord ? initialRecord.condition : 'none');
      return (
        <>
          <Text>{`form:${condition}`}</Text>
          <Text>{`formDate:${date}`}</Text>
          <Pressable
            onPress={() => onSaved({ date, condition: 5, updatedAt: 'saved-at' })}
          >
            <Text>mock-save</Text>
          </Pressable>
        </>
      );
    },
  };
});

describe('TodayScreen', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('shows only the error (no form) when loading fails, and can retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText('記録の読み込みに失敗しました')).toBeTruthy());
    expect(screen.queryByText(/^form:/)).toBeNull();

    mockGet.mockResolvedValueOnce({ id: 1, condition: 4, updatedAt: 't1' });
    await fireEvent.press(screen.getByText('再読み込み'));
    await waitFor(() => expect(screen.getByText('form:4')).toBeTruthy());
  });

  it('renders the form with the loaded record and shows today\'s date at the top', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 8, 10, 0) });
    mockGet.mockResolvedValue({ id: 1, condition: 3, updatedAt: 't1' });
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText('form:3')).toBeTruthy());
    expect(screen.getByText('2026-10-08 の記録')).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith({}, '2026-10-08');
  });

  it('reloads on refocus and remounts the form when the record was edited elsewhere', async () => {
    mockGet.mockResolvedValue({ id: 1, condition: 3, updatedAt: 't1' });
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText('form:3')).toBeTruthy());

    // Edited via History → edit route; tab regains focus.
    mockGet.mockResolvedValue({ id: 1, condition: 1, updatedAt: 't2' });
    await act(async () => {
      mockFocus?.();
    });
    await waitFor(() => expect(screen.getByText('form:1')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does not remount the form on refocus after its own save', async () => {
    mockGet.mockResolvedValue({ id: 1, condition: 3, updatedAt: 't1' });
    await render(<TodayScreen />);
    await fireEvent.press(await screen.findByText('mock-save'));

    mockGet.mockResolvedValue({ id: 1, condition: 5, updatedAt: 'saved-at' });
    await act(async () => {
      mockFocus?.();
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    // Same form instance (its mount-time state is untouched).
    expect(screen.getByText('form:3')).toBeTruthy();
  });

  it('switches to the new date when the app becomes active after midnight', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 8, 23, 50) });
    const addListener = jest.spyOn(AppState, 'addEventListener');
    mockGet.mockResolvedValueOnce({ id: 1, condition: 3, updatedAt: 't1' });
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText('2026-10-08 の記録')).toBeTruthy());

    jest.setSystemTime(new Date(2026, 9, 9, 7, 0));
    mockGet.mockResolvedValueOnce(null);
    const onChange = addListener.mock.calls[0][1] as (state: string) => void;
    await act(async () => {
      onChange('active');
    });

    await waitFor(() => expect(screen.getByText('2026-10-09 の記録')).toBeTruthy());
    expect(mockGet).toHaveBeenLastCalledWith({}, '2026-10-09');
    expect(screen.getByText('formDate:2026-10-09')).toBeTruthy();
    expect(screen.getByText('form:none')).toBeTruthy();
  });

  it('shows "保存しました" after saving and hides it after about 2 seconds', async () => {
    jest.useFakeTimers();
    mockGet.mockResolvedValue({ id: 1, condition: 3, updatedAt: 't1' });
    await render(<TodayScreen />);
    await fireEvent.press(await screen.findByText('mock-save'));

    expect(screen.getByText('保存しました')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByText('保存しました')).toBeNull();
  });

  it('clears the saved-message timer on unmount', async () => {
    jest.useFakeTimers();
    mockGet.mockResolvedValue({ id: 1, condition: 3, updatedAt: 't1' });
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { unmount } = await render(<TodayScreen />);
    await fireEvent.press(await screen.findByText('mock-save'));
    const savedTimerCall = setTimeoutSpy.mock.calls.findIndex(([, ms]) => ms === 2000);
    expect(savedTimerCall).toBeGreaterThanOrEqual(0);
    const timerId = setTimeoutSpy.mock.results[savedTimerCall].value;
    await unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
  });
});
