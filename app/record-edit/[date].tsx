import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';
import { StatusView } from '../../src/ui/StatusView';
import { colors, spacing } from '../../src/ui/theme';

export default function RecordEditScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoaded(false);
    setLoadFailed(false);
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
  }, [date, attempt]);

  // Header title shows which date is being edited.
  const header = date ? <Stack.Screen options={{ title: `${date} の記録` }} /> : null;

  if (!loaded || !date) {
    return header;
  }

  if (loadFailed) {
    return (
      <>
        {header}
        <StatusView
          tone="error"
          title="記録の読み込みに失敗しました"
          actionLabel="再読み込み"
          onAction={() => setAttempt((n) => n + 1)}
        />
      </>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {header}
      <RecordForm date={date} initialRecord={record} onSaved={() => router.back()} />
    </ScrollView>
  );
}
