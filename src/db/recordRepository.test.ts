import { createTestDb } from './testDb';
import {
  upsertDailyRecord,
  getRecordByDate,
  listRecordsDesc,
  getConditionAverageBy,
  getSleepConditionPoints,
} from './recordRepository';

describe('upsertDailyRecord', () => {
  it('creates a new record when none exists for the date', async () => {
    const db = createTestDb();
    const result = await upsertDailyRecord(db, {
      date: '2026-10-08',
      sleepMinutes: 400,
      sleepSource: 'manual',
      condition: 3,
      conditionNote: null,
      caffeine: 'none',
      exercise: 'morning',
      alcohol: 'none',
    });
    expect(result.id).toBeDefined();
    expect(result.date).toBe('2026-10-08');
  });

  it('updates the existing record instead of creating a duplicate when saved twice for the same date', async () => {
    const db = createTestDb();
    const first = await upsertDailyRecord(db, {
      date: '2026-10-08',
      sleepMinutes: 400,
      sleepSource: 'manual',
      condition: 3,
      conditionNote: null,
      caffeine: 'none',
      exercise: 'none',
      alcohol: 'none',
    });
    const second = await upsertDailyRecord(db, {
      date: '2026-10-08',
      sleepMinutes: 450,
      sleepSource: 'healthkit',
      condition: 5,
      conditionNote: '更新後',
      caffeine: 'morning',
      exercise: 'none',
      alcohol: 'none',
    });

    expect(second.id).toBe(first.id);
    expect(second.condition).toBe(5);
    expect(second.sleepMinutes).toBe(450);

    const all = await listRecordsDesc(db);
    expect(all).toHaveLength(1);
  });
});

describe('getRecordByDate', () => {
  it('returns null when no record exists for the date', async () => {
    const db = createTestDb();
    const result = await getRecordByDate(db, '2026-10-08');
    expect(result).toBeNull();
  });

  it('returns the record when one exists', async () => {
    const db = createTestDb();
    await upsertDailyRecord(db, {
      date: '2026-10-08',
      sleepMinutes: 400,
      sleepSource: 'manual',
      condition: 3,
      conditionNote: null,
      caffeine: 'none',
      exercise: 'none',
      alcohol: 'none',
    });
    const result = await getRecordByDate(db, '2026-10-08');
    expect(result?.date).toBe('2026-10-08');
  });
});

describe('listRecordsDesc', () => {
  it('returns records ordered by date descending', async () => {
    const db = createTestDb();
    for (const date of ['2026-10-06', '2026-10-08', '2026-10-07']) {
      await upsertDailyRecord(db, {
        date,
        sleepMinutes: 400,
        sleepSource: 'manual',
        condition: 3,
        conditionNote: null,
        caffeine: 'none',
        exercise: 'none',
        alcohol: 'none',
      });
    }
    const all = await listRecordsDesc(db);
    expect(all.map((r) => r.date)).toEqual(['2026-10-08', '2026-10-07', '2026-10-06']);
  });
});

describe('getConditionAverageBy', () => {
  it('computes separate averages for the activity and no-activity groups', async () => {
    const db = createTestDb();
    await upsertDailyRecord(db, { date: '2026-10-01', sleepMinutes: 400, sleepSource: 'manual', condition: 4, conditionNote: null, caffeine: 'morning', exercise: 'none', alcohol: 'none' });
    await upsertDailyRecord(db, { date: '2026-10-02', sleepMinutes: 400, sleepSource: 'manual', condition: 2, conditionNote: null, caffeine: 'morning', exercise: 'none', alcohol: 'none' });
    await upsertDailyRecord(db, { date: '2026-10-03', sleepMinutes: 400, sleepSource: 'manual', condition: 5, conditionNote: null, caffeine: 'none', exercise: 'none', alcohol: 'none' });

    const result = await getConditionAverageBy(db, 'caffeine');
    expect(result.withActivity).toBe(3); // (4 + 2) / 2
    expect(result.without).toBe(5);
  });

  it('returns null for a group with no records', async () => {
    const db = createTestDb();
    await upsertDailyRecord(db, { date: '2026-10-01', sleepMinutes: 400, sleepSource: 'manual', condition: 4, conditionNote: null, caffeine: 'none', exercise: 'none', alcohol: 'none' });

    const result = await getConditionAverageBy(db, 'caffeine');
    expect(result.withActivity).toBeNull();
    expect(result.without).toBe(4);
  });
});

describe('getSleepConditionPoints', () => {
  it('returns one point per record with non-null sleep minutes', async () => {
    const db = createTestDb();
    await upsertDailyRecord(db, { date: '2026-10-01', sleepMinutes: 400, sleepSource: 'manual', condition: 4, conditionNote: null, caffeine: 'none', exercise: 'none', alcohol: 'none' });
    await upsertDailyRecord(db, { date: '2026-10-02', sleepMinutes: null, sleepSource: null, condition: 2, conditionNote: null, caffeine: 'none', exercise: 'none', alcohol: 'none' });

    const points = await getSleepConditionPoints(db);
    expect(points).toEqual([{ sleepMinutes: 400, condition: 4 }]);
  });
});
