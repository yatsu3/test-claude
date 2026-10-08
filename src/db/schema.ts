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
