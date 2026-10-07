import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { listRecordsDesc } from '../../src/db/recordRepository';
import type { DailyRecord } from '../../src/db/schema';

export default function HistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<DailyRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
  }, []);

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
          style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}
        >
          <Text>{item.date}</Text>
          <Text>コンディション: {item.condition}</Text>
        </Pressable>
      )}
    />
  );
}
