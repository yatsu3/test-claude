import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';

export default function RecordEditScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    getRecordByDate(db, date)
      .then((r) => {
        if (!cancelled) {
          setRecord(r);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (!loaded || !date) {
    return null;
  }

  return (
    <ScrollView>
      {loadFailed ? (
        <Text style={{ color: '#c00', padding: 16 }}>記録の読み込みに失敗しました</Text>
      ) : null}
      <RecordForm date={date} initialRecord={record} onSaved={() => router.back()} />
    </ScrollView>
  );
}
