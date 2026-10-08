import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { dailyRecords, type DailyRecord, type NewDailyRecord } from './schema';

// Structural DB type satisfied by both the expo-sqlite drizzle instance (app)
// and the better-sqlite3 drizzle instance (tests). Both are synchronous drivers.
export type RecordDb = BaseSQLiteDatabase<'sync', unknown>;

export type UpsertDailyRecordInput = Omit<NewDailyRecord, 'id' | 'createdAt' | 'updatedAt'>;

export async function upsertDailyRecord(db: RecordDb, input: UpsertDailyRecordInput): Promise<DailyRecord> {
  const now = new Date().toISOString();
  const existing = await getRecordByDate(db, input.date);

  if (existing) {
    const [updated] = await db
      .update(dailyRecords)
      .set({ ...input, updatedAt: now })
      .where(eq(dailyRecords.date, input.date))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(dailyRecords)
    .values({ ...input, createdAt: now, updatedAt: now })
    .returning();
  return created;
}

export async function getRecordByDate(db: RecordDb, date: string): Promise<DailyRecord | null> {
  const rows = await db.select().from(dailyRecords).where(eq(dailyRecords.date, date));
  return rows[0] ?? null;
}

export async function listRecordsDesc(db: RecordDb): Promise<DailyRecord[]> {
  return db.select().from(dailyRecords).orderBy(desc(dailyRecords.date));
}

export async function getConditionAverageBy(
  db: RecordDb,
  column: 'caffeine' | 'exercise' | 'alcohol'
): Promise<{ withActivity: number | null; without: number | null }> {
  const field = dailyRecords[column];

  const withRows = await db
    .select()
    .from(dailyRecords)
    .where(ne(field, 'none'));
  const withoutRows = await db
    .select()
    .from(dailyRecords)
    .where(eq(field, 'none'));

  const average = (rows: DailyRecord[]) =>
    rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.condition, 0) / rows.length;

  return { withActivity: average(withRows), without: average(withoutRows) };
}

export async function getSleepConditionPoints(
  db: RecordDb
): Promise<{ sleepMinutes: number; condition: number }[]> {
  const rows = await db
    .select()
    .from(dailyRecords)
    .where(and(isNotNull(dailyRecords.sleepMinutes)));

  return rows.map((r) => ({ sleepMinutes: r.sleepMinutes as number, condition: r.condition }));
}
