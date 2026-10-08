import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import HistoryScreen from '../../../app/(tabs)/history';

const mockList = jest.fn();
const mockPush = jest.fn();

jest.mock('../../../src/db/client', () => ({ db: {} }));
jest.mock('../../../src/db/recordRepository', () => ({
  listRecordsDesc: (...args: unknown[]) => mockList(...args),
}));
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(cb, [cb]);
    },
  };
});

describe('HistoryScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows an empty-state message when there are no records', async () => {
    mockList.mockResolvedValue([]);
    await render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('まだ記録がありません')).toBeTruthy());
  });

  it('shows an error message when loading fails', async () => {
    mockList.mockRejectedValue(new Error('boom'));
    await render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('記録の読み込みに失敗しました')).toBeTruthy());
  });

  it('lists records with date and condition', async () => {
    mockList.mockResolvedValue([
      { id: 2, date: '2026-10-08', condition: 4, caffeine: 'morning', exercise: 'none', alcohol: 'none' },
      { id: 1, date: '2026-10-07', condition: 2, caffeine: 'none', exercise: 'morning', alcohol: 'moderate' },
    ]);
    await render(<HistoryScreen />);
    await waitFor(() => {
      expect(screen.getByText('2026-10-08')).toBeTruthy();
      expect(screen.getByText('2026-10-07')).toBeTruthy();
    });
  });

  it('shows condition as n/5 and activity chips (struck through when none) on each row', async () => {
    mockList.mockResolvedValue([
      { id: 2, date: '2026-10-08', condition: 4, caffeine: 'morning', exercise: 'none', alcohol: 'heavy' },
    ]);
    await render(<HistoryScreen />);
    expect(await screen.findByText('コンディション: 4/5')).toBeTruthy();

    const caffeine = screen.getByLabelText('カフェインあり');
    const exercise = screen.getByLabelText('運動なし');
    const alcohol = screen.getByLabelText('アルコールあり');
    expect(caffeine).toHaveTextContent('カフェイン');
    expect(exercise).toHaveTextContent('運動');
    expect(alcohol).toHaveTextContent('アルコール');
    expect(caffeine).toHaveStyle({ textDecorationLine: 'none' });
    expect(exercise).toHaveStyle({ textDecorationLine: 'line-through' });
    expect(alcohol).toHaveStyle({ textDecorationLine: 'none' });
  });

  it('navigates to the edit route when a row is tapped', async () => {
    mockList.mockResolvedValue([
      { id: 1, date: '2026-10-07', condition: 2, caffeine: 'none', exercise: 'morning', alcohol: 'moderate' },
    ]);
    await render(<HistoryScreen />);
    const row = await screen.findByText('2026-10-07');
    await fireEvent.press(row);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/record-edit/2026-10-07'));
  });
});
