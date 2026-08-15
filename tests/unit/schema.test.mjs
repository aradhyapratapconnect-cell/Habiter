// Unit test for the database schema (TICKET-003, updated by TICKET-031).
//
// Applies every migration in electron/db/migrations/ (001 through 004) to an
// in-memory sql.js database and verifies the resulting schema:
//   1. The core tables exist with correct columns/types after the migrations.
//   2. Foreign keys are enforced (bad habit_id is rejected).
//   3. UNIQUE(habit_id, date) on checkins rejects duplicate check-ins.
//   4. UNIQUE date on daily_logs rejects duplicate day entries.
//   5. TICKET-031: the categories table and habits.category_id no longer exist.
//
// Runs with Node's built-in test runner (no extra dependencies):
//   node --test tests/unit/schema.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../electron/db/migrations/', import.meta.url),
);

async function freshDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  // Foreign keys are OFF by default in SQLite — the real app enables this in
  // electron/db/database.ts, so the test must too.
  db.run('PRAGMA foreign_keys = ON');
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    db.exec(fs.readFileSync(new URL(`../../electron/db/migrations/${file}`, import.meta.url), 'utf-8'));
  }
  return db;
}

/** Read the columns of a table: [{name, type, notnull, dflt_value, pk}, ...] */
function tableInfo(db, table) {
  const result = db.exec(`PRAGMA table_info(${table})`);
  assert.ok(result.length > 0, `expected ${table} table to exist`);
  return result[0].values.map((row) => ({
    name: row[1],
    type: String(row[2]).toUpperCase(),
    notnull: row[3],
    dfltValue: row[4],
    pk: row[5],
  }));
}

/** True if a table exists in sqlite_master. */
function tableExists(db, table) {
  const result = db.exec(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table],
  );
  return result.length > 0 && result[0].values.length > 0;
}

test('migrations create the core tables and drop categories', async () => {
  const db = await freshDatabase();
  for (const table of ['habits', 'checkins', 'daily_logs', 'settings']) {
    assert.ok(tableExists(db, table), `expected ${table} table to exist`);
  }
  // TICKET-031: the categories table must be gone after migration 004.
  assert.ok(!tableExists(db, 'categories'), 'categories table should be dropped');
  db.close();
});

test('habits table has the correct columns and types', async () => {
  const db = await freshDatabase();
  const columns = tableInfo(db, 'habits');
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

  assert.deepEqual(
    Object.keys(byName).sort(),
    [
      'created_at', 'frequency_type', 'frequency_value', 'icon',
      'id', 'is_archived', 'name', 'reminder_time', 'sort_order',
    ].sort(),
  );

  // id is a TEXT primary key
  assert.equal(byName.id.type, 'TEXT');
  assert.equal(byName.id.pk, 1);

  // required fields are NOT NULL
  for (const name of ['name', 'frequency_type']) {
    assert.equal(byName[name].notnull, 1, `${name} should be NOT NULL`);
  }

  // boolean is_archived defaults to false (0)
  assert.equal(byName.is_archived.type, 'INTEGER');
  assert.equal(byName.is_archived.dfltValue, '0');

  db.close();
});

test('habits no longer has a category_id column (TICKET-031)', async () => {
  const db = await freshDatabase();
  const columns = tableInfo(db, 'habits');
  const names = columns.map((c) => c.name);
  assert.ok(!names.includes('category_id'), 'category_id should be dropped from habits');
  db.close();
});

test('checkins table has the correct columns, types, and unique constraint', async () => {
  const db = await freshDatabase();
  const columns = tableInfo(db, 'checkins');
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

  assert.deepEqual(
    Object.keys(byName).sort(),
    ['date', 'habit_id', 'id', 'status', 'updated_at'].sort(),
  );
  assert.equal(byName.id.type, 'TEXT');
  assert.equal(byName.id.pk, 1);
  assert.equal(byName.habit_id.notnull, 1);
  assert.equal(byName.status.notnull, 1);

  // The UNIQUE(habit_id, date) constraint must exist in the schema
  const indexes = db.exec(`PRAGMA index_list(checkins)`)[0].values.map((r) => ({
    name: r[1],
    unique: r[2],
    origin: r[3],
  }));
  const uniqueIndex = indexes.find((i) => i.unique === 1);
  assert.ok(uniqueIndex, 'checkins should have a unique index (from UNIQUE(habit_id, date))');

  db.close();
});

