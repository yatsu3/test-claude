import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import AnalysisScreen from '../../../app/(tabs)/analysis';

const mockPoints = jest.fn();
const mockAverages = jest.fn();
const mockChartProps: any[] = [];

jest.mock('../../../src/db/client', () => ({ db: {} }));
jest.mock('../../../src/db/recordRepository', () => ({
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
  return {
    CartesianChart: (props: any) => {
      mockChartProps.push(props);
      return <View />;
    },
    Scatter: View,
    Bar: View,
  };
});

const fivePoints = () =>
  Array.from({ length: 5 }, (_, i) => ({ sleepMinutes: 400 + i * 10, condition: (i % 5) + 1 }));
const lastChartProps = () => {
  // Charts render in order: scatter, caffeine, exercise, alcohol (latest render wins).
  const scatter = [...mockChartProps].reverse().find((p) => p.xKey === 'sleepMinutes');
  const bars = mockChartProps.filter((p) => p.xKey === 'slot');
  return { scatter, bars };
};

describe('AnalysisScreen', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockChartProps.length = 0;
  });

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

  it('uses a fixed 0–5 y-domain for bars and 1–5 for the scatter, and labels bar values', async () => {
    mockPoints.mockResolvedValue(fivePoints());
    mockAverages.mockResolvedValue({ withActivity: 3.2, without: 3.8 });

    await render(<AnalysisScreen />);
    await waitFor(() => expect(screen.getAllByText('あり: 3.2')).toHaveLength(3));
    expect(screen.getAllByText('なし: 3.8')).toHaveLength(3);

    const { scatter, bars } = lastChartProps();
    expect(scatter.domain).toEqual({ y: [1, 5] });
    expect(bars.length).toBeGreaterThanOrEqual(3);
    for (const bar of bars) {
      expect(bar.domain.y).toEqual([0, 5]);
      expect(bar.data).toEqual([
        { slot: 0, value: 3.2 },
        { slot: 1, value: 3.8 },
      ]);
    }
  });

  it('shows データなし for a null group instead of plotting it as 0', async () => {
    mockPoints.mockResolvedValue(fivePoints());
    mockAverages.mockImplementation((_db: unknown, column: string) =>
      Promise.resolve(
        column === 'alcohol'
          ? { withActivity: null, without: null }
          : { withActivity: null, without: 4 }
      )
    );

    await render(<AnalysisScreen />);
    await waitFor(() => expect(screen.getAllByText('あり: データなし')).toHaveLength(3));
    expect(screen.getAllByText('なし: 4.0')).toHaveLength(2);
    expect(screen.getByText('なし: データなし')).toBeTruthy();

    const { bars } = lastChartProps();
    for (const bar of bars) {
      // Only the group with data is plotted; nothing becomes a 0-height bar.
      expect(bar.data).toEqual([{ slot: 1, value: 4 }]);
      expect(bar.data.some((d: { value: number }) => d.value === 0)).toBe(false);
    }
    // Both groups empty → no chart at all for alcohol.
    expect(screen.queryByTestId('chart-アルコール')).toBeNull();
    expect(screen.getByTestId('chart-カフェイン')).toBeTruthy();
  });
});
