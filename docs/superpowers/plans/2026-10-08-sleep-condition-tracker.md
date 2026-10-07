# 睡眠・コンディション記録アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Expo (Development Build) React Native iOS app that records daily sleep/condition/lifestyle data, stores it locally in SQLite, and visualizes correlations between sleep and condition.

**Architecture:** Expo Router app with a 3-tab shell (Today / History / Analysis). A `drizzle-orm` + `expo-sqlite` persistence layer sits behind a single repository module that both the UI and the analysis queries consume. HealthKit and local notifications are isolated behind thin wrapper modules so the rest of the app never talks to native APIs directly.

**Tech Stack:** Expo + TypeScript, `expo-router`, `expo-sqlite` + `drizzle-orm`, `@kingstinct/react-native-healthkit`, `victory-native` (+ `@shopify/react-native-skia`), `expo-notifications`, `@react-native-async-storage/async-storage`. Testing: `jest-expo`, `@testing-library/react-native`, `better-sqlite3` (dev-only, for in-memory DB unit tests against the driver-agnostic schema).

**Spec:** `docs/superpowers/specs/2026-10-08-sleep-condition-tracker-design.md`

## Global Constraints

- iOS 17 or later, iPhone only — no iPad-specific layout work.
- Must run as an Expo Development Build (EAS Build); Expo Go is not supported because of the HealthKit native module.
- All user-facing text is Japanese only.
- Data is stored locally on-device only — no cloud sync, no network calls.
- One record per calendar date (`daily_records.date` is unique); saving on a date that already has a record must update it, not create a duplicate.
- TypeScript throughout; no `any` in production code (test mocks may use `any` where a library's type is awkward to mock).

## Review Focus

- **Double-save on the same day:** saving twice for the same date must update the existing row, not create a second one with a different `id` — covered in Task 3's upsert tests.
- **HealthKit denial/failure:** when permission is denied or the query throws, the Today screen must still let the user finish the record via manual sleep input — covered in Task 4 (wrapper returns `null` on any failure) and Task 7 (screen falls back to manual input when the wrapper resolves `null`).
- **Required-field validation on save:** condition (1–5) must be selected before saving; caffeine/exercise/alcohol default to `'none'` but must not be left in an indeterminate state — covered in Task 7's form validation tests.
- **Sparse-data analysis view:** fewer than 5 records must show the "collect more data" empty state instead of a chart with too few points to be meaningful — covered in Task 9.
- **Notification permission denial:** if the user denies notification permission, the app must not crash and must show that reminders are off, while record-saving keeps working — covered in Task 5 (wrapper returns `false`/no-op on denial) and Task 10 (settings screen surfaces the denied state).

---

## Task 1: Project scaffolding + date utilities

**Files:**
- Create: Expo project files at repo root (`app.json`, `package.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`, `app/_layout.tsx` placeholder, `app/(tabs)/index.tsx` placeholder)
- Create: `src/lib/date.ts`
- Test: `src/lib/date.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `formatDateISO(d: Date): string` — returns local-time `YYYY-MM-DD`
  - `getPreviousDay(d: Date): Date` — returns a new `Date` 24h before `d`

- [ ] **Step 1: Scaffold the Expo project**

```bash
npx create-expo-app@latest . --template blank-typescript
```

This writes into the existing repo directory (the only existing files are `docs/` and `.git/`, so there is no conflict).

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npx expo install expo-router expo-sqlite expo-notifications expo-dev-client @react-native-async-storage/async-storage react-native-safe-area-context react-native-screens
npm install drizzle-orm @kingstinct/react-native-healthkit victory-native @shopify/react-native-skia
npm install -D drizzle-kit jest-expo @testing-library/react-native better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 3: Configure Expo Router and the dev-client/HealthKit plugin**

Edit `app.json`: set `"main": "expo-router/entry"`, add to `"plugins"`:

```json
["@kingstinct/react-native-healthkit", { "NSHealthShareUsageDescription": "睡眠時間の記録のために使用します" }]
```

and set `"ios": { "bundleIdentifier": "com.yatsuco.sleepconditiontracker", "supportsTablet": false }`.

- [ ] **Step 4: Configure Jest**

Create/edit `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
```

Add to `package.json` scripts: `"test": "jest"`.

- [ ] **Step 5: Write the failing test for date utilities**

```ts
// src/lib/date.test.ts
import { formatDateISO, getPreviousDay } from './date';

describe('formatDateISO', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    const d = new Date(2026, 9, 8, 23, 30); // 2026-10-08 local time
    expect(formatDateISO(d)).toBe('2026-10-08');
  });

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5);
    expect(formatDateISO(d)).toBe('2026-01-05');
  });
});

