/**
 * Streak calculation logic (TICKET-009).
 *
 * Streaks are calculated on-read from the checkins table — never stored as
 * separate columns (per Technical Architecture Document §3). A streak is a
 * run of consecutive *qualifying days* on which the habit was completed or
 * partially done. Days the habit isn't scheduled for are transparently skipped
 * so they never break a streak.
 *
 * Which days are "qualifying" depends on the habit's frequency rule:
 *   daily            → every calendar day
 *   specific_days    → only the listed weekdays
 *   times_per_week   → any day (the user can complete the habit on any day
 *                       they choose, as long as they hit the weekly target)
 */

import type { Habit, Checkin, CheckinStatus, ISODate } from '../types';
import { parseISO, toISO, addDays, diffDays } from './dates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Days the habit was completed (or partially done) — these sustain a streak. */
const COMPLETING_STATUSES: ReadonlySet<CheckinStatus> = new Set([
  'completed',
  'partial',
]);

function isCompleting(status: CheckinStatus): boolean {
  return COMPLETING_STATUSES.has(status);
}

/**
 * Day-of-week index: 0 = Sunday … 6 = Saturday.
 * Matches JS Date.getDay() and the values stored in frequency_value JSON arrays.
 */
function dayOfWeek(iso: ISODate): number {
  return parseISO(iso).getDay();
}

// ---------------------------------------------------------------------------
// Qualifying-day logic (per frequency type)
// ---------------------------------------------------------------------------

/** Parse frequency_value JSON and return the relevant payload. */
function parseFrequencyValue(
  value: string | null,
): { days?: string[]; count?: number } | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as { days?: string[]; count?: number };
  } catch {
    return null;
  }
}

const DAY_TO_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Determine whether a given calendar date is a qualifying day for a habit.
 * Qualifying = the habit is scheduled to be done on this day according to its
 * frequency rule. This does NOT check whether it was actually completed — that
 * is the caller's responsibility.
 */
