// CRUD queries for the categories table.
// All functions take the Database as their first argument (see helpers.ts).

import { randomUUID } from 'node:crypto';
import type { Database } from 'sql.js';
import type { Category, CategoryCreateInput, CategoryUpdateInput } from '../../../src/types/index.js';
import { queryAll, queryOne, execute } from './helpers.js';

const COLUMNS = 'id, name, color, created_at';

export function listCategories(db: Database): Category[] {
  return queryAll(db, `SELECT ${COLUMNS} FROM categories ORDER BY name COLLATE NOCASE, created_at`) as unknown as Category[];
}

export function getCategory(db: Database, id: string): Category | null {
  const row = queryOne(db, `SELECT ${COLUMNS} FROM categories WHERE id = ?`, [id]);
  return row ? (row as unknown as Category) : null;
}

export function createCategory(db: Database, input: CategoryCreateInput): Category {
  const id = randomUUID();
  execute(
    db,
    'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)',
    [id, input.name, input.color ?? null],
  );
  const created = getCategory(db, id);
  if (!created) throw new Error('Failed to create category');
  return created;
}

const UPDATABLE = ['name', 'color'] as const;

export function updateCategory(
  db: Database,
  id: string,
  changes: CategoryUpdateInput,
): Category {
  const keys = UPDATABLE.filter((key) => changes[key] !== undefined);
  if (keys.length > 0) {
    const assignments = keys.map((key) => `${key} = ?`).join(', ');
    const values = keys.map((key) => changes[key] ?? null);
    execute(db, `UPDATE categories SET ${assignments} WHERE id = ?`, [...values, id]);
  }
  const updated = getCategory(db, id);
  if (!updated) throw new Error(`Category "${id}" not found`);
  return updated;
}

/**
 * Delete a category. Habits referencing it have category_id set to NULL via the
 * FK's ON DELETE SET NULL — the habits and their history are preserved.
 */
export function deleteCategory(db: Database, id: string): void {
  execute(db, 'DELETE FROM categories WHERE id = ?', [id]);
}
