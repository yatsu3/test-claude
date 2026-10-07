// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { formatDateISO } from '../../src/lib/date';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';

export default function TodayScreen() {
  const today = formatDateISO(new Date());
  const [initialRecord, setInitialRecord] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getRecordByDate(db, today).then((record) => {
      setInitialRecord(record);
      setLoaded(true);
    });
  }, [today]);

  if (!loaded) {
    return null;
  }

  return (
    <ScrollView>
      <RecordForm date={today} initialRecord={initialRecord} onSaved={setInitialRecord} />
    </ScrollView>
  );
}
