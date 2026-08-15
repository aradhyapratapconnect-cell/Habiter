import { create } from 'zustand';
import type { Habit, Checkin, CheckinStatus, ISODate } from '../types';
import type { AllStreaks } from '../utils/streaks';
import { calculateAllStreaks, isQualifyingDay } from '../utils/streaks';

// ---------------------------------------------------------------------------
// Safe API accessor
// ---------------------------------------------------------------------------

function api() {
  return typeof window !== 'undefined' && window.habiterAPI
    ? window.habiterAPI
    : null;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function getToday(): ISODate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Format year+month (0-indexed) into "YYYY-MM" for display and keys. */
export function formatMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Format a date's day number. */
export function getDayNumber(date: ISODate): number {
  return parseInt(date.split('-')[2]!, 10);
}

/** Build a Map key from habitId + date for O(1) lookups. */
export function checkinKey(habitId: string, date: ISODate): string {
  return `${habitId}:${date}`;
}

// ---------------------------------------------------------------------------
// TICKET-027: Editable-date window (today + 1-day grace)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given ISO date string represents today or yesterday
 * in the user's local timezone. Only these dates are writable; everything
 * else is read-only.
 */
export function isEditableDateISO(dateStr: ISODate): boolean {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const target = new Date(y, m - 1, d);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return target.getTime() === today.getTime() || target.getTime() === yesterday.getTime();
}

// ---------------------------------------------------------------------------
// Status cycling (TICKET-008: click cycles through statuses)
// ---------------------------------------------------------------------------

const STATUS_CYCLE: CheckinStatus[] = [
  'completed',
  'partial',
  'skipped',
  'not_done',
];

/**
 * Given the current status, return the next status in the cycle.
 * If the cell has no check-in yet (null/undefined), defaults to "completed".
 */
export function nextStatus(
  current: CheckinStatus | null | undefined,
): CheckinStatus {
  if (!current || current === 'not_done') return STATUS_CYCLE[0]!;
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1 || idx === STATUS_CYCLE.length - 1) return 'not_done';
  return STATUS_CYCLE[idx + 1]!;
}

// ---------------------------------------------------------------------------
// Monthly stats (TICKET-011: Overall Progress & Stats Row)
// ---------------------------------------------------------------------------

export interface MonthlyStats {
  /** Total qualifying habit-days in the current month (habits × qualifying days). */
  totalDays: number;
  /** Habit-days marked completed or partial. */
  completedDays: number;
  /** Habit-days remaining (total - completed). */
  remainingDays: number;
  /** Completion percentage (0–100), rounded to nearest integer. */
  completionPct: number;
  /** Breakdown by individual status for the monthly progress pie chart. */
  statusBreakdown: {
    completed: number;
    partial: number;
    skipped: number;
    not_started: number;
  };
}

/**
 * Compute monthly completion stats based on each habit's frequency rule.
 *
 * "Total trackable habit-days" = sum over all active habits of the number of
 * qualifying days in the current month. A "completed day" is one where the
 * habit has a checkin with status "completed" or "partial".
 */
