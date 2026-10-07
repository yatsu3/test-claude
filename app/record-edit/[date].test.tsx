import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RecordEditScreen from './[date]';

const mockGet = jest.fn();
const mockBack = jest.fn();

jest.mock('../../src/db/client', () => ({ db: {} }));
jest.mock('../../src/db/recordRepository', () => ({
  getRecordByDate: (...args: unknown[]) => mockGet(...args),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ date: '2026-10-07' }),
  useRouter: () => ({ back: mockBack }),
}));
jest.mock('../../src/features/record/RecordForm', () => {
  const { Text, Pressable } = require('react-native');
  return {
    RecordForm: ({ date, initialRecord, onSaved }: any) => (
      <>
        <Text>{`form:${date}:${initialRecord ? initialRecord.condition : 'none'}`}</Text>
        <Pressable onPress={() => onSaved(initialRecord)}>
          <Text>保存</Text>
        </Pressable>
      </>
    ),
  };
});

describe('RecordEditScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('loads the record for the route date and prefills the form', async () => {
    mockGet.mockResolvedValue({ id: 1, date: '2026-10-07', condition: 2 });
    await render(<RecordEditScreen />);
    await waitFor(() => expect(screen.getByText('form:2026-10-07:2')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledWith({}, '2026-10-07');
  });

  it('goes back after saving', async () => {
    mockGet.mockResolvedValue({ id: 1, date: '2026-10-07', condition: 2 });
    await render(<RecordEditScreen />);
    await fireEvent.press(await screen.findByText('保存'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows only the error (no form or save button) when loading fails, and can retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    await render(<RecordEditScreen />);
    await waitFor(() => expect(screen.getByText('記録の読み込みに失敗しました')).toBeTruthy());
    expect(screen.queryByText('保存')).toBeNull();
    expect(screen.queryByText(/^form:/)).toBeNull();

    mockGet.mockResolvedValueOnce({ id: 1, date: '2026-10-07', condition: 5 });
    await fireEvent.press(screen.getByText('再読み込み'));
    await waitFor(() => expect(screen.getByText('form:2026-10-07:5')).toBeTruthy());
  });
});
