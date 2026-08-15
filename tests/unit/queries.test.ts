// Unit tests for the TICKET-004 query layer (electron/db/queries/*).
//
// Verifies full CRUD for every table against an in-memory sql.js database with
// the core-schema migration applied. Each query function takes the Database as
// its first argument, so these run without Electron.
//
// Run: npm test  (or: npx vitest run)

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database } from 'sql.js';

import {
  createHabit,
  deleteHabit,
  getHabit,
  listHabits,
  updateHabit,
} from '../../electron/db/queries/habits.js';
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from '../../electron/db/queries/categories.js';
import {
  deleteCheckin,
  getCheckin,
  listCheckins,
  setCheckin,
} from '../../electron/db/queries/checkins.js';
import {
  deleteDailyLog,
  getDailyLog,
  listDailyLogs,
  setDailyLog,
} from '../../electron/db/queries/dailyLogs.js';
import {
  deleteSetting,
  getSetting,
  listSettings,
  setSetting,
} from '../../electron/db/queries/settings.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../electron/db/migrations/', import.meta.url));

let db: Database;

async function createFreshDatabase(): Promise<Database> {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  // Foreign keys are OFF by default in SQLite — enable them like the app does.
  database.run('PRAGMA foreign_keys = ON');
  for (const file of ['001_init.sql', '002_core_schema.sql']) {
    database.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8'));
  }
  return database;
}

beforeEach(async () => {
  db = await createFreshDatabase();
});

afterEach(() => {
  db.close();
});

function seedHabit(id: string, overrides: Record<string, unknown> = {}): void {
  db.exec(
    'INSERT INTO habits (id, name, frequency_type) VALUES (?, ?, ?)',
    [id, overrides.name ?? 'Gym', overrides.frequency_type ?? 'daily'],
  );
}

describe('habits CRUD', () => {
  it('creates a habit with generated id and defaults', () => {
    const habit = createHabit(db, { name: 'Read', frequency_type: 'daily', sort_order: 3 });

    expect(habit.id).toBeTypeOf('string');
    expect(habit.name).toBe('Read');
    expect(habit.frequency_type).toBe('daily');
    expect(habit.is_archived).toBe(0);
    expect(habit.sort_order).toBe(3);
    expect(habit.icon).toBeNull();
    expect(habit.created_at).toBeTruthy();

    // Persisted in the database
    expect(getHabit(db, habit.id)).toEqual(habit);
  });

  it('stores optional fields (category, reminder, icon)', () => {
    const category = createCategory(db, { name: 'Health', color: '#4ade80' });
    const habit = createHabit(db, {
      name: 'Meditate',
      frequency_type: 'daily',
      category_id: category.id,
      icon: '🧘',
      reminder_time: '07:00',
    });

    expect(habit.category_id).toBe(category.id);
    expect(habit.icon).toBe('🧘');
    expect(habit.reminder_time).toBe('07:00');
  });

  it('lists only active habits by default and all when includeArchived', () => {
    const active = createHabit(db, { name: 'Active', frequency_type: 'daily' });
    const archived = createHabit(db, { name: 'Archived', frequency_type: 'daily' });
    updateHabit(db, archived.id, { is_archived: 1 });

    const activeOnly = listHabits(db);
    expect(activeOnly.map((h) => h.id)).toEqual([active.id]);

    const all = listHabits(db, true);
    expect(all.map((h) => h.id)).toEqual([active.id, archived.id]);
  });

  it('gets null for an unknown habit', () => {
    expect(getHabit(db, 'missing')).toBeNull();
  });

  it('updates only the provided fields', () => {
    const habit = createHabit(db, { name: 'Gym', frequency_type: 'daily', reminder_time: '07:00' });

    const updated = updateHabit(db, habit.id, { name: 'Morning Gym', reminder_time: null });

    expect(updated.name).toBe('Morning Gym');
    expect(updated.reminder_time).toBeNull();
    // Untouched fields preserved
    expect(updated.frequency_type).toBe('daily');
    expect(updated.sort_order).toBe(0);
  });

  it('throws when updating an unknown habit', () => {
    expect(() => updateHabit(db, 'missing', { name: 'X' })).toThrow('not found');
  });

  it('deletes a habit and cascades its check-ins', () => {
    const habit = createHabit(db, { name: 'Gym', frequency_type: 'daily' });
    setCheckin(db, habit.id, '2026-08-10', 'completed');

    deleteHabit(db, habit.id);

    expect(getHabit(db, habit.id)).toBeNull();
    expect(getCheckin(db, habit.id, '2026-08-10')).toBeNull();
  });
});

