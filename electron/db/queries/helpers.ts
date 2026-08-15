// Small helpers over the sql.js Database API.
//
// sql.js exposes `exec()` (multi-statement, returns {columns, values}[]) and
// `run()` (single statement, no rows). These helpers wrap exec to return rows
// as plain objects, and provide a typed execute() for writes. All query
// functions in this directory take the Database as their first argument so
// they can be unit-tested against an in-memory database without Electron.

import type { Database } from 'sql.js';

/** A row returned from the database, keyed by column name. */
export type Row = Record<string, string | number | null>;

/**
 * Run a SELECT (or any statement) and return all result rows as objects.
 * Uses exec() with bound parameters; every statement is a single statement.
 */
export function queryAll(
  db: Database,
  sql: string,
  params: (string | number | null)[] = [],
): Row[] {
  const results = db.exec(sql, params);
  if (results.length === 0) return [];

  const { columns, values } = results[0]!;
  return values.map((row) => {
    const obj: Row = {};
    columns.forEach((column, index) => {
      obj[column] = row[index] ?? null;
    });
    return obj;
  });
}

/** Run a query that is expected to return at most one row. */
export function queryOne(
  db: Database,
  sql: string,
  params: (string | number | null)[] = [],
): Row | null {
  return queryAll(db, sql, params)[0] ?? null;
}

/** Run a write statement (INSERT/UPDATE/DELETE). Throws on constraint violations. */
export function execute(
  db: Database,
  sql: string,
  params: (string | number | null)[] = [],
): void {
  db.run(sql, params);
}
