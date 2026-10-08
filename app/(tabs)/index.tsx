// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { formatDateISO } from '../../src/lib/date';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';
import { StatusView } from '../../src/ui/StatusView';
import { colors, font, radius, spacing } from '../../src/ui/theme';

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
    // Drop any reload still in flight: it read the record before this save, and applying
    // it would remount the form with pre-save values.
    requestId.current++;
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
    return <StatusView tone="error" title="記録の読み込みに失敗しました" actionLabel="再読み込み" onAction={reload} />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Text style={font.caption}>今日のコンディションを記録しましょう</Text>
        <Text accessibilityRole="header" style={{ ...font.title, marginTop: spacing.xs }}>
          {`${today} の記録`}
        </Text>
        {showSaved ? (
          <View
            accessibilityLiveRegion="polite"
            style={{
              alignSelf: 'flex-start',
              marginTop: spacing.sm,
              backgroundColor: colors.successSoft,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}
          >
            <Text style={{ color: colors.success, fontWeight: '600' }}>保存しました</Text>
          </View>
        ) : null}
      </View>
      <RecordForm key={formKey ?? today} date={today} initialRecord={initialRecord} onSaved={handleSaved} />
    </ScrollView>
  );
}
