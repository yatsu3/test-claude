// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { formatDateISO } from '../../src/lib/date';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';

const SAVED_MESSAGE_MS = 2000;

const formKeyFor = (date: string, record: DailyRecord | null) =>
  `${date}:${record?.updatedAt ?? 'new'}`;

export default function TodayScreen() {
  const [today, setToday] = useState(() => formatDateISO(new Date()));
  const [initialRecord, setInitialRecord] = useState<DailyRecord | null>(null);
  // RecordForm only reads its initial values on mount, so it is keyed by date + the
  // loaded record's updatedAt: a new day or an edit made elsewhere (History → edit)
  // remounts it with fresh values. Saves made by this form keep the key stable so the
  // form isn't reset under the user.
  const [formKey, setFormKey] = useState<string | null>(null);
  // Key of the data the form currently reflects (including this form's own saves).
  const knownKey = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const requestId = useRef(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recomputes "today" and reloads its record. Runs on focus, on app resume and on retry.
  const reload = useCallback(() => {
    const id = ++requestId.current;
    const date = formatDateISO(new Date());
    getRecordByDate(db, date)
      .then((record) => {
        if (id !== requestId.current) {
          return;
        }
        setToday(date);
        setInitialRecord(record);
        const next = formKeyFor(date, record);
        if (next !== knownKey.current) {
          knownKey.current = next;
          setFormKey(next);
        }
        setLoadFailed(false);
      })
      .catch(() => {
        if (id === requestId.current) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoaded(true);
        }
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        // Ignore results of a load that finishes after the tab lost focus.
        requestId.current++;
      };
    }, [reload])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reload();
      }
    });
    return () => subscription.remove();
  }, [reload]);

  useEffect(
    () => () => {
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
      }
    },
    []
  );

  const handleSaved = (record: DailyRecord) => {
    setInitialRecord(record);
    // The form already shows what was saved: record it as known without remounting,
    // so a later reload of this same record leaves the form alone.
    knownKey.current = formKeyFor(record.date, record);
    setShowSaved(true);
    if (savedTimer.current) {
      clearTimeout(savedTimer.current);
    }
    savedTimer.current = setTimeout(() => {
      savedTimer.current = null;
      setShowSaved(false);
    }, SAVED_MESSAGE_MS);
  };

  if (!loaded) {
    return null;
  }

  if (loadFailed) {
    return (
      <ScrollView>
        <Text style={{ color: '#c00', padding: 16 }}>記録の読み込みに失敗しました</Text>
        <Pressable accessibilityRole="button" onPress={reload} style={{ padding: 16 }}>
          <Text>再読み込み</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView>
      <Text style={{ fontSize: 18, fontWeight: 'bold', paddingHorizontal: 16, paddingTop: 16 }}>
        {`${today} の記録`}
      </Text>
      {showSaved ? (
        <Text style={{ color: '#080', paddingHorizontal: 16, paddingTop: 8 }}>保存しました</Text>
      ) : null}
      <RecordForm key={formKey ?? today} date={today} initialRecord={initialRecord} onSaved={handleSaved} />
    </ScrollView>
  );
}
