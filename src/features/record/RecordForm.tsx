// src/features/record/RecordForm.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { db } from '../../db/client';
import { upsertDailyRecord, type UpsertDailyRecordInput } from '../../db/recordRepository';
import { getLastNightSleepMinutes } from '../../healthkit/sleep';
import { SegmentedSelector } from './SegmentedSelector';
import type { DailyRecord } from '../../db/schema';

type ActivityOption = 'morning' | 'afternoon' | 'evening' | 'none';
type AlcoholOption = 'moderate' | 'heavy' | 'none';

const ACTIVITY_OPTIONS: { value: ActivityOption; label: string }[] = [
  { value: 'morning', label: '朝' },
  { value: 'afternoon', label: '昼' },
  { value: 'evening', label: '夕' },
  { value: 'none', label: 'なし' },
];

const ALCOHOL_OPTIONS: { value: AlcoholOption; label: string }[] = [
  { value: 'moderate', label: '適量' },
  { value: 'heavy', label: '多量' },
  { value: 'none', label: 'なし' },
];

export function RecordForm({
  date,
  initialRecord,
  onSaved,
}: {
  date: string;
  initialRecord: DailyRecord | null;
  onSaved: (record: DailyRecord) => void;
}) {
  const [sleepMinutesText, setSleepMinutesText] = useState(
    initialRecord?.sleepMinutes != null ? String(initialRecord.sleepMinutes) : ''
  );
  const [sleepSource, setSleepSource] = useState<'healthkit' | 'manual' | null>(
    initialRecord?.sleepSource ?? null
  );
  const [condition, setCondition] = useState<number | null>(initialRecord?.condition ?? null);
  const [conditionNote, setConditionNote] = useState(initialRecord?.conditionNote ?? '');
  const [caffeine, setCaffeine] = useState<ActivityOption>(
    initialRecord?.caffeine ?? 'none'
  );
  const [exercise, setExercise] = useState<ActivityOption>(
    initialRecord?.exercise ?? 'none'
  );
  const [alcohol, setAlcohol] = useState<AlcoholOption>(
    initialRecord?.alcohol ?? 'none'
  );
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userEditedSleep = useRef(false);

  useEffect(() => {
    if (initialRecord?.sleepMinutes != null) {
      return; // editing an existing record — don't overwrite with a fresh HealthKit lookup
    }
    let cancelled = false;
    const [year, month, day] = date.split('-').map(Number);
    getLastNightSleepMinutes(new Date(year, month - 1, day))
      .catch(() => null)
      .then((minutes) => {
        if (cancelled || userEditedSleep.current || minutes == null) {
          return;
        }
        setSleepMinutesText(String(minutes));
        setSleepSource('healthkit');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedSleep = sleepMinutesText.trim();
  const sleepInvalid = trimmedSleep !== '' && !/^\d+$/.test(trimmedSleep);
  const canSave = condition != null && !saving && !sleepInvalid;

  const handleSave = async () => {
    if (condition == null || sleepInvalid || saving) {
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      const input: UpsertDailyRecordInput = {
        date,
        sleepMinutes: trimmedSleep === '' ? null : Number(trimmedSleep),
        sleepSource: trimmedSleep === '' ? null : (sleepSource ?? 'manual'),
        condition,
        conditionNote: conditionNote.trim() === '' ? null : conditionNote,
        caffeine,
        exercise,
        alcohol,
      };
      const saved = await upsertDailyRecord(db, input);
      onSaved(saved);
    } catch {
      setErrorMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ marginBottom: 4 }}>睡眠時間（分）</Text>
      <TextInput
        placeholder="例: 420"
        keyboardType="number-pad"
        value={sleepMinutesText}
        onChangeText={(text) => {
          userEditedSleep.current = true;
          setSleepMinutesText(text);
          setSleepSource('manual');
        }}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 16 }}
      />

      {sleepInvalid ? (
        <Text style={{ color: '#c00', marginBottom: 8 }}>睡眠時間は0以上の整数で入力してください</Text>
      ) : null}

      <Text style={{ marginBottom: 4 }}>コンディション</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setCondition(n)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: condition === n ? '#333' : '#eee',
            }}
          >
            <Text style={{ color: condition === n ? '#fff' : '#333' }}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ marginBottom: 4 }}>メモ</Text>
      <TextInput
        value={conditionNote}
        onChangeText={setConditionNote}
        multiline
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 16, minHeight: 60 }}
      />

      <SegmentedSelector label="カフェイン" options={ACTIVITY_OPTIONS} value={caffeine} onChange={setCaffeine} />
      <SegmentedSelector label="運動" options={ACTIVITY_OPTIONS} value={exercise} onChange={setExercise} />
      <SegmentedSelector label="アルコール" options={ALCOHOL_OPTIONS} value={alcohol} onChange={setAlcohol} />

      {errorMessage ? <Text style={{ color: '#c00', marginBottom: 8 }}>{errorMessage}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        style={{
          backgroundColor: canSave ? '#333' : '#aaa',
          borderRadius: 8,
          padding: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>保存</Text>
      </Pressable>
    </View>
  );
}
