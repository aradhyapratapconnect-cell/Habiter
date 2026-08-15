// Queries for the daily_logs table (mood + sleep).
// All functions take the Database as their first argument (see helpers.ts).

import { randomUUID } from 'node:crypto';
import type { Database } from 'sql.js';
import type { DailyLog, DailyLogInput } from '../../../src/types/index.js';
import { queryAll, queryOne, execute } from './helpers.js';

const COLUMNS = 'id, date, mood, sleep_hours, updated_at';

export function getDailyLog(db: Database, date: string): DailyLog | null {
  const row = queryOne(db, `SELECT ${COLUMNS} FROM daily_logs WHERE date = ?`, [date]);
  return row ? (row as unknown as DailyLog) : null;
}

/**
 * Set mood/sleep for a date. Upsert on date (one row per calendar day).
 * Fields set to `undefined` are left unchanged; `null` clears them.
 */
export function setDailyLog(db: Database, date: string, input: DailyLogInput): DailyLog {
  const existing = queryOne(db, 'SELECT id FROM daily_logs WHERE date = ?', [date]);

  if (existing) {
    const assignments: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.mood !== undefined) {
      assignments.push('mood = ?');
      values.push(input.mood ?? null);
    }
    if (input.sleepHours !== undefined) {
      assignments.push('sleep_hours = ?');
      values.push(input.sleepHours ?? null);
    }

    if (assignments.length > 0) {
      execute(
        db,
        `UPDATE daily_logs SET ${assignments.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
        [...values, existing.id as string],
      );
    }
  } else {
    const id = randomUUID();
    execute(
      db,
      'INSERT INTO daily_logs (id, date, mood, sleep_hours) VALUES (?, ?, ?, ?)',
      [id, date, input.mood ?? null, input.sleepHours ?? null],
    );
  }

  const log = getDailyLog(db, date);
  if (!log) throw new Error('Failed to save daily log');
  return log;
}

export function listDailyLogs(db: Database): DailyLog[] {
  return queryAll(db, `SELECT ${COLUMNS} FROM daily_logs ORDER BY date`) as unknown as DailyLog[];
}

export function deleteDailyLog(db: Database, date: string): void {
  execute(db, 'DELETE FROM daily_logs WHERE date = ?', [date]);
}
