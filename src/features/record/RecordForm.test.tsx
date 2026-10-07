// src/features/record/RecordForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { RecordForm } from './RecordForm';

const mockUpsert = jest.fn();
const mockGetByDate = jest.fn();
const mockGetSleep = jest.fn();

jest.mock('../../db/client', () => ({ db: {} }));
jest.mock('../../db/recordRepository', () => ({
  upsertDailyRecord: (...args: unknown[]) => mockUpsert(...args),
  getRecordByDate: (...args: unknown[]) => mockGetByDate(...args),
}));
jest.mock('../../healthkit/sleep', () => ({
  getLastNightSleepMinutes: (...args: unknown[]) => mockGetSleep(...args),
}));

describe('RecordForm', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockGetByDate.mockReset();
    mockGetSleep.mockReset();
  });

  it('falls back to manual sleep input when HealthKit returns null', async () => {
    mockGetSleep.mockResolvedValue(null);

    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('例: 420')).toBeTruthy();
    });
  });

  it('prefills the sleep field from HealthKit when available and marks the source', async () => {
    mockGetSleep.mockResolvedValue(430);

    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('430')).toBeTruthy();
    });
    expect(mockGetSleep).toHaveBeenCalledWith(new Date(2026, 9, 8));
  });

  it('saves sleepSource healthkit when the HealthKit value is untouched', async () => {
    mockGetSleep.mockResolvedValue(430);
    mockUpsert.mockResolvedValue({ id: 1 });
    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);
    await waitFor(() => screen.getByDisplayValue('430'));
    await fireEvent.press(screen.getByText('3'));
    await fireEvent.press(screen.getByText('保存'));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sleepMinutes: 430, sleepSource: 'healthkit' })
    );
  });

  it('shows an error and does not call onSaved when save fails', async () => {
    mockGetSleep.mockResolvedValue(null);
    mockUpsert.mockRejectedValue(new Error('boom'));
    const onSaved = jest.fn();
    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={onSaved} />);
    await waitFor(() => screen.getByText('保存'));
    await fireEvent.press(screen.getByText('3'));
    await fireEvent.press(screen.getByText('保存'));
    await waitFor(() => expect(screen.getByText('保存に失敗しました')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '保存' }).props.accessibilityState?.disabled).toBe(false);
  });

  it('does not overwrite manual input with a late HealthKit result', async () => {
    let resolveSleep: (v: number | null) => void = () => {};
    mockGetSleep.mockReturnValue(new Promise((r) => { resolveSleep = r; }));
    mockUpsert.mockResolvedValue({ id: 1 });
    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);
    await fireEvent.changeText(screen.getByPlaceholderText('例: 420'), '300');
    await act(async () => { resolveSleep(430); });
    expect(screen.getByDisplayValue('300')).toBeTruthy();
    await fireEvent.press(screen.getByText('3'));
    await fireEvent.press(screen.getByText('保存'));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sleepMinutes: 300, sleepSource: 'manual' })
    );
  });

  it('falls back to manual input when the HealthKit lookup rejects', async () => {
    mockGetSleep.mockRejectedValue(new Error('denied'));
    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);
    await waitFor(() => expect(mockGetSleep).toHaveBeenCalled());
    expect(screen.getByPlaceholderText('例: 420')).toBeTruthy();
  });

  it('blocks save and shows a message for invalid sleep input', async () => {
    mockGetSleep.mockResolvedValue(null);
    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);
    await waitFor(() => screen.getByText('保存'));
    await fireEvent.press(screen.getByText('3'));
    for (const bad of ['abc', '4.5', '-3']) {
      await fireEvent.changeText(screen.getByPlaceholderText('例: 420'), bad);
      expect(screen.getByText('睡眠時間は0以上の整数で入力してください')).toBeTruthy();
      expect(screen.getByRole('button', { name: '保存' }).props.accessibilityState?.disabled).toBe(true);
    }
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('saves null sleep and null source when the field is cleared', async () => {
    mockGetSleep.mockResolvedValue(430);
    mockUpsert.mockResolvedValue({ id: 1 });
    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);
    await waitFor(() => screen.getByDisplayValue('430'));
    await fireEvent.changeText(screen.getByPlaceholderText('例: 420'), '');
    await fireEvent.press(screen.getByText('3'));
    await fireEvent.press(screen.getByText('保存'));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sleepMinutes: null, sleepSource: null })
    );
  });

  it('disables save until a condition rating is selected', async () => {
    mockGetSleep.mockResolvedValue(null);

    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);

    await waitFor(() => screen.getByText('保存'));
    expect(screen.getByRole('button', { name: '保存' }).props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByText('3'));
    expect(screen.getByRole('button', { name: '保存' }).props.accessibilityState?.disabled).toBe(false);
  });

  it('calls upsertDailyRecord with the selected values on save', async () => {
    mockGetSleep.mockResolvedValue(null);
    const onSaved = jest.fn();
    mockUpsert.mockResolvedValue({ id: 1, date: '2026-10-08', condition: 4 });

    await render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={onSaved} />);

    await waitFor(() => screen.getByText('保存'));
    await fireEvent.changeText(screen.getByPlaceholderText('例: 420'), '400');
    await fireEvent.press(screen.getByText('4'));
    await fireEvent.press(screen.getByText('保存'));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        date: '2026-10-08',
        sleepMinutes: 400,
        sleepSource: 'manual',
        condition: 4,
        caffeine: 'none',
        exercise: 'none',
        alcohol: 'none',
      })
    );
    expect(onSaved).toHaveBeenCalledWith({ id: 1, date: '2026-10-08', condition: 4 });
  });

  it('prefills from initialRecord when editing an existing date', async () => {
    mockGetSleep.mockResolvedValue(null);

    await render(
      <RecordForm
        date="2026-10-01"
        initialRecord={{
          id: 1,
          date: '2026-10-01',
          sleepMinutes: 390,
          sleepSource: 'manual',
          condition: 2,
          conditionNote: 'メモ',
          caffeine: 'afternoon',
          exercise: 'none',
          alcohol: 'moderate',
          createdAt: '',
          updatedAt: '',
        }}
        onSaved={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('390')).toBeTruthy();
      expect(screen.getByDisplayValue('メモ')).toBeTruthy();
    });
  });
});