export function isQualifyingDay(
  habit: Habit,
  date: ISODate,
): boolean {
  switch (habit.frequency_type) {
    case 'daily':
      return true;

    case 'specific_days': {
      const parsed = parseFrequencyValue(habit.frequency_value);
      if (!parsed?.days || parsed.days.length === 0) return true; // malformed → treat as all days
      const dayIdx = dayOfWeek(date);
      return parsed.days.some((d) => DAY_TO_INDEX[d] === dayIdx);
    }

    case 'times_per_week':
      // Any day qualifies — the user can complete the habit on whichever day
      // they choose; the weekly target is about volume, not specific days.
      return true;

    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Current streak
// ---------------------------------------------------------------------------

/**
 * Calculate the current streak for a single habit.
 *
 * The algorithm walks backwards from `today` (or yesterday, if today isn't a
 * completed qualifying day) counting qualifying days on which the habit was
 * completed or partially done. Non-qualifying days (e.g. a Wednesday when the
 * habit only runs on Mon/Wed/Fri) are transparently skipped so they never
 * interrupt the count.
 *
 * @returns `{ current, best }` — both are whole numbers ≥ 0.
 */
export function calculateStreak(
  habit: Habit,
  checkins: Checkin[],
  today: ISODate,
): { current: number; best: number } {
  // Index checkins by date for O(1) lookup
  const checkinMap = new Map<ISODate, CheckinStatus>();
  for (const c of checkins) {
    checkinMap.set(c.date, c.status);
  }

  // --- Determine the reference date for current streak ---
  // If today is a qualifying day and was completed, the streak includes today.
  // If today is qualifying but not yet completed, start from yesterday so an
  // in-progress day doesn't prematurely break the streak.
  // If today isn't qualifying at all, walk backwards to the nearest qualifying day.
  let ref = parseISO(today);

  // Walk backwards to find the most recent qualifying day
  while (!isQualifyingDay(habit, toISO(ref))) {
    ref = addDays(ref, -1);
  }

  // If the most recent qualifying day (today or earlier) wasn't completed,
  // step back one more day — the streak ended before today.
  const refStatus = checkinMap.get(toISO(ref));
  if (!refStatus || !isCompleting(refStatus)) {
    ref = addDays(ref, -1);
  }

  // --- Count consecutive qualifying days with completions ---
  let current = 0;
  const cursor = new Date(ref);

  while (true) {
    const dateStr = toISO(cursor);
    if (!isQualifyingDay(habit, dateStr)) {
      cursor.setDate(cursor.getDate() - 1);
      continue; // skip non-qualifying days
    }

    const status = checkinMap.get(dateStr);
    if (status && isCompleting(status)) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // --- Best streak (longest historical run) ---
  const best = calculateBestStreak(habit, checkins);

  return { current, best };
}

// ---------------------------------------------------------------------------
// Best streak
// ---------------------------------------------------------------------------

/**
 * Scan the full checkin history for a habit and return the longest run of
 * consecutive qualifying days on which the habit was completed or partially done.
 */
export function calculateBestStreak(
  habit: Habit,
  checkins: Checkin[],
): number {
  if (checkins.length === 0) return 0;

  // Collect all qualifying dates from the checkin history that have a
  // completing status, sorted chronologically.
  const completingDates: Date[] = [];
  for (const c of checkins) {
    if (isCompleting(c.status) && isQualifyingDay(habit, c.date)) {
      completingDates.push(parseISO(c.date));
    }
  }

  if (completingDates.length === 0) return 0;

  completingDates.sort((a, b) => a.getTime() - b.getTime());

  let best = 1;
  let run = 1;

  for (let i = 1; i < completingDates.length; i++) {
    const gap = diffDays(completingDates[i - 1]!, completingDates[i]!);

    if (gap === 1) {
      // Consecutive calendar days — streak continues
      run++;
    } else if (gap > 1) {
      // There's a gap. Check whether every day in between is a non-qualifying
      // day (e.g. a Thursday when the habit runs Mon/Wed/Fri). If so, the
      // streak is unbroken; otherwise it ended.
      let allNonQualifying = true;
      let d = addDays(completingDates[i - 1]!, 1);
      const end = completingDates[i]!;
      while (d < end) {
        if (isQualifyingDay(habit, toISO(d))) {
          allNonQualifying = false;
          break;
        }
        d = addDays(d, 1);
      }

      if (allNonQualifying) {
        run++;
      } else {
        best = Math.max(best, run);
        run = 1;
      }
    }
    // gap === 0 (duplicate date) — impossible with UNIQUE constraint, skip
  }

  return Math.max(best, run);
}

// ---------------------------------------------------------------------------
// Aggregate: overall current / best streak across all habits
// ---------------------------------------------------------------------------

/**
 * Calculate per-habit streaks plus an overall current streak (longest current
 * among all active habits) and overall best streak (longest best among all
 * active habits).
 *
 * Accepts the full list of active habits, their checkins pre-fetched and
 * grouped by habit ID, and today's date.
 */
export interface StreakResult {
  /** Per-habit current streak. */
  current: number;
  /** Per-habit best streak (longest ever). */
  best: number;
}

export interface AllStreaks {
  /** Per-habit streak results, keyed by habit ID. */
  habits: Map<string, StreakResult>;
  /** Overall current streak — the longest current streak among all habits. */
  overallCurrent: number;
  /** Overall best streak — the longest best streak among all habits. */
  overallBest: number;
}

/**
 * Compute streaks for all active habits.
 *
 * @param habits       Active (non-archived) habits.
 * @param allCheckins  All check-ins for the relevant date range, pre-fetched in
 *                     a single query and passed in for efficiency. Grouped by
 *                     the caller (this function does not query the database).
 * @param today        Today's ISO date.
 */
export function calculateAllStreaks(
  habits: Habit[],
  allCheckins: Checkin[],
  today: ISODate,
): AllStreaks {
  // Group checkins by habit ID for efficient per-habit lookup
  const byHabit = new Map<string, Checkin[]>();
  for (const c of allCheckins) {
    const list = byHabit.get(c.habit_id);
    if (list) {
      list.push(c);
    } else {
      byHabit.set(c.habit_id, [c]);
    }
  }

  const habitStreaks = new Map<string, StreakResult>();
  let overallCurrent = 0;
  let overallBest = 0;

  for (const habit of habits) {
    const habitCheckins = byHabit.get(habit.id) ?? [];
    const streak = calculateStreak(habit, habitCheckins, today);

    habitStreaks.set(habit.id, streak);
    overallCurrent = Math.max(overallCurrent, streak.current);
    overallBest = Math.max(overallBest, streak.best);
  }

  return {
    habits: habitStreaks,
    overallCurrent,
    overallBest,
  };
}
