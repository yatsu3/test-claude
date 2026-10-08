import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { listRecordsDesc } from '../../src/db/recordRepository';
import type { DailyRecord } from '../../src/db/schema';
import { StatusView } from '../../src/ui/StatusView';
import { cardStyle, colors, conditionColors, font, radius, spacing } from '../../src/ui/theme';

const ACTIVITY_INDICATORS: { key: 'caffeine' | 'exercise' | 'alcohol'; label: string }[] = [
  { key: 'caffeine', label: 'カフェイン' },
  { key: 'exercise', label: '運動' },
  { key: 'alcohol', label: 'アルコール' },
];

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const weekdayOf = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
};

const formatSleep = (minutes: number | null | undefined) =>
  minutes == null ? null : `睡眠 ${Math.floor(minutes / 60)}時間${minutes % 60}分`;

export default function HistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<DailyRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoadFailed(false);
      listRecordsDesc(db)
        .then((rows) => {
          if (!cancelled) {
            setRecords(rows);
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
    return <StatusView tone="error" title="記録の読み込みに失敗しました" />;
  }

  if (records === null) {
    return null;
  }

  if (records.length === 0) {
    return (
      <StatusView
        title="まだ記録がありません"
        description="「記録」タブから今日のコンディションを記録しましょう"
      />
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item.date}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      renderItem={({ item }) => {
        const sleep = formatSleep(item.sleepMinutes);
        return (
          <Pressable
            onPress={() => router.push(`/record-edit/${item.date}`)}
            accessibilityRole="button"
            accessibilityHint="記録を編集します"
            style={({ pressed }) => ({
              ...cardStyle,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: conditionColors[item.condition] ?? colors.textMuted,
              }}
            >
              <Text style={{ color: colors.onPrimary, fontSize: 20, fontWeight: '700' }}>{item.condition}</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                <Text style={font.heading}>{item.date}</Text>
                <Text style={font.caption}>{`（${weekdayOf(item.date)}）`}</Text>
              </View>
              <Text style={font.caption}>
                {`コンディション: ${item.condition}/5`}
                {sleep ? `  ・  ${sleep}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 }}>
                {ACTIVITY_INDICATORS.map(({ key, label }) => {
                  const active = item[key] !== 'none';
                  return (
                    <Text
                      key={key}
                      accessibilityLabel={`${label}${active ? 'あり' : 'なし'}`}
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        overflow: 'hidden',
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        color: active ? colors.primary : colors.textMuted,
                        backgroundColor: active ? colors.primarySoft : 'transparent',
                        borderColor: active ? colors.primarySoft : colors.border,
                        textDecorationLine: active ? 'none' : 'line-through',
                      }}
                    >
                      {label}
                    </Text>
                  );
                })}
              </View>
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                width: 9,
                height: 9,
                borderTopWidth: 2,
                borderRightWidth: 2,
                borderColor: colors.textMuted,
                transform: [{ rotate: '45deg' }],
                marginRight: spacing.xs,
              }}
            />
          </Pressable>
        );
      }}
    />
  );
}
