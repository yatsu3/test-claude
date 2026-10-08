import { createTestDb } from './testDb';
import { dailyRecords } from './schema';

describe('dailyRecords schema', () => {
  it('inserts and reads back a row with all fields', async () => {
    const db = createTestDb();
    await db.insert(dailyRecords).values({
      date: '2026-10-08',
      sleepMinutes: 420,
      sleepSource: 'manual',
      condition: 4,
      conditionNote: '調子良い',
      caffeine: 'morning',
      exercise: 'none',
      alcohol: 'none',
      createdAt: '2026-10-08T21:00:00.000Z',
      updatedAt: '2026-10-08T21:00:00.000Z',
    });

    const rows = await db.select().from(dailyRecords);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: '2026-10-08',
      sleepMinutes: 420,
      condition: 4,
      caffeine: 'morning',
    });
  });

  it('rejects a second row with the same date', async () => {
    const db = createTestDb();
    const row = {
      date: '2026-10-08',
      sleepMinutes: null,
      sleepSource: null,
      condition: 3,
      conditionNote: null,
      caffeine: 'none' as const,
      exercise: 'none' as const,
      alcohol: 'none' as const,
      createdAt: '2026-10-08T21:00:00.000Z',
      updatedAt: '2026-10-08T21:00:00.000Z',
    };
    await db.insert(dailyRecords).values(row);
    await expect(db.insert(dailyRecords).values(row)).rejects.toThrow();
  });
});