function computeMonthlyStats(
  habits: Habit[],
  checkins: Map<string, Checkin>,
  year: number,
  month: number,
): MonthlyStats {
  const activeHabits = habits.filter((h) => h.is_archived === 0);
  const daysInMonth = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  let totalDays = 0;
  let completedDays = 0;
  const breakdown = { completed: 0, partial: 0, skipped: 0, not_started: 0 };

  for (const habit of activeHabits) {
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}` as ISODate;

      if (!isQualifyingDay(habit, dateStr)) continue;

      totalDays++;

      const checkin = checkins.get(checkinKey(habit.id, dateStr));
      if (checkin) {
        switch (checkin.status) {
          case 'completed':
            completedDays++;
            breakdown.completed++;
            break;
          case 'partial':
            completedDays++;
            breakdown.partial++;
            break;
          case 'skipped':
            breakdown.skipped++;
            break;
          default:
            breakdown.not_started++;
            break;
        }
      } else {
        breakdown.not_started++;
      }
    }
  }

  const remainingDays = totalDays - completedDays;
  const completionPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  return { totalDays, completedDays, remainingDays, completionPct, statusBreakdown: breakdown };
}

// ---------------------------------------------------------------------------
// Daily progress (TICKET-013: Daily Progress Overview bar chart)
// ---------------------------------------------------------------------------

export interface DayProgress {
  /** Day of the month (1–31). */
  day: number;
  /** ISO date string, e.g. "2026-08-05". */
  date: ISODate;
  /** Completion percentage for this day (0–100). */
  pct: number;
}

/**
 * Compute per-day completion percentages for the current month.
 * For each calendar day, counts qualifying habits and how many were completed.
 * Returns an array of { day, date, pct } for charting.
 */
export function computeDailyProgress(
  habits: Habit[],
  checkins: Map<string, Checkin>,
  year: number,
  month: number,
): DayProgress[] {
  const activeHabits = habits.filter((h) => h.is_archived === 0);
  const daysInMonth = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const result: DayProgress[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}` as ISODate;
    let qualifying = 0;
    let completed = 0;

    for (const habit of activeHabits) {
      if (!isQualifyingDay(habit, dateStr)) continue;
      qualifying++;
      const checkin = checkins.get(checkinKey(habit.id, dateStr));
      if (checkin && (checkin.status === 'completed' || checkin.status === 'partial')) {
        completed++;
      }
    }

    const pct = qualifying > 0 ? Math.round((completed / qualifying) * 100) : 0;
    result.push({ day: d, date: dateStr, pct });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Weekly progress (TICKET-014: Weekly Progress View)
// ---------------------------------------------------------------------------

const DOW_ABBREV = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface WeekDayProgress {
  /** Day-of-week abbreviation. */
  day: string;
  /** ISO date string. */
  date: ISODate;
  /** Completion percentage for this day (0–100). */
  pct: number;
}

export interface WeekProgress {
  /** Week label, e.g. "Week 1". */
  label: string;
  /** Per-day-of-week progress (Mon–Sun). Empty array for days past month end. */
  days: WeekDayProgress[];
  /** Overall completion percentage for this week (0–100). */
  pct: number;
}

/**
 * Group calendar days into 7-day buckets (Week1 = days 1–7, Week2 = 8–14, …)
 * and compute per-day and per-week completion percentages.
 *
 * Partial weeks at the end of the month have fewer day entries but still
 * show an accurate week-level percentage based on the days that exist.
 */
export function computeWeeklyProgress(
  habits: Habit[],
  checkins: Map<string, Checkin>,
  year: number,
  month: number,
): WeekProgress[] {
  const activeHabits = habits.filter((h) => h.is_archived === 0);
  const daysInMonth = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const weeks: WeekProgress[] = [];

  // Group into 7-day buckets: days 1-7, 8-14, 15-21, 22-28, 29-31
  for (let weekStart = 1; weekStart <= daysInMonth; weekStart += 7) {
    const weekEnd = Math.min(weekStart + 6, daysInMonth);
    const weekDays: WeekDayProgress[] = [];
    let weekQualifying = 0;
    let weekCompleted = 0;

    for (let d = weekStart; d <= weekEnd; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}` as ISODate;
      const dow = (d - 1) % 7; //0=Mon,1=Tue,...,6=Sun

      let dayQualifying = 0;
      let dayCompleted = 0;

      for (const habit of activeHabits) {
        if (!isQualifyingDay(habit, dateStr)) continue;
        dayQualifying++;
        const checkin = checkins.get(checkinKey(habit.id, dateStr));
        if (checkin && (checkin.status === 'completed' || checkin.status === 'partial')) {
          dayCompleted++;
        }
      }

      const dayPct = dayQualifying > 0 ? Math.round((dayCompleted / dayQualifying) * 100) : 0;
      weekDays.push({ day: DOW_ABBREV[dow]!, date: dateStr, pct: dayPct });
      weekQualifying += dayQualifying;
      weekCompleted += dayCompleted;
    }

    const weekPct = weekQualifying > 0 ? Math.round((weekCompleted / weekQualifying) * 100) : 0;
    weeks.push({
      label: `Week ${weeks.length + 1}`,
      days: weekDays,
      pct: weekPct,
    });
  }

  return weeks;
}

// ---------------------------------------------------------------------------
// Top habits ranking (TICKET-015: Top Habits This Month)
// ---------------------------------------------------------------------------

export interface TopHabit {
  /** Habit data. */
  habit: Habit;
  /** Completion percentage for this habit in the current month (0–100). */
  pct: number;
}

/**
 * Rank active habits by completion percentage for the current month.
 * Returns the top N habits, sorted highest-first. Ties are broken
 * alphabetically by habit name (case-insensitive).
 */
export function computeTopHabits(
  habits: Habit[],
  checkins: Map<string, Checkin>,
  year: number,
  month: number,
  limit = 5,
): TopHabit[] {
  const activeHabits = habits.filter((h) => h.is_archived === 0);
  const daysInMonth = getDaysInMonth(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const scored: TopHabit[] = activeHabits.map((habit) => {
    let qualifying = 0;
    let completed = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}` as ISODate;
      if (!isQualifyingDay(habit, dateStr)) continue;
      qualifying++;
      const checkin = checkins.get(checkinKey(habit.id, dateStr));
      if (checkin && (checkin.status === 'completed' || checkin.status === 'partial')) {
        completed++;
      }
    }

    const pct = qualifying > 0 ? Math.round((completed / qualifying) * 100) : 0;
    return { habit, pct };
  });

  // Sort: highest completion % first, ties broken alphabetically
  scored.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.habit.name.localeCompare(b.habit.name, undefined, { sensitivity: 'base' });
  });

  return scored.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CheckinsState {
  /** Current year (local time). */
  year: number;
  /** Current month, 0-indexed (local time). */
  month: number;

  habits: Habit[];
  habitsLoading: boolean;

  /**
   * Map of "habitId:date" → Checkin for the current month.
   * Only contains rows that exist in the database — absent keys mean
   * the cell has no check-in (status = not_done / empty).
   */
  checkins: Map<string, Checkin>;
  checkinsLoading: boolean;

  /** Computed streak results for all active habits + overall. */
  streaks: AllStreaks;
  streaksLoading: boolean;

  /** Computed monthly completion stats for the current month. */
  stats: MonthlyStats;

  /** Habit IDs that were seeded on first launch (TICKET-026). */
  seededIds: Set<string>;

  /** Load active (non-archived) habits. */
  loadHabits: () => Promise<void>;

  /** Load all check-ins for the current month from the database. */
  loadCheckins: () => Promise<void>;

  /**
   * Toggle a check-in: reads current status, computes next, and persists.
   * Optimistically updates the local Map so the UI responds instantly.
   */
  toggleCheckin: (habitId: string, date: ISODate) => Promise<void>;

  /** Navigate to the previous month. */
  prevMonth: () => void;

  /** Navigate to the next month. */
  nextMonth: () => void;

  /** Jump directly to a specific year+month. */
  setMonth: (year: number, month: number) => void;

  /**
   * Recompute streaks for all active habits. Fetches a wide date range
   * (12 months back from current month) to ensure best-streak calculations
   * have enough history. Called automatically after data loads and toggles.
   */
  computeStreaks: () => Promise<void>;

  /** Recompute monthly completion stats from current state. */
  computeStats: () => void;

  /** Load the list of seeded habit IDs from the settings table (TICKET-026). */
  loadSeededIds: () => Promise<void>;
}

