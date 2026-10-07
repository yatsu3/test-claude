import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TodayScreen from './index';

const mockGet = jest.fn();

jest.mock('../../src/db/client', () => ({ db: {} }));
jest.mock('../../src/db/recordRepository', () => ({
  getRecordByDate: (...args: unknown[]) => mockGet(...args),
}));
jest.mock('../../src/features/record/RecordForm', () => {
  const { Text } = require('react-native');
  return {
    RecordForm: ({ initialRecord }: any) => (
      <Text>{`form:${initialRecord ? initialRecord.condition : 'none'}`}</Text>
    ),
  };
});

describe('TodayScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows only the error (no form) when loading fails, and can retry', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText('記録の読み込みに失敗しました')).toBeTruthy());
    expect(screen.queryByText(/^form:/)).toBeNull();

    mockGet.mockResolvedValueOnce({ id: 1, condition: 4 });
    await fireEvent.press(screen.getByText('再読み込み'));
    await waitFor(() => expect(screen.getByText('form:4')).toBeTruthy());
  });

  it('renders the form with the loaded record', async () => {
    mockGet.mockResolvedValue({ id: 1, condition: 3 });
    await render(<TodayScreen />);
    await waitFor(() => expect(screen.getByText('form:3')).toBeTruthy());
  });
});
