// Queries for the checkins table.
// All functions take the Database as their first argument (see helpers.ts).

import { randomUUID } from 'node:crypto';
import type { Database } from 'sql.js';
import type { Checkin, CheckinFilter, CheckinStatus } from '../../../src/types/index.js';
import { queryAll, queryOne, execute } from './helpers.js';

const COLUMNS = 'id, habit_id, date, status, updated_at';

export function getCheckin(db: Database, habitId: string, date: string): Checkin | null {
  const row = queryOne(
    db,
    `SELECT ${COLUMNS} FROM checkins WHERE habit_id = ? AND date = ?`,
    [habitId, date],
  );
  return row ? (row as unknown as Checkin) : null;
}

/**
 * Set the status for a habit on a date. Upsert: creates the row if it doesn't
 * exist, otherwise updates status + updated_at. The (habit_id, date) UNIQUE
 * constraint makes duplicates structurally impossible.
 */
export function setCheckin(
  db: Database,
  habitId: string,
  date: string,
  status: CheckinStatus,
): Checkin {
  const existing = queryOne(
    db,
    'SELECT id FROM checkins WHERE habit_id = ? AND date = ?',
    [habitId, date],
  );

  if (existing) {
    execute(
      db,
      "UPDATE checkins SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, existing.id as string],
    );
  } else {
    const id = randomUUID();
    execute(
      db,
      'INSERT INTO checkins (id, habit_id, date, status) VALUES (?, ?, ?, ?)',
      [id, habitId, date, status],
    );
  }

  const checkin = getCheckin(db, habitId, date);
  if (!checkin) throw new Error('Failed to save check-in');
  return checkin;
}

/** List check-ins, optionally filtered by habit and/or an inclusive date range. */
export function listCheckins(db: Database, filter: CheckinFilter = {}): Checkin[] {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];

  if (filter.habitId !== undefined) {
    conditions.push('habit_id = ?');
    params.push(filter.habitId);
  }
  if (filter.startDate !== undefined) {
    conditions.push('date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate !== undefined) {
    conditions.push('date <= ?');
    params.push(filter.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return queryAll(db, `SELECT ${COLUMNS} FROM checkins ${where} ORDER BY date, habit_id`, params) as unknown as Checkin[];
}

export function deleteCheckin(db: Database, habitId: string, date: string): void {
  execute(db, 'DELETE FROM checkins WHERE habit_id = ? AND date = ?', [habitId, date]);
}
