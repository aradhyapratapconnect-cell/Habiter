// Queries for the settings table (simple key-value store).
// All functions take the Database as their first argument (see helpers.ts).

import type { Database } from 'sql.js';
import { queryAll, queryOne, execute } from './helpers.js';

export function getSetting(db: Database, key: string): string | null {
  const row = queryOne(db, 'SELECT value FROM settings WHERE key = ?', [key]);
  return row ? (row.value as string) : null;
}

/** Insert or replace a setting value. */
export function setSetting(db: Database, key: string, value: string): void {
  execute(db, 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

export function deleteSetting(db: Database, key: string): void {
  execute(db, 'DELETE FROM settings WHERE key = ?', [key]);
}

export function listSettings(db: Database): Array<{ key: string; value: string }> {
  return queryAll(db, 'SELECT key, value FROM settings ORDER BY key') as unknown as Array<{
    key: string;
    value: string;
  }>;
}