test('daily_logs table has the correct columns, types, and unique date', async () => {
  const db = await freshDatabase();
  const columns = tableInfo(db, 'daily_logs');
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

  assert.deepEqual(
    Object.keys(byName).sort(),
    ['date', 'id', 'mood', 'sleep_hours', 'updated_at'].sort(),
  );
  assert.equal(byName.id.type, 'TEXT');
  assert.equal(byName.id.pk, 1);
  assert.equal(byName.date.notnull, 1);
  assert.equal(byName.sleep_hours.type, 'REAL');

  // date has a UNIQUE constraint
  const indexes = db.exec(`PRAGMA index_list(daily_logs)`)[0].values.map((r) => r[2]);
  assert.ok(indexes.some((u) => u === 1), 'daily_logs.date should be unique');

  db.close();
});

test('settings table has the correct columns', async () => {
  const db = await freshDatabase();
  const columns = tableInfo(db, 'settings');
  const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

  assert.deepEqual(Object.keys(byName).sort(), ['key', 'value'].sort());
  assert.equal(byName.key.type, 'TEXT');
  assert.equal(byName.key.pk, 1);

  db.close();
});

test('foreign keys are enforced: checkin with unknown habit_id is rejected', async () => {
  const db = await freshDatabase();

  // No habit exists yet, so this must fail the FK constraint
  assert.throws(
    () => db.run(
      "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-1', 'no-such-habit', '2026-08-10', 'completed')",
    ),
    /FOREIGN KEY/,
  );

  // With a real habit it succeeds
  db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-1', 'Gym', 'daily')");
  db.run(
    "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-1', 'h-1', '2026-08-10', 'completed')",
  );

  db.close();
});

test('migration 004 drops categories without losing check-in history', async () => {
  const db = await freshDatabase();
  db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-1', 'Gym', 'daily')");
  db.run(
    "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-1', 'h-1', '2026-08-10', 'completed')",
  );

  // Categories are already dropped by the full migration chain; the habit
  // and its check-ins must survive.
  const habits = db.exec('SELECT COUNT(*) FROM habits')[0].values[0][0];
  const checkins = db.exec('SELECT COUNT(*) FROM checkins')[0].values[0][0];
  assert.equal(habits, 1);
  assert.equal(checkins, 1);

  db.close();
});

test('unique (habit_id, date): duplicate check-in for the same day is rejected', async () => {
  const db = await freshDatabase();
  db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-1', 'Gym', 'daily')");
  db.run(
    "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-1', 'h-1', '2026-08-10', 'completed')",
  );

  assert.throws(
    () => db.run(
      "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-2', 'h-1', '2026-08-10', 'partial')",
    ),
    /UNIQUE/,
  );

  // A different day for the same habit is fine
  db.run(
    "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-2', 'h-1', '2026-08-11', 'partial')",
  );

  db.close();
});

test('unique (habit_id, date): two habits can each check in on the same day', async () => {
  const db = await freshDatabase();
  db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-1', 'Gym', 'daily')");
  db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-2', 'Read', 'daily')");
  db.run(
    "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-1', 'h-1', '2026-08-10', 'completed')",
  );
  db.run(
    "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-2', 'h-2', '2026-08-10', 'completed')",
  );
  db.close();
});

test('unique date: duplicate daily_logs row for the same day is rejected', async () => {
  const db = await freshDatabase();
  db.run(
    "INSERT INTO daily_logs (id, date, mood, sleep_hours) VALUES ('d-1', '2026-08-10', 'good', 7.5)",
  );

  assert.throws(
    () => db.run(
      "INSERT INTO daily_logs (id, date, mood, sleep_hours) VALUES ('d-2', '2026-08-10', 'great', 8.0)",
    ),
    /UNIQUE/,
  );

  // A different date is fine
  db.run(
    "INSERT INTO daily_logs (id, date, mood, sleep_hours) VALUES ('d-2', '2026-08-11', 'great', 8.0)",
  );

  db.close();
});

test('CHECK constraints reject invalid enumerated values', async () => {
  const db = await freshDatabase();
  db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-1', 'Gym', 'daily')");

  assert.throws(
    () => db.run(
      "INSERT INTO checkins (id, habit_id, date, status) VALUES ('c-1', 'h-1', '2026-08-10', 'nope')",
    ),
    /CHECK/,
  );
  assert.throws(
    () => db.run("INSERT INTO habits (id, name, frequency_type) VALUES ('h-2', 'Bad', 'weekly')"),
    /CHECK/,
  );

  db.close();
});