export const useCheckinsStore = create<CheckinsState>((set, get) => {
  const now = new Date();

  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    habits: [],
    habitsLoading: false,
    checkins: new Map(),
    checkinsLoading: false,
    streaks: { habits: new Map(), overallCurrent: 0, overallBest: 0 },
    streaksLoading: false,
    stats: { totalDays: 0, completedDays: 0, remainingDays: 0, completionPct: 0, statusBreakdown: { completed: 0, partial: 0, skipped: 0, not_started: 0 } },
    seededIds: new Set(),

    loadHabits: async () => {
      const a = api();
      if (!a) return;
      set({ habitsLoading: true });
      try {
        const habits = await a.habits.list();
        set({ habits });
        // Recompute streaks and stats after loading new habits
        get().computeStreaks();
        get().computeStats();
        // TICKET-026: Load seeded habit IDs once on first load
        if (get().seededIds.size === 0) {
          get().loadSeededIds();
        }
      } catch (err) {
        console.error('[checkinsStore] Failed to load habits:', err);
      } finally {
        set({ habitsLoading: false });
      }
    },

    loadCheckins: async () => {
      const a = api();
      if (!a) return;
      const { year, month } = get();
      set({ checkinsLoading: true });
      try {
        const startDate: ISODate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = getDaysInMonth(year, month);
        const endDate: ISODate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const rows = await a.checkins.list({ startDate, endDate });
        const map = new Map<string, Checkin>();
        for (const row of rows) {
          map.set(checkinKey(row.habit_id, row.date), row);
        }
        set({ checkins: map });
        // Recompute streaks and stats after loading new check-in data
        get().computeStreaks();
        get().computeStats();
      } catch (err) {
        console.error('[checkinsStore] Failed to load checkins:', err);
      } finally {
        set({ checkinsLoading: false });
      }
    },

    toggleCheckin: async (habitId, date) => {
      const a = api();
      if (!a) return;

      const key = checkinKey(habitId, date);
      const current = get().checkins.get(key);
      const newStatus = nextStatus(current?.status);

      // Optimistic update
      set((s) => {
        const next = new Map(s.checkins);
        // If cycling back to not_done, remove the row (cell shows empty)
        if (newStatus === 'not_done') {
          next.delete(key);
        } else {
          next.set(key, {
            id: current?.id ?? '',
            habit_id: habitId,
            date,
            status: newStatus,
            updated_at: new Date().toISOString(),
          });
        }
        return { checkins: next };
      });

      try {
        if (newStatus === 'not_done') {
          // Remove the check-in from the database
          await a.checkins.delete(habitId, date);
        } else {
          await a.checkins.set(habitId, date, newStatus);
        }
        // Recompute streaks and stats after any check-in change
        get().computeStreaks();
        get().computeStats();
      } catch (err) {
        console.error('[checkinsStore] Toggle failed:', err);
        // Revert optimistic update by reloading
        get().loadCheckins();
      }
    },

    prevMonth: () => {
      set((s) => {
        const newMonth = s.month - 1;
        if (newMonth < 0) return { year: s.year - 1, month: 11 };
        return { month: newMonth };
      });
      get().loadCheckins();
    },

    nextMonth: () => {
      set((s) => {
        const newMonth = s.month + 1;
        if (newMonth > 11) return { year: s.year + 1, month: 0 };
        return { month: newMonth };
      });
      get().loadCheckins();
    },

    setMonth: (year, month) => {
      set({ year, month });
      get().loadCheckins();
    },

    computeStreaks: async () => {
      const a = api();
      if (!a) return;
      const { habits, year, month } = get();
      const activeHabits = habits.filter((h) => h.is_archived === 0);
      if (activeHabits.length === 0) {
        set({ streaks: { habits: new Map(), overallCurrent: 0, overallBest: 0 } });
        return;
      }

      set({ streaksLoading: true });
      try {
        // Fetch 12 months of history for accurate best-streak calculation
        const startMonth = month - 11;
        const startYear = startMonth < 0 ? year - 1 : year;
        const adjustedStartMonth = ((startMonth % 12) + 12) % 12;
        const startDate: ISODate = `${startYear}-${String(adjustedStartMonth + 1).padStart(2, '0')}-01`;

        const lastDay = getDaysInMonth(year, month);
        const endDate: ISODate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const allCheckins = await a.checkins.list({ startDate, endDate });
        const today = getToday();
        const result = calculateAllStreaks(activeHabits, allCheckins, today);
        set({ streaks: result });
      } catch (err) {
        console.error('[checkinsStore] computeStreaks failed:', err);
      } finally {
        set({ streaksLoading: false });
      }
    },

    computeStats: () => {
      const { habits, checkins, year, month } = get();
      const stats = computeMonthlyStats(habits, checkins, year, month);
      set({ stats });
    },

    loadSeededIds: async () => {
      const a = api();
      if (!a) return;
      try {
        const raw = await a.settings.get('_seeded_habit_ids');
        if (raw) {
          const ids: string[] = JSON.parse(raw);
          set({ seededIds: new Set(ids) });
        }
      } catch (err) {
        console.error('[checkinsStore] Failed to load seeded IDs:', err);
      }
    },
  };
});
