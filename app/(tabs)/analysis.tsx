import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CartesianChart, Scatter, Bar } from 'victory-native';
import { db } from '../../src/db/client';
import { getSleepConditionPoints, getConditionAverageBy } from '../../src/db/recordRepository';

const MIN_RECORDS_FOR_ANALYSIS = 5;

// Fixed y-domains so bar heights are comparable (bars grow from 0) and the scatter
// always spans the full 1–5 condition scale.
const BAR_Y_DOMAIN: [number, number] = [0, 5];
const SCATTER_Y_DOMAIN: [number, number] = [1, 5];
// Two fixed bar slots: x=0 → あり, x=1 → なし. Keeps each bar in its slot even if the other group has no data.
const BAR_X_DOMAIN: [number, number] = [-0.5, 1.5];

const formatAverage = (value: number | null) => (value == null ? 'データなし' : value.toFixed(1));

type ActivityAverages = { withActivity: number | null; without: number | null };
type Point = { sleepMinutes: number; condition: number };
type Loaded = {
  points: Point[];
  caffeine: ActivityAverages;
  exercise: ActivityAverages;
  alcohol: ActivityAverages;
};

export default function AnalysisScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoadFailed(false);
      Promise.all([
        getSleepConditionPoints(db),
        getConditionAverageBy(db, 'caffeine'),
        getConditionAverageBy(db, 'exercise'),
        getConditionAverageBy(db, 'alcohol'),
      ])
        .then(([points, caffeine, exercise, alcohol]) => {
          if (!cancelled) {
            setData({ points, caffeine, exercise, alcohol });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadFailed(true);
          }
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (loadFailed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#c00' }}>記録の読み込みに失敗しました</Text>
      </View>
    );
  }

  if (!data) {
    return null;
  }

  if (data.points.length < MIN_RECORDS_FOR_ANALYSIS) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text>もう少しデータを集めましょう</Text>
      </View>
    );
  }

  // Groups without data are left out rather than plotted as 0.
  const comparisonData = (avg: ActivityAverages) =>
    [
      { slot: 0, value: avg.withActivity },
      { slot: 1, value: avg.without },
    ].filter((d): d is { slot: number; value: number } => d.value != null);

  const comparisons: { label: string; avg: ActivityAverages }[] = [
    { label: 'カフェイン', avg: data.caffeine },
    { label: '運動', avg: data.exercise },
    { label: 'アルコール', avg: data.alcohol },
  ];

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 8 }}>睡眠時間とコンディション</Text>
      <View style={{ height: 240, marginBottom: 24 }}>
        <CartesianChart
          data={data.points}
          xKey="sleepMinutes"
          yKeys={['condition']}
          domain={{ y: SCATTER_Y_DOMAIN }}
          domainPadding={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {({ points: chartPoints }) => <Scatter points={chartPoints.condition} color="#333" radius={4} />}
        </CartesianChart>
      </View>
      <Text style={{ color: '#666', marginTop: -16, marginBottom: 24 }}>
        横軸: 睡眠時間（分） / 縦軸: コンディション（1〜5）
      </Text>

      {comparisons.map(({ label, avg }) => {
        const bars = comparisonData(avg);
        return (
          <View key={label} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, marginBottom: 8 }}>{label}</Text>
            {bars.length > 0 ? (
              <View style={{ height: 200 }} testID={`chart-${label}`}>
                <CartesianChart
                  data={bars}
                  xKey="slot"
                  yKeys={['value']}
                  domain={{ x: BAR_X_DOMAIN, y: BAR_Y_DOMAIN }}
                >
                  {({ points: chartPoints, chartBounds }) => (
                    <Bar points={chartPoints.value} chartBounds={chartBounds} barCount={2} color="#333" />
                  )}
                </CartesianChart>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <Text style={{ flex: 1, textAlign: 'center' }}>{`あり: ${formatAverage(avg.withActivity)}`}</Text>
              <Text style={{ flex: 1, textAlign: 'center' }}>{`なし: ${formatAverage(avg.without)}`}</Text>
            </View>
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 2 }}>コンディション平均（0〜5）</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
