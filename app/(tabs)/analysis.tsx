import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CartesianChart, Scatter, Bar } from 'victory-native';
import { db } from '../../src/db/client';
import { getSleepConditionPoints, getConditionAverageBy } from '../../src/db/recordRepository';

const MIN_RECORDS_FOR_ANALYSIS = 5;

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

  const comparisonData = (label: string, avg: ActivityAverages) => [
    { group: `${label}: あり`, value: avg.withActivity ?? 0 },
    { group: `${label}: なし`, value: avg.without ?? 0 },
  ];

  const comparisons: { label: string; avg: ActivityAverages }[] = [
    { label: 'カフェイン', avg: data.caffeine },
    { label: '運動', avg: data.exercise },
    { label: 'アルコール', avg: data.alcohol },
  ];

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 8 }}>睡眠時間とコンディション</Text>
      <View style={{ height: 240, marginBottom: 24 }}>
        <CartesianChart data={data.points} xKey="sleepMinutes" yKeys={['condition']}>
          {({ points: chartPoints }) => <Scatter points={chartPoints.condition} color="#333" radius={4} />}
        </CartesianChart>
      </View>

      {comparisons.map(({ label, avg }) => (
        <View key={label}>
          <Text style={{ fontSize: 18, marginBottom: 8 }}>{label}</Text>
          <View style={{ height: 200, marginBottom: 24 }}>
            <CartesianChart data={comparisonData(label, avg)} xKey="group" yKeys={['value']}>
              {({ points: chartPoints, chartBounds }) => (
                <Bar points={chartPoints.value} chartBounds={chartBounds} color="#333" />
              )}
            </CartesianChart>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
