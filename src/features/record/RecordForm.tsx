// src/features/record/RecordForm.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { db } from '../../db/client';
import { upsertDailyRecord, type UpsertDailyRecordInput } from '../../db/recordRepository';
import { getLastNightSleepMinutes } from '../../healthkit/sleep';
import { SegmentedSelector } from './SegmentedSelector';
import { Button } from '../../ui/Button';
import { cardStyle, colors, conditionColors, font, radius, spacing, TOUCH_MIN } from '../../ui/theme';
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

  const sleepHoursHint =
    trimmedSleep !== '' && !sleepInvalid
      ? `${Math.floor(Number(trimmedSleep) / 60)}時間${Number(trimmedSleep) % 60}分`
      : null;

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <Section title="睡眠">
        <Text style={{ ...font.label, marginBottom: spacing.sm }}>睡眠時間（分）</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TextInput
            placeholder="例: 420"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            accessibilityLabel="睡眠時間（分）"
            value={sleepMinutesText}
            onChangeText={(text) => {
              userEditedSleep.current = true;
              setSleepMinutesText(text);
              setSleepSource('manual');
            }}
            style={{
              ...inputStyle,
              flex: 1,
              borderColor: sleepInvalid ? colors.error : colors.border,
            }}
          />
          <Text style={{ ...font.body, color: colors.textMuted }}>分</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
          {sleepHoursHint ? <Text style={font.caption}>{`= ${sleepHoursHint}`}</Text> : null}
          {sleepSource === 'healthkit' && trimmedSleep !== '' ? (
            <View
              style={{
                backgroundColor: colors.primarySoft,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>ヘルスケアから取得</Text>
            </View>
          ) : null}
        </View>
        {sleepInvalid ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, marginTop: spacing.sm }}>
            睡眠時間は0以上の整数で入力してください
          </Text>
        ) : null}
      </Section>

      <Section title="コンディション">
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = condition === n;
            return (
              <Pressable
                key={n}
                onPress={() => setCondition(n)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`コンディション ${n}`}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 52,
                  borderRadius: radius.md,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: selected ? 0 : 1,
                  borderColor: colors.border,
                  backgroundColor: selected
                    ? conditionColors[n]
                    : pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                })}
              >
                <Text style={{ fontSize: 20, fontWeight: '700', color: selected ? colors.onPrimary : colors.text }}>
                  {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
          <Text style={font.caption}>不調</Text>
          <Text style={font.caption}>絶好調</Text>
        </View>

        <Text style={{ ...font.label, marginTop: spacing.lg, marginBottom: spacing.sm }}>メモ</Text>
        <TextInput
          value={conditionNote}
          onChangeText={setConditionNote}
          multiline
          accessibilityLabel="メモ"
          placeholder="気になったことなど（任意）"
          placeholderTextColor={colors.textMuted}
          style={{ ...inputStyle, minHeight: 88, textAlignVertical: 'top' }}
        />
      </Section>

      <Section title="生活習慣">
        <SegmentedSelector label="カフェイン" options={ACTIVITY_OPTIONS} value={caffeine} onChange={setCaffeine} />
        <SegmentedSelector label="運動" options={ACTIVITY_OPTIONS} value={exercise} onChange={setExercise} />
        <SegmentedSelector label="アルコール" options={ALCOHOL_OPTIONS} value={alcohol} onChange={setAlcohol} />
      </Section>

      {errorMessage ? (
        <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: 'center' }}>
          {errorMessage}
        </Text>
      ) : null}

      <Button title="保存" onPress={handleSave} disabled={!canSave} loading={saving} />
      {condition == null ? (
        <Text style={{ ...font.caption, textAlign: 'center', marginTop: -spacing.sm }}>
          コンディションを選ぶと保存できます
        </Text>
      ) : null}
    </View>
  );
}

const inputStyle = {
  ...font.body,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  minHeight: TOUCH_MIN + 4,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={cardStyle}>
      <Text accessibilityRole="header" style={{ ...font.heading, marginBottom: spacing.md }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
