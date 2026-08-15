// CRUD queries for the habits table.
// All functions take the Database as their first argument (see helpers.ts).

import { randomUUID } from 'node:crypto';
import type { Database } from 'sql.js';
import type { Habit, HabitCreateInput, HabitUpdateInput } from '../../../src/types/index.js';
import { queryAll, queryOne, execute } from './helpers.js';

const COLUMNS =
  'id, name, icon, frequency_type, frequency_value, reminder_time, is_archived, sort_order, created_at';

export function listHabits(db: Database, includeArchived = false): Habit[] {
  const sql = includeArchived
    ? `SELECT ${COLUMNS} FROM habits ORDER BY sort_order, created_at`
    : `SELECT ${COLUMNS} FROM habits WHERE is_archived = 0 ORDER BY sort_order, created_at`;
  return queryAll(db, sql) as unknown as Habit[];
}

export function getHabit(db: Database, id: string): Habit | null {
  const row = queryOne(db, `SELECT ${COLUMNS} FROM habits WHERE id = ?`, [id]);
  return row ? (row as unknown as Habit) : null;
}

export function createHabit(db: Database, input: HabitCreateInput): Habit {
  const id = randomUUID();
  execute(
    db,
    `INSERT INTO habits (id, name, icon, frequency_type, frequency_value, reminder_time, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.icon ?? null,
      input.frequency_type,
      input.frequency_value ?? null,
      input.reminder_time ?? null,
      input.sort_order ?? 0,
    ],
  );
  const created = getHabit(db, id);
  if (!created) throw new Error('Failed to create habit');
  return created;
}

const UPDATABLE = [
  'name',
  'icon',
  'frequency_type',
  'frequency_value',
  'reminder_time',
  'is_archived',
  'sort_order',
] as const;

export function updateHabit(db: Database, id: string, changes: HabitUpdateInput): Habit {
  const keys = UPDATABLE.filter((key) => changes[key] !== undefined);
  if (keys.length > 0) {
    const assignments = keys.map((key) => `${key} = ?`).join(', ');
    const values = keys.map((key) => changes[key] ?? null);
    execute(db, `UPDATE habits SET ${assignments} WHERE id = ?`, [...values, id]);
  }
  const updated = getHabit(db, id);
  if (!updated) throw new Error(`Habit "${id}" not found`);
  return updated;
}

/**
 * Permanently delete a habit. Its check-ins are removed by the FK's
 * ON DELETE CASCADE. See TICKET-006: the UI must confirm before calling this —
 * the default habit-removal flow is archive, not delete.
 */
export function deleteHabit(db: Database, id: string): void {
  execute(db, 'DELETE FROM habits WHERE id = ?', [id]);
}