describe('getPreviousDay', () => {
  it('returns the calendar day before the given date', () => {
    const d = new Date(2026, 9, 8, 9, 0);
    const prev = getPreviousDay(d);
    expect(formatDateISO(prev)).toBe('2026-10-07');
  });

  it('rolls over a month boundary', () => {
    const d = new Date(2026, 9, 1, 0, 0);
    const prev = getPreviousDay(d);
    expect(formatDateISO(prev)).toBe('2026-09-30');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx jest src/lib/date.test.ts`
Expected: FAIL with "Cannot find module './date'"

- [ ] **Step 7: Implement the date utilities**

```ts
// src/lib/date.ts
export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousDay(d: Date): Date {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  return prev;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx jest src/lib/date.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Verify the TypeScript project compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo app and add date utilities"
```

---

## Task 2: Database schema, client, and migrations

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`
- Create: `src/db/migrations/` (generated by drizzle-kit)
- Create: `drizzle.config.ts`
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `dailyRecords` (drizzle table object, from `src/db/schema.ts`)
  - `type DailyRecord = typeof dailyRecords.$inferSelect`
  - `type NewDailyRecord = typeof dailyRecords.$inferInsert`
  - `db` (drizzle `ExpoSQLiteDatabase` instance, from `src/db/client.ts`, for use by the real app)
  - `migrations` (from `src/db/migrations/migrations.js`, for use by the migration hook in Task 6)

- [ ] **Step 1: Write the schema**

```ts
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const dailyRecords = sqliteTable('daily_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  sleepMinutes: integer('sleep_minutes'),
  sleepSource: text('sleep_source', { enum: ['healthkit', 'manual'] }),
  condition: integer('condition').notNull(),
  conditionNote: text('condition_note'),
  caffeine: text('caffeine', { enum: ['morning', 'afternoon', 'evening', 'none'] }).notNull(),
  exercise: text('exercise', { enum: ['morning', 'afternoon', 'evening', 'none'] }).notNull(),
  alcohol: text('alcohol', { enum: ['moderate', 'heavy', 'none'] }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type DailyRecord = typeof dailyRecords.$inferSelect;
export type NewDailyRecord = typeof dailyRecords.$inferInsert;
```

- [ ] **Step 2: Configure drizzle-kit and generate the migration**

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

Run:

```bash
npx drizzle-kit generate
```

This creates `src/db/migrations/0000_*.sql` and `src/db/migrations/migrations.js` (the journal drizzle's Expo migrator reads).

- [ ] **Step 3: Write the client for the real app**

```ts
// src/db/client.ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const expoDb = openDatabaseSync('sleep-condition-tracker.db');
export const db = drizzle(expoDb);
export type AppDatabase = typeof db;
```

- [ ] **Step 4: Write the failing test that proves the schema works against a real SQLite engine**

Tests use `better-sqlite3` in-memory so they run under plain Jest/Node without the Expo native runtime. The schema module itself (`drizzle-orm/sqlite-core`) is driver-agnostic, so the same `dailyRecords` table works with either driver.

```ts
// src/db/schema.test.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { dailyRecords } from './schema';

function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      sleep_minutes INTEGER,
      sleep_source TEXT,
      condition INTEGER NOT NULL,
      condition_note TEXT,
      caffeine TEXT NOT NULL,
      exercise TEXT NOT NULL,
      alcohol TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return drizzle(sqlite);
}

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
```

Export the `createTestDb` helper's shape by moving it to a shared test helper so Task 3 can reuse it:

```ts
// src/db/testDb.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE daily_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      sleep_minutes INTEGER,
      sleep_source TEXT,
      condition INTEGER NOT NULL,
      condition_note TEXT,
      caffeine TEXT NOT NULL,
      exercise TEXT NOT NULL,
      alcohol TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return drizzle(sqlite);
}
```

Update `src/db/schema.test.ts` to `import { createTestDb } from './testDb';` instead of defining it inline.

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx jest src/db/schema.test.ts`
Expected: FAIL (module `./schema` not found, or table/module missing) before Step 1/2 code exists — if run after Steps 1–3 are already written, skip to confirming PASS in Step 6 instead.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/db/schema.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add daily_records schema, client, and migrations"
```

---

## Task 3: Record repository (upsert, lookup, list, aggregates)

**Files:**
- Create: `src/db/recordRepository.ts`
- Test: `src/db/recordRepository.test.ts`

**Interfaces:**
- Consumes: `dailyRecords`, `DailyRecord`, `NewDailyRecord` (Task 2, `src/db/schema.ts`); `createTestDb` (Task 2, `src/db/testDb.ts`)
- Produces:
  - `type UpsertDailyRecordInput = Omit<NewDailyRecord, 'id' | 'createdAt' | 'updatedAt'>`
  - `upsertDailyRecord(db: AppDatabase, input: UpsertDailyRecordInput): Promise<DailyRecord>`
  - `getRecordByDate(db: AppDatabase, date: string): Promise<DailyRecord | null>`
  - `listRecordsDesc(db: AppDatabase): Promise<DailyRecord[]>`
  - `getConditionAverageBy(db: AppDatabase, column: 'caffeine' | 'exercise' | 'alcohol'): Promise<{ withActivity: number | null; without: number | null }>`
  - `getSleepConditionPoints(db: AppDatabase): Promise<{ sleepMinutes: number; condition: number }[]>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/db/recordRepository.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/db/recordRepository.test.ts`
Expected: FAIL with "Cannot find module './recordRepository'"

- [ ] **Step 3: Implement the repository**

```ts
// src/db/recordRepository.ts
import { and, desc, eq, isNotNull, ne } from 'drizzle-orm';
import { dailyRecords, type DailyRecord, type NewDailyRecord } from './schema';

type AppDatabase = {
  select: typeof dailyRecords extends never ? never : any;
  insert: any;
  update: any;
};

export type UpsertDailyRecordInput = Omit<NewDailyRecord, 'id' | 'createdAt' | 'updatedAt'>;

export async function upsertDailyRecord(db: any, input: UpsertDailyRecordInput): Promise<DailyRecord> {
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

export async function getRecordByDate(db: any, date: string): Promise<DailyRecord | null> {
  const rows = await db.select().from(dailyRecords).where(eq(dailyRecords.date, date));
  return rows[0] ?? null;
}

export async function listRecordsDesc(db: any): Promise<DailyRecord[]> {
  return db.select().from(dailyRecords).orderBy(desc(dailyRecords.date));
}

export async function getConditionAverageBy(
  db: any,
  column: 'caffeine' | 'exercise' | 'alcohol'
): Promise<{ withActivity: number | null; without: number | null }> {
  const field = dailyRecords[column];

  const withRows: DailyRecord[] = await db
    .select()
    .from(dailyRecords)
    .where(ne(field, 'none'));
  const withoutRows: DailyRecord[] = await db
    .select()
    .from(dailyRecords)
    .where(eq(field, 'none'));

  const average = (rows: DailyRecord[]) =>
    rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.condition, 0) / rows.length;

  return { withActivity: average(withRows), without: average(withoutRows) };
}

export async function getSleepConditionPoints(
  db: any
): Promise<{ sleepMinutes: number; condition: number }[]> {
  const rows = await db
    .select()
    .from(dailyRecords)
    .where(and(isNotNull(dailyRecords.sleepMinutes)));

  return rows.map((r: DailyRecord) => ({ sleepMinutes: r.sleepMinutes as number, condition: r.condition }));
}
```

Note: the repository takes `db: any` rather than a precise shared type because the real app uses `ExpoSQLiteDatabase` (Task 2) while tests use `BetterSQLite3Database` (Task 2's `testDb.ts`) — both implement the same drizzle query builder surface the repository calls, so `any` here is a deliberate driver-agnostic boundary, not a correctness gap. Remove the unused `AppDatabase` type alias at the top of the file.

- [ ] **Step 4: Remove the unused type and run the tests to verify they pass**

Delete the `type AppDatabase = ...` block from Step 3's code before saving the file.

Run: `npx jest src/db/recordRepository.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add record repository with upsert, lookup, and aggregate queries"
```

---

## Task 4: HealthKit sleep wrapper

**Files:**
- Create: `src/healthkit/sleep.ts`
- Test: `src/healthkit/sleep.test.ts`

**Interfaces:**
- Consumes: `formatDateISO`, `getPreviousDay` (Task 1, `src/lib/date.ts`)
- Produces: `getLastNightSleepMinutes(forDate: Date): Promise<number | null>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/healthkit/sleep.test.ts
import { getLastNightSleepMinutes } from './sleep';

const mockRequestAuthorization = jest.fn();
const mockQueryCategorySamples = jest.fn();

jest.mock('@kingstinct/react-native-healthkit', () => ({
  requestAuthorization: (...args: unknown[]) => mockRequestAuthorization(...args),
  queryCategorySamples: (...args: unknown[]) => mockQueryCategorySamples(...args),
}));

describe('getLastNightSleepMinutes', () => {
  beforeEach(() => {
    mockRequestAuthorization.mockReset();
    mockQueryCategorySamples.mockReset();
  });

  it('sums asleep sample durations, excluding inBed samples', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockResolvedValue([
      { value: 'INBED', startDate: '2026-10-07T22:00:00.000Z', endDate: '2026-10-08T06:00:00.000Z' },
      { value: 'ASLEEPCORE', startDate: '2026-10-07T22:30:00.000Z', endDate: '2026-10-08T01:00:00.000Z' },
      { value: 'ASLEEPDEEP', startDate: '2026-10-08T01:00:00.000Z', endDate: '2026-10-08T05:30:00.000Z' },
    ]);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBe(420); // 2.5h + 4.5h = 7h = 420min
  });

  it('returns null when authorization is denied', async () => {
    mockRequestAuthorization.mockResolvedValue(false);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBeNull();
    expect(mockQueryCategorySamples).not.toHaveBeenCalled();
  });

  it('returns null when there are no sleep samples', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockResolvedValue([]);

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBeNull();
  });

  it('returns null when the query throws', async () => {
    mockRequestAuthorization.mockResolvedValue(true);
    mockQueryCategorySamples.mockRejectedValue(new Error('HealthKit unavailable'));

    const result = await getLastNightSleepMinutes(new Date(2026, 9, 8, 21, 0));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/healthkit/sleep.test.ts`
Expected: FAIL with "Cannot find module './sleep'"

- [ ] **Step 3: Implement the wrapper**

```ts
// src/healthkit/sleep.ts
import { requestAuthorization, queryCategorySamples } from '@kingstinct/react-native-healthkit';
import { formatDateISO, getPreviousDay } from '../lib/date';

const SLEEP_ANALYSIS_IDENTIFIER = 'HKCategoryTypeIdentifierSleepAnalysis';
const ASLEEP_VALUES = new Set(['ASLEEPCORE', 'ASLEEPDEEP', 'ASLEEPREM', 'ASLEEPUNSPECIFIED']);

export async function getLastNightSleepMinutes(forDate: Date): Promise<number | null> {
  try {
    const authorized = await requestAuthorization([], [SLEEP_ANALYSIS_IDENTIFIER]);
    if (!authorized) {
      return null;
    }

    const windowStart = getPreviousDay(forDate);
    windowStart.setHours(12, 0, 0, 0); // noon of the previous day
    const windowEnd = new Date(forDate);
    windowEnd.setHours(12, 0, 0, 0); // noon of forDate

    const samples = await queryCategorySamples(SLEEP_ANALYSIS_IDENTIFIER, {
      from: windowStart,
      to: windowEnd,
    });

    if (!samples || samples.length === 0) {
      return null;
    }

    const totalMs = samples
      .filter((sample: { value: string }) => ASLEEP_VALUES.has(sample.value))
      .reduce((sum: number, sample: { startDate: string; endDate: string }) => {
        const durationMs = new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime();
        return sum + durationMs;
      }, 0);

    if (totalMs === 0) {
      return null;
    }

    return Math.round(totalMs / 60000);
  } catch {
    return null;
  }
}

// re-exported so callers that need to label the date this result is "for" can do so consistently
export { formatDateISO };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/healthkit/sleep.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add HealthKit sleep duration wrapper"
```

---

## Task 5: Notification wrapper

**Files:**
- Create: `src/notifications/reminder.ts`
- Test: `src/notifications/reminder.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `DEFAULT_REMINDER_HOUR = 21`
  - `DEFAULT_REMINDER_MINUTE = 0`
  - `requestNotificationPermission(): Promise<boolean>`
  - `scheduleDailyReminder(hour: number, minute: number): Promise<string | null>` — returns the notification identifier, or `null` if permission is not granted
  - `cancelDailyReminder(identifier: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/notifications/reminder.test.ts
import * as Notifications from 'expo-notifications';
import {
  requestNotificationPermission,
  scheduleDailyReminder,
  cancelDailyReminder,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from './reminder';

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

describe('constants', () => {
  it('defaults to 21:00', () => {
    expect(DEFAULT_REMINDER_HOUR).toBe(21);
    expect(DEFAULT_REMINDER_MINUTE).toBe(0);
  });
});

describe('requestNotificationPermission', () => {
  it('returns true when granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermission();
    expect(result).toBe(true);
  });

  it('returns false when denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });

  it('skips the prompt and returns true when already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    const result = await requestNotificationPermission();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleDailyReminder', () => {
  it('schedules a repeating daily notification and returns its id', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('reminder-id-1');

    const id = await scheduleDailyReminder(21, 0);

    expect(id).toBe('reminder-id-1');
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 21, minute: 0, repeats: true }),
      })
    );
  });

  it('returns null without scheduling when permission is not granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    const id = await scheduleDailyReminder(21, 0);

    expect(id).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelDailyReminder', () => {
  it('cancels the scheduled notification by id', async () => {
    await cancelDailyReminder('reminder-id-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('reminder-id-1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/notifications/reminder.test.ts`
Expected: FAIL with "Cannot find module './reminder'"

- [ ] **Step 3: Implement the wrapper**

```ts
// src/notifications/reminder.ts
import * as Notifications from 'expo-notifications';

export const DEFAULT_REMINDER_HOUR = 21;
export const DEFAULT_REMINDER_MINUTE = 0;

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: '今日の記録をつけましょう',
      body: '睡眠時間とコンディションを記録しましょう。',
    },
    trigger: { hour, minute, repeats: true },
  });
}

export async function cancelDailyReminder(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/notifications/reminder.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add daily reminder notification wrapper"
```

---

## Task 6: App shell and navigation

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/(tabs)/_layout.tsx`
- Modify: `app/(tabs)/index.tsx` (placeholder content, replaced fully in Task 7)
- Create: `app/(tabs)/history.tsx` (placeholder, replaced fully in Task 8)
- Create: `app/(tabs)/analysis.tsx` (placeholder, replaced fully in Task 9)
- Test: `app/_layout.test.tsx`

**Interfaces:**
- Consumes: `migrations` (Task 2, `src/db/migrations/migrations.js`), `db` (Task 2, `src/db/client.ts`)
- Produces: root layout that runs migrations before rendering the tab navigator; three named tab routes (`index`, `history`, `analysis`) that later tasks fill in

- [ ] **Step 1: Write the failing smoke test for the root layout**

```tsx
// app/_layout.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import RootLayout from './_layout';

jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn(() => ({})) }));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: jest.fn(() => ({ success: true, error: undefined })),
}));
jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return { ...actual, Tabs: actual.Tabs ?? (({ children }: any) => children) };
});

describe('RootLayout', () => {
  it('renders without crashing once migrations succeed', () => {
    render(<RootLayout />);
    expect(screen.root).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/_layout.test.tsx`
Expected: FAIL with "Cannot find module './_layout'"

- [ ] **Step 3: Implement the root layout with the migration gate**

```tsx
// app/_layout.tsx
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../src/db/migrations/migrations';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>データベースの初期化に失敗しました</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 4: Implement the tab layout and placeholder tab screens**

```tsx
// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: '記録' }} />
      <Tabs.Screen name="history" options={{ title: '履歴' }} />
      <Tabs.Screen name="analysis" options={{ title: '分析' }} />
    </Tabs>
  );
}
```

```tsx
// app/(tabs)/index.tsx
import React from 'react';
import { Text, View } from 'react-native';

export default function TodayScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>記録画面（準備中）</Text>
    </View>
  );
}
```

```tsx
// app/(tabs)/history.tsx
import React from 'react';
import { Text, View } from 'react-native';

export default function HistoryScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>履歴画面（準備中）</Text>
    </View>
  );
}
```

```tsx
// app/(tabs)/analysis.tsx
import React from 'react';
import { Text, View } from 'react-native';

export default function AnalysisScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>分析画面（準備中）</Text>
    </View>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest app/_layout.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add app shell with migration gate and 3-tab navigation"
```

---

## Task 7: Record form and Today screen

**Files:**
- Create: `src/features/record/SegmentedSelector.tsx`
- Create: `src/features/record/RecordForm.tsx`
- Modify: `app/(tabs)/index.tsx`
- Test: `src/features/record/RecordForm.test.tsx`

**Interfaces:**
- Consumes: `upsertDailyRecord`, `getRecordByDate` (Task 3); `getLastNightSleepMinutes` (Task 4); `formatDateISO`, `getPreviousDay` (Task 1); `db` (Task 2)
- Produces:
  - `SegmentedSelector<T extends string>` component, props `{ label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }`
  - `RecordForm` component, props `{ date: string; initialRecord: DailyRecord | null; onSaved: (record: DailyRecord) => void }`

- [ ] **Step 1: Write the failing tests for RecordForm**

```tsx
// src/features/record/RecordForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { RecordForm } from './RecordForm';

const mockUpsert = jest.fn();
const mockGetByDate = jest.fn();
const mockGetSleep = jest.fn();

jest.mock('../../db/client', () => ({ db: {} }));
jest.mock('../../db/recordRepository', () => ({
  upsertDailyRecord: (...args: unknown[]) => mockUpsert(...args),
  getRecordByDate: (...args: unknown[]) => mockGetByDate(...args),
}));
jest.mock('../../healthkit/sleep', () => ({
  getLastNightSleepMinutes: (...args: unknown[]) => mockGetSleep(...args),
}));

describe('RecordForm', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockGetByDate.mockReset();
    mockGetSleep.mockReset();
  });

  it('falls back to manual sleep input when HealthKit returns null', async () => {
    mockGetSleep.mockResolvedValue(null);

    render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('例: 420')).toBeTruthy();
    });
  });

  it('prefills the sleep field from HealthKit when available and marks the source', async () => {
    mockGetSleep.mockResolvedValue(430);

    render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('430')).toBeTruthy();
    });
  });

  it('disables save until a condition rating is selected', async () => {
    mockGetSleep.mockResolvedValue(null);

    render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={jest.fn()} />);

    await waitFor(() => screen.getByText('保存'));
    expect(screen.getByText('保存').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByText('3'));
    expect(screen.getByText('保存').props.accessibilityState?.disabled).toBe(false);
  });

  it('calls upsertDailyRecord with the selected values on save', async () => {
    mockGetSleep.mockResolvedValue(null);
    const onSaved = jest.fn();
    mockUpsert.mockResolvedValue({ id: 1, date: '2026-10-08', condition: 4 });

    render(<RecordForm date="2026-10-08" initialRecord={null} onSaved={onSaved} />);

    await waitFor(() => screen.getByText('保存'));
    fireEvent.changeText(screen.getByPlaceholderText('例: 420'), '400');
    fireEvent.press(screen.getByText('4'));
    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        date: '2026-10-08',
        sleepMinutes: 400,
        condition: 4,
        caffeine: 'none',
        exercise: 'none',
        alcohol: 'none',
      })
    );
    expect(onSaved).toHaveBeenCalledWith({ id: 1, date: '2026-10-08', condition: 4 });
  });

  it('prefills from initialRecord when editing an existing date', async () => {
    mockGetSleep.mockResolvedValue(null);

    render(
      <RecordForm
        date="2026-10-01"
        initialRecord={{
          id: 1,
          date: '2026-10-01',
          sleepMinutes: 390,
          sleepSource: 'manual',
          condition: 2,
          conditionNote: 'メモ',
          caffeine: 'afternoon',
          exercise: 'none',
          alcohol: 'moderate',
          createdAt: '',
          updatedAt: '',
        }}
        onSaved={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('390')).toBeTruthy();
      expect(screen.getByDisplayValue('メモ')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/record/RecordForm.test.tsx`
Expected: FAIL with "Cannot find module './RecordForm'"

- [ ] **Step 3: Implement SegmentedSelector**

```tsx
// src/features/record/SegmentedSelector.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Option<T extends string> = { value: T; label: string };

export function SegmentedSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: value === option.value ? '#333' : '#eee',
            }}
          >
            <Text style={{ color: value === option.value ? '#fff' : '#333' }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Implement RecordForm**

```tsx
// src/features/record/RecordForm.tsx
import React, { useEffect, useState } from 'react';
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
    (initialRecord?.caffeine as ActivityOption) ?? 'none'
  );
  const [exercise, setExercise] = useState<ActivityOption>(
    (initialRecord?.exercise as ActivityOption) ?? 'none'
  );
  const [alcohol, setAlcohol] = useState<AlcoholOption>(
    (initialRecord?.alcohol as AlcoholOption) ?? 'none'
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialRecord) {
      return; // editing an existing record — don't overwrite with a fresh HealthKit lookup
    }
    getLastNightSleepMinutes(new Date()).then((minutes) => {
      if (minutes != null) {
        setSleepMinutesText(String(minutes));
        setSleepSource('healthkit');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSave = condition != null && !saving;

  const handleSave = async () => {
    if (condition == null) {
      return;
    }
    setSaving(true);
    try {
      const input: UpsertDailyRecordInput = {
        date,
        sleepMinutes: sleepMinutesText.trim() === '' ? null : Number(sleepMinutesText),
        sleepSource: sleepSource ?? (sleepMinutesText.trim() === '' ? null : 'manual'),
        condition,
        conditionNote: conditionNote.trim() === '' ? null : conditionNote,
        caffeine,
        exercise,
        alcohol,
      };
      const saved = await upsertDailyRecord(db, input);
      onSaved(saved);
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
          setSleepMinutesText(text);
          setSleepSource('manual');
        }}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 16 }}
      />

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

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
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
```

- [ ] **Step 5: Wire the Today screen**

```tsx
// app/(tabs)/index.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { formatDateISO } from '../../src/lib/date';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';

export default function TodayScreen() {
  const today = formatDateISO(new Date());
  const [initialRecord, setInitialRecord] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getRecordByDate(db, today).then((record) => {
      setInitialRecord(record);
      setLoaded(true);
    });
  }, [today]);

  if (!loaded) {
    return null;
  }

  return (
    <ScrollView>
      <RecordForm date={today} initialRecord={initialRecord} onSaved={setInitialRecord} />
    </ScrollView>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest src/features/record/RecordForm.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add record form with HealthKit fallback and wire Today screen"
```

---

## Task 8: History screen and edit route

**Files:**
- Modify: `app/(tabs)/history.tsx`
- Create: `app/record-edit/[date].tsx`
- Test: `app/(tabs)/history.test.tsx`

**Interfaces:**
- Consumes: `listRecordsDesc` (Task 3), `RecordForm` (Task 7), `getRecordByDate` (Task 3), `db` (Task 2)
- Produces: History tab listing all records; tapping a row navigates to `/record-edit/[date]` which reuses `RecordForm` pre-filled for that date

- [ ] **Step 1: Write the failing test for the history list**

```tsx
// app/(tabs)/history.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import HistoryScreen from './history';

const mockList = jest.fn();
const mockPush = jest.fn();

jest.mock('../../src/db/client', () => ({ db: {} }));
jest.mock('../../src/db/recordRepository', () => ({
  listRecordsDesc: (...args: unknown[]) => mockList(...args),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('HistoryScreen', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockPush.mockReset();
  });

  it('shows an empty-state message when there are no records', async () => {
    mockList.mockResolvedValue([]);
    render(<HistoryScreen />);
    await waitFor(() => expect(screen.getByText('まだ記録がありません')).toBeTruthy());
  });

  it('lists records with date and condition', async () => {
    mockList.mockResolvedValue([
      { id: 2, date: '2026-10-08', condition: 4, caffeine: 'morning', exercise: 'none', alcohol: 'none' },
      { id: 1, date: '2026-10-07', condition: 2, caffeine: 'none', exercise: 'morning', alcohol: 'moderate' },
    ]);
    render(<HistoryScreen />);
    await waitFor(() => {
      expect(screen.getByText('2026-10-08')).toBeTruthy();
      expect(screen.getByText('2026-10-07')).toBeTruthy();
    });
  });

  it('navigates to the edit route when a row is tapped', async () => {
    mockList.mockResolvedValue([
      { id: 1, date: '2026-10-07', condition: 2, caffeine: 'none', exercise: 'morning', alcohol: 'moderate' },
    ]);
    render(<HistoryScreen />);
    const row = await screen.findByText('2026-10-07');
    row.props.onPress ? row.props.onPress() : row.parent?.props.onPress?.();
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/record-edit/2026-10-07'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest "app/(tabs)/history.test.tsx"`
Expected: FAIL (placeholder screen has no "まだ記録がありません" text, list not fetched)

- [ ] **Step 3: Implement the History screen**

```tsx
// app/(tabs)/history.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { listRecordsDesc } from '../../src/db/recordRepository';
import type { DailyRecord } from '../../src/db/schema';

export default function HistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<DailyRecord[] | null>(null);

  useEffect(() => {
    listRecordsDesc(db).then(setRecords);
  }, []);

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
```

- [ ] **Step 4: Implement the edit route**

```tsx
// app/record-edit/[date].tsx
import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../src/db/client';
import { getRecordByDate } from '../../src/db/recordRepository';
import { RecordForm } from '../../src/features/record/RecordForm';
import type { DailyRecord } from '../../src/db/schema';

export default function RecordEditScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!date) return;
    getRecordByDate(db, date).then((r) => {
      setRecord(r);
      setLoaded(true);
    });
  }, [date]);

  if (!loaded || !date) {
    return null;
  }

  return (
    <ScrollView>
      <RecordForm
        date={date}
        initialRecord={record}
        onSaved={() => router.back()}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest "app/(tabs)/history.test.tsx"`
Expected: PASS (3 tests)

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add history list and record edit route"
```

---

## Task 9: Analysis screen

**Files:**
- Modify: `app/(tabs)/analysis.tsx`
- Test: `app/(tabs)/analysis.test.tsx`

**Interfaces:**
- Consumes: `getSleepConditionPoints`, `getConditionAverageBy` (Task 3), `db` (Task 2)
- Produces: Analysis tab rendering a scatter chart and three activity-comparison bar charts, or an empty state when fewer than 5 records exist

- [ ] **Step 1: Write the failing tests**

```tsx
// app/(tabs)/analysis.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import AnalysisScreen from './analysis';

const mockPoints = jest.fn();
const mockAverages = jest.fn();

jest.mock('../../src/db/client', () => ({ db: {} }));
jest.mock('../../src/db/recordRepository', () => ({
  getSleepConditionPoints: (...args: unknown[]) => mockPoints(...args),
  getConditionAverageBy: (...args: unknown[]) => mockAverages(...args),
}));
jest.mock('victory-native', () => {
  const { View } = require('react-native');
  return { CartesianChart: View, Scatter: View, Bar: View };
});

describe('AnalysisScreen', () => {
  beforeEach(() => {
    mockPoints.mockReset();
    mockAverages.mockReset();
  });

  it('shows an empty-state message when there are fewer than 5 records', async () => {
    mockPoints.mockResolvedValue([
      { sleepMinutes: 400, condition: 3 },
      { sleepMinutes: 420, condition: 4 },
    ]);
    mockAverages.mockResolvedValue({ withActivity: 3, without: 4 });

    render(<AnalysisScreen />);

    await waitFor(() => {
      expect(screen.getByText('もう少しデータを集めましょう')).toBeTruthy();
    });
  });

  it('renders charts when there are 5 or more records', async () => {
    mockPoints.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ sleepMinutes: 400 + i * 10, condition: (i % 5) + 1 }))
    );
    mockAverages.mockResolvedValue({ withActivity: 3.2, without: 3.8 });

    render(<AnalysisScreen />);

    await waitFor(() => {
      expect(screen.queryByText('もう少しデータを集めましょう')).toBeNull();
      expect(screen.getByText('睡眠時間とコンディション')).toBeTruthy();
      expect(screen.getByText('カフェイン')).toBeTruthy();
      expect(screen.getByText('運動')).toBeTruthy();
      expect(screen.getByText('アルコール')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest "app/(tabs)/analysis.test.tsx"`
Expected: FAIL (placeholder screen does not fetch data or render these labels)

- [ ] **Step 3: Implement the Analysis screen**

```tsx
// app/(tabs)/analysis.tsx
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CartesianChart, Scatter, Bar } from 'victory-native';
import { db } from '../../src/db/client';
import { getSleepConditionPoints, getConditionAverageBy } from '../../src/db/recordRepository';

const MIN_RECORDS_FOR_ANALYSIS = 5;

type ActivityAverages = { withActivity: number | null; without: number | null };

export default function AnalysisScreen() {
  const [points, setPoints] = useState<{ sleepMinutes: number; condition: number }[] | null>(null);
  const [caffeineAvg, setCaffeineAvg] = useState<ActivityAverages | null>(null);
  const [exerciseAvg, setExerciseAvg] = useState<ActivityAverages | null>(null);
  const [alcoholAvg, setAlcoholAvg] = useState<ActivityAverages | null>(null);

  useEffect(() => {
    getSleepConditionPoints(db).then(setPoints);
    getConditionAverageBy(db, 'caffeine').then(setCaffeineAvg);
    getConditionAverageBy(db, 'exercise').then(setExerciseAvg);
    getConditionAverageBy(db, 'alcohol').then(setAlcoholAvg);
  }, []);

  if (!points || !caffeineAvg || !exerciseAvg || !alcoholAvg) {
    return null;
  }

  if (points.length < MIN_RECORDS_FOR_ANALYSIS) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text>もう少しデータを集めましょう</Text>
      </View>
    );
  }

  const comparisonData = (label: string, avg: ActivityAverages) => [
    { group: `${label}: あり`, value: avg.withActivity ?? 0 },
    { group: `${label}: なし`, value: avg.without ?? 0 },
  ];

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, marginBottom: 8 }}>睡眠時間とコンディション</Text>
      <View style={{ height: 240, marginBottom: 24 }}>
        <CartesianChart data={points} xKey="sleepMinutes" yKeys={['condition']}>
          {({ points: chartPoints }) => <Scatter points={chartPoints.condition} color="#333" radius={4} />}
        </CartesianChart>
      </View>

      <Text style={{ fontSize: 18, marginBottom: 8 }}>カフェイン</Text>
      <View style={{ height: 200, marginBottom: 24 }}>
        <CartesianChart data={comparisonData('カフェイン', caffeineAvg)} xKey="group" yKeys={['value']}>
          {({ points: chartPoints }) => <Bar points={chartPoints.value} color="#333" />}
        </CartesianChart>
      </View>

      <Text style={{ fontSize: 18, marginBottom: 8 }}>運動</Text>
      <View style={{ height: 200, marginBottom: 24 }}>
        <CartesianChart data={comparisonData('運動', exerciseAvg)} xKey="group" yKeys={['value']}>
          {({ points: chartPoints }) => <Bar points={chartPoints.value} color="#333" />}
        </CartesianChart>
      </View>

      <Text style={{ fontSize: 18, marginBottom: 8 }}>アルコール</Text>
      <View style={{ height: 200, marginBottom: 24 }}>
        <CartesianChart data={comparisonData('アルコール', alcoholAvg)} xKey="group" yKeys={['value']}>
          {({ points: chartPoints }) => <Bar points={chartPoints.value} color="#333" />}
        </CartesianChart>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest "app/(tabs)/analysis.test.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add analysis screen with scatter and comparison charts"
```

---

## Task 10: Settings screen and reminder wiring

**Files:**
- Create: `src/settings/preferences.ts`
- Create: `app/settings.tsx`
- Modify: `app/(tabs)/_layout.tsx` (add a settings entry point in the header)
- Test: `src/settings/preferences.test.ts`
- Test: `app/settings.test.tsx`

**Interfaces:**
- Consumes: `requestNotificationPermission`, `scheduleDailyReminder`, `cancelDailyReminder`, `DEFAULT_REMINDER_HOUR`, `DEFAULT_REMINDER_MINUTE` (Task 5)
- Produces:
  - `getReminderPreference(): Promise<{ hour: number; minute: number; notificationId: string | null } | null>`
  - `saveReminderPreference(pref: { hour: number; minute: number; notificationId: string | null }): Promise<void>`
  - `app/settings.tsx` screen reachable from the tab header

- [ ] **Step 1: Write the failing tests for preferences storage**

```ts
// src/settings/preferences.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReminderPreference, saveReminderPreference } from './preferences';

describe('reminder preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns null when no preference has been saved', async () => {
    const pref = await getReminderPreference();
    expect(pref).toBeNull();
  });

  it('round-trips a saved preference', async () => {
    await saveReminderPreference({ hour: 22, minute: 30, notificationId: 'abc' });
    const pref = await getReminderPreference();
    expect(pref).toEqual({ hour: 22, minute: 30, notificationId: 'abc' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/settings/preferences.test.ts`
Expected: FAIL with "Cannot find module './preferences'"

- [ ] **Step 3: Implement preferences storage**

```ts
// src/settings/preferences.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reminderPreference';

export type ReminderPreference = {
  hour: number;
  minute: number;
  notificationId: string | null;
};

export async function getReminderPreference(): Promise<ReminderPreference | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as ReminderPreference;
}

export async function saveReminderPreference(pref: ReminderPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pref));
}
```

- [ ] **Step 4: Run the preferences test to verify it passes**

Run: `npx jest src/settings/preferences.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for the settings screen**

```tsx
// app/settings.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from './settings';

const mockGetPref = jest.fn();
const mockSavePref = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();

jest.mock('../src/settings/preferences', () => ({
  getReminderPreference: (...args: unknown[]) => mockGetPref(...args),
  saveReminderPreference: (...args: unknown[]) => mockSavePref(...args),
}));
jest.mock('../src/notifications/reminder', () => ({
  scheduleDailyReminder: (...args: unknown[]) => mockSchedule(...args),
  cancelDailyReminder: (...args: unknown[]) => mockCancel(...args),
  DEFAULT_REMINDER_HOUR: 21,
  DEFAULT_REMINDER_MINUTE: 0,
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockGetPref.mockReset();
    mockSavePref.mockReset();
    mockSchedule.mockReset();
    mockCancel.mockReset();
  });

  it('shows that reminders are off when scheduling returns null (permission denied)', async () => {
    mockGetPref.mockResolvedValue(null);
    mockSchedule.mockResolvedValue(null);

    render(<SettingsScreen />);
    fireEvent.press(await screen.findByText('リマインドを有効にする'));

    await waitFor(() => {
      expect(screen.getByText('通知が許可されていないため、リマインドをオンにできません')).toBeTruthy();
    });
  });

  it('enables the reminder and persists the preference when permission is granted', async () => {
    mockGetPref.mockResolvedValue(null);
    mockSchedule.mockResolvedValue('notif-1');

    render(<SettingsScreen />);
    fireEvent.press(await screen.findByText('リマインドを有効にする'));

    await waitFor(() => {
      expect(mockSavePref).toHaveBeenCalledWith({ hour: 21, minute: 0, notificationId: 'notif-1' });
      expect(screen.getByText('21:00 にリマインドします')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx jest app/settings.test.tsx`
Expected: FAIL with "Cannot find module './settings'"

- [ ] **Step 7: Implement the settings screen**

```tsx
// app/settings.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  scheduleDailyReminder,
  cancelDailyReminder,
  DEFAULT_REMINDER_HOUR,
  DEFAULT_REMINDER_MINUTE,
} from '../src/notifications/reminder';
import { getReminderPreference, saveReminderPreference } from '../src/settings/preferences';

export default function SettingsScreen() {
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getReminderPreference().then((pref) => {
      setNotificationId(pref?.notificationId ?? null);
      setLoaded(true);
    });
  }, []);

  const handleEnable = async () => {
    const id = await scheduleDailyReminder(DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE);
    if (!id) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    setNotificationId(id);
    await saveReminderPreference({ hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE, notificationId: id });
  };

  const handleDisable = async () => {
    if (notificationId) {
      await cancelDailyReminder(notificationId);
    }
    setNotificationId(null);
    await saveReminderPreference({ hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE, notificationId: null });
  };

  if (!loaded) {
    return null;
  }

  return (
    <View style={{ padding: 16 }}>
      {notificationId ? (
        <>
          <Text style={{ marginBottom: 12 }}>
            {String(DEFAULT_REMINDER_HOUR).padStart(2, '0')}:{String(DEFAULT_REMINDER_MINUTE).padStart(2, '0')} にリマインドします
          </Text>
          <Pressable onPress={handleDisable}>
            <Text>リマインドを無効にする</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={handleEnable}>
            <Text>リマインドを有効にする</Text>
          </Pressable>
          {permissionDenied && (
            <Text style={{ marginTop: 12, color: '#b00' }}>
              通知が許可されていないため、リマインドをオンにできません
            </Text>
          )}
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 8: Add a settings entry point to the tab header**

```tsx
// app/(tabs)/_layout.tsx
import React from 'react';
import { Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';

export default function TabsLayout() {
  const router = useRouter();
  const settingsButton = () => (
    <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 12 }}>
      <Text>設定</Text>
    </Pressable>
  );

  return (
    <Tabs screenOptions={{ headerShown: true, headerRight: settingsButton }}>
      <Tabs.Screen name="index" options={{ title: '記録' }} />
      <Tabs.Screen name="history" options={{ title: '履歴' }} />
      <Tabs.Screen name="analysis" options={{ title: '分析' }} />
    </Tabs>
  );
}
```

- [ ] **Step 9: Run the settings test to verify it passes**

Run: `npx jest app/settings.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 10: Run the full test suite**

Run: `npx jest`
Expected: all test files PASS

- [ ] **Step 11: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add settings screen with reminder toggle and persistence"
```

---

## Post-plan manual verification

This plan's automated tests all run under Jest with mocked native modules. Before considering the app done, build and run it on a real device or simulator via EAS Development Build, since HealthKit, notifications, and SQLite only behave correctly on-device:

```bash
npx eas build --profile development --platform ios
```

Then manually walk through: granting/denying HealthKit permission, saving and re-saving today's record, editing a past record from History, viewing Analysis with fewer than 5 and 5+ records, and enabling/disabling the reminder notification.