describe('categories CRUD', () => {
  it('creates, lists, and gets categories', () => {
    const category = createCategory(db, { name: 'Health', color: '#4ade80' });

    expect(category.id).toBeTypeOf('string');
    expect(category.name).toBe('Health');
    expect(listCategories(db)).toHaveLength(1);
    expect(getCategory(db, category.id)).toEqual(category);
    expect(getCategory(db, 'missing')).toBeNull();
  });

  it('updates a category', () => {
    const category = createCategory(db, { name: 'Health', color: '#4ade80' });
    const updated = updateCategory(db, category.id, { color: '#22c55e' });

    expect(updated.name).toBe('Health');
    expect(updated.color).toBe('#22c55e');
  });

  it('deleting a category leaves its habits uncategorized (FK SET NULL)', () => {
    const category = createCategory(db, { name: 'Health', color: '#4ade80' });
    const habit = createHabit(db, {
      name: 'Gym',
      frequency_type: 'daily',
      category_id: category.id,
    });

    deleteCategory(db, category.id);

    expect(getCategory(db, category.id)).toBeNull();
    expect(getHabit(db, habit.id)?.category_id).toBeNull();
  });
});

describe('checkins CRUD', () => {
  it('creates a check-in via set()', () => {
    seedHabit('h-1');
    const checkin = setCheckin(db, 'h-1', '2026-08-10', 'completed');

    expect(checkin.status).toBe('completed');
    expect(checkin.habit_id).toBe('h-1');
    expect(checkin.date).toBe('2026-08-10');
  });

  it('set() updates an existing check-in instead of duplicating it', () => {
    seedHabit('h-1');
    setCheckin(db, 'h-1', '2026-08-10', 'completed');
    const updated = setCheckin(db, 'h-1', '2026-08-10', 'partial');

    expect(updated.status).toBe('partial');
    expect(getCheckin(db, 'h-1', '2026-08-10')?.status).toBe('partial');
    expect(listCheckins(db)).toHaveLength(1);
  });

  it('rejects a check-in for a habit that does not exist (FK)', () => {
    expect(() => setCheckin(db, 'missing', '2026-08-10', 'completed')).toThrow();
  });

  it('lists check-ins filtered by habit and date range', () => {
    seedHabit('h-1');
    seedHabit('h-2');
    setCheckin(db, 'h-1', '2026-08-01', 'completed');
    setCheckin(db, 'h-1', '2026-08-05', 'not_done');
    setCheckin(db, 'h-2', '2026-08-05', 'skipped');

    expect(listCheckins(db)).toHaveLength(3);
    expect(listCheckins(db, { habitId: 'h-1' })).toHaveLength(2);
    expect(listCheckins(db, { startDate: '2026-08-03' })).toHaveLength(2);
    expect(listCheckins(db, { startDate: '2026-08-01', endDate: '2026-08-01' })).toHaveLength(1);
  });

  it('deletes a check-in by habit + date', () => {
    seedHabit('h-1');
    setCheckin(db, 'h-1', '2026-08-10', 'completed');

    deleteCheckin(db, 'h-1', '2026-08-10');

    expect(getCheckin(db, 'h-1', '2026-08-10')).toBeNull();
    expect(listCheckins(db)).toHaveLength(0);
  });
});

describe('daily_logs CRUD', () => {
  it('creates a daily log via set()', () => {
    const log = setDailyLog(db, '2026-08-10', { mood: 'good', sleepHours: 7.5 });

    expect(log.mood).toBe('good');
    expect(log.sleep_hours).toBe(7.5);
    expect(getDailyLog(db, '2026-08-10')).toEqual(log);
  });

  it('set() updates fields independently (one row per date)', () => {
    setDailyLog(db, '2026-08-10', { mood: 'good' });

    const withSleep = setDailyLog(db, '2026-08-10', { sleepHours: 8 });

    expect(withSleep.mood).toBe('good'); // unchanged
    expect(withSleep.sleep_hours).toBe(8);
    expect(listDailyLogs(db)).toHaveLength(1);
  });

  it('clears a field with null', () => {
    setDailyLog(db, '2026-08-10', { mood: 'good', sleepHours: 7.5 });
    const cleared = setDailyLog(db, '2026-08-10', { sleepHours: null });

    expect(cleared.mood).toBe('good');
    expect(cleared.sleep_hours).toBeNull();
  });

  it('deletes a daily log by date', () => {
    setDailyLog(db, '2026-08-10', { mood: 'good' });

    deleteDailyLog(db, '2026-08-10');

    expect(getDailyLog(db, '2026-08-10')).toBeNull();
    expect(listDailyLogs(db)).toHaveLength(0);
  });
});

describe('settings CRUD', () => {
  it('sets, gets, and overrides a setting', () => {
    setSetting(db, 'week_start_day', 'monday');
    expect(getSetting(db, 'week_start_day')).toBe('monday');

    setSetting(db, 'week_start_day', 'sunday');
    expect(getSetting(db, 'week_start_day')).toBe('sunday');

    expect(getSetting(db, 'missing')).toBeNull();
  });

  it('deletes a setting', () => {
    setSetting(db, 'theme', 'dark');
    deleteSetting(db, 'theme');
    expect(getSetting(db, 'theme')).toBeNull();
    expect(listSettings(db)).toHaveLength(0);
  });
});
