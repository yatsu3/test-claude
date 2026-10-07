// src/features/record/RecordForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
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
