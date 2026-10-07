import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const expoDb = openDatabaseSync('sleep-condition-tracker.db');
export const db = drizzle(expoDb);
export type AppDatabase = typeof db;
