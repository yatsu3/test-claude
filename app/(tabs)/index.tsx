// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { formatDateISO } from '../../src/lib/date';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';

export default function TodayScreen() {
  const today = formatDateISO(new Date());
  const [initialRecord, setInitialRecord] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRecordByDate(db, today)
      .then((record) => {
        if (!cancelled) {
          setInitialRecord(record);
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
  }, [today]);

  if (!loaded) {
    return null;
  }

  return (
    <ScrollView>
      {loadFailed ? (
        <Text style={{ color: '#c00', padding: 16 }}>記録の読み込みに失敗しました</Text>
      ) : null}
      <RecordForm date={today} initialRecord={initialRecord} onSaved={setInitialRecord} />
    </ScrollView>
  );
}
