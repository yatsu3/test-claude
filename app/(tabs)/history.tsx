import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { listRecordsDesc } from '../../src/db/recordRepository';
import type { DailyRecord } from '../../src/db/schema';

const ACTIVITY_INDICATORS: { key: 'caffeine' | 'exercise' | 'alcohol'; icon: string; label: string }[] = [
  { key: 'caffeine', icon: '☕', label: 'カフェイン' },
  { key: 'exercise', icon: '🏃', label: '運動' },
  { key: 'alcohol', icon: '🍺', label: 'アルコール' },
];

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
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#c00' }}>記録の読み込みに失敗しました</Text>
      </View>
    );
  }

  if (records === null) {
    return null;
  }

  if (records.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>まだ記録がありません</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={records}
      keyExtractor={(item) => item.date}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/record-edit/${item.date}`)}
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#eee',
          }}
        >
          <Text>{item.date}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <Text>{`コンディション: ${item.condition}/5`}</Text>
            {ACTIVITY_INDICATORS.map(({ key, icon, label }) => {
              const active = item[key] !== 'none';
              return (
                <Text
                  key={key}
                  accessibilityLabel={`${label}${active ? 'あり' : 'なし'}`}
                  style={{ opacity: active ? 1 : 0.2 }}
                >
                  {icon}
                </Text>
              );
            })}
          </View>
        </Pressable>
      )}
    />
  );
}
