/**
 * Seed example data on first launch (TICKET-026).
 *
 * When the habits table is empty (fresh install), inserts a small set of
 * example habits with categories so the user sees a populated dashboard
 * instead of a blank grid. The seeded habit IDs are persisted in the
 * settings table so the renderer can flag them with an "Example" badge.
 *
 * This runs once — subsequent launches skip seeding because the habits
 * table is no longer empty.
 */

import { randomUUID } from 'node:crypto';
import type { Database } from 'sql.js';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

interface SeedCategory {
  id: string;
  name: string;
  color: string;
}

interface SeedHabit {
  id: string;
  name: string;
  icon: string;
  category_id: string | null;
  frequency_type: string;
  frequency_value: string | null;
}

const SEED_CATEGORIES: SeedCategory[] = [
  { id: randomUUID(), name: 'Health', color: '#22C55E' },
  { id: randomUUID(), name: 'Learning', color: '#60A5FA' },
  { id: randomUUID(), name: 'Mindfulness', color: '#A78BFA' },
];

const SEED_HABITS: SeedHabit[] = [
  {
    id: randomUUID(),
    name: 'Wake up at 05:00',
    icon: '⏰',
    category_id: null,
    frequency_type: 'daily',
    frequency_value: null,
  },
  {
    id: randomUUID(),
    name: 'Gym',
    icon: '🏋️',
    category_id: SEED_CATEGORIES[0]!.id,
    frequency_type: 'times_per_week',
    frequency_value: '{"count":3}',
  },
  {
    id: randomUUID(),
    name: 'Reading / Learning',
    icon: '📖',
    category_id: SEED_CATEGORIES[1]!.id,
    frequency_type: 'specific_days',
    frequency_value: '["mon","tue","wed","thu","fri"]',
  },
  {
    id: randomUUID(),
    name: 'Meditation',
    icon: '🧘',
    category_id: SEED_CATEGORIES[2]!.id,
    frequency_type: 'daily',
    frequency_value: null,
  },
  {
    id: randomUUID(),
    name: 'Cold Shower',
    icon: '🚿',
    category_id: SEED_CATEGORIES[0]!.id,
    frequency_type: 'daily',
    frequency_value: null,
  },
];

// Settings key used to persist the list of seeded habit IDs so the
// renderer can identify and badge them.
export const SEEDED_IDS_KEY = '_seeded_habit_ids';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seed example data if the database is fresh (no habits exist).
 *
 * @returns The list of seeded habit IDs, or an empty array if seeding
 *          was skipped (database already has habits).
 */
export function seedIfEmpty(db: Database): string[] {
  // Check if any habits already exist
  const result = db.exec('SELECT COUNT(*) as cnt FROM habits');
  const count =
    result.length > 0 && result[0]!.values.length > 0
      ? (result[0]!.values[0]![0] as number)
      : 0;

  if (count > 0) {
    // Database already has habits — skip seeding
    return [];
  }

  console.log('[Seed] Database is empty — seeding example data…');

  // Insert seed categories
  for (const cat of SEED_CATEGORIES) {
    db.run(
      'INSERT INTO categories (id, name, color) VALUES (?, ?, ?)',
      [cat.id, cat.name, cat.color],
    );
  }
  console.log(`[Seed] Inserted ${SEED_CATEGORIES.length} example categories.`);

  // Insert seed habits
  for (const habit of SEED_HABITS) {
    db.run(
      `INSERT INTO habits (id, name, icon, category_id, frequency_type, frequency_value)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [habit.id, habit.name, habit.icon, habit.category_id, habit.frequency_type, habit.frequency_value],
    );
  }
  console.log(`[Seed] Inserted ${SEED_HABITS.length} example habits.`);

  // Persist the seeded habit IDs in settings so the renderer can flag them
  const ids = SEED_HABITS.map((h) => h.id);
  db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SEEDED_IDS_KEY, JSON.stringify(ids)],
  );
  console.log(`[Seed] Saved seeded habit IDs to settings.`);

  return ids;
}
