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
