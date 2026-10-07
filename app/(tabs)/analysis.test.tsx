import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import AnalysisScreen from './analysis';

const mockPoints = jest.fn();
const mockAverages = jest.fn();

jest.mock('../../src/db/client', () => ({ db: {} }));
jest.mock('../../src/db/recordRepository', () => ({
  getSleepConditionPoints: (...args: unknown[]) => mockPoints(...args),
  getConditionAverageBy: (...args: unknown[]) => mockAverages(...args),
}));
jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactActual.useEffect(cb, [cb]);
    },
  };
});
jest.mock('victory-native', () => {
  const { View } = require('react-native');
  return { CartesianChart: View, Scatter: View, Bar: View };
});

describe('AnalysisScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('shows an empty-state message when there are fewer than 5 records', async () => {
    mockPoints.mockResolvedValue([
      { sleepMinutes: 400, condition: 3 },
      { sleepMinutes: 420, condition: 4 },
    ]);
    mockAverages.mockResolvedValue({ withActivity: 3, without: 4 });

    await render(<AnalysisScreen />);

    await waitFor(() => {
      expect(screen.getByText('もう少しデータを集めましょう')).toBeTruthy();
    });
  });

  it('renders charts when there are 5 or more records', async () => {
    mockPoints.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ sleepMinutes: 400 + i * 10, condition: (i % 5) + 1 }))
    );
    mockAverages.mockResolvedValue({ withActivity: 3.2, without: 3.8 });

    await render(<AnalysisScreen />);

    await waitFor(() => {
      expect(screen.queryByText('もう少しデータを集めましょう')).toBeNull();
      expect(screen.getByText('睡眠時間とコンディション')).toBeTruthy();
      expect(screen.getByText('カフェイン')).toBeTruthy();
      expect(screen.getByText('運動')).toBeTruthy();
      expect(screen.getByText('アルコール')).toBeTruthy();
    });
  });

  it('shows an error message when loading fails', async () => {
    mockPoints.mockRejectedValue(new Error('boom'));
    mockAverages.mockResolvedValue({ withActivity: 3, without: 4 });

    await render(<AnalysisScreen />);

    await waitFor(() => expect(screen.getByText('記録の読み込みに失敗しました')).toBeTruthy());
  });
});
