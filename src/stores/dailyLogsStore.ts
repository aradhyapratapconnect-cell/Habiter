import { create } from 'zustand';
import type { Mood, ISODate, DailyLog } from '../types';

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

export function getTodayISO(): ISODate {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(date: ISODate, days: number): ISODate {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDisplayDate(date: ISODate): string {
  const d = new Date(date);
  const day = d.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
          ? 'rd'
          : 'th';
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

// ---------------------------------------------------------------------------
// Mood configuration
// ---------------------------------------------------------------------------

export const MOOD_OPTIONS: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'great', emoji: '😄', label: 'Great' },
  { mood: 'good', emoji: '🙂', label: 'Good' },
  { mood: 'neutral', emoji: '😐', label: 'Neutral' },
  { mood: 'bad', emoji: '😔', label: 'Bad' },
  { mood: 'terrible', emoji: '😫', label: 'Terrible' },
];

export function moodToEmoji(mood: Mood | null): string {
  if (!mood) return '';
  return MOOD_OPTIONS.find((m) => m.mood === mood)?.emoji ?? '';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DailyLogsState {
  /** Currently viewed date. */
  selectedDate: ISODate;

  /** The daily log for the selected date (null if not yet logged). */
  currentLog: DailyLog | null;

  /** Loading state. */
  loading: boolean;

  /** Whether the edit popover is open. */
  isEditing: boolean;

  /** Navigate to the previous day. */
  prevDay: () => void;

  /** Navigate to the next day. */
  nextDay: () => void;

  /** Jump to a specific date. */
  setDate: (date: ISODate) => void;

  /** Load the daily log for the currently selected date. */
  loadLog: () => Promise<void>;

  /** Set the mood for the selected date (upserts). */
  setMood: (mood: Mood | null) => Promise<void>;

  /** Set sleep hours for the selected date (upserts). */
  setSleep: (hours: number | null) => Promise<void>;

  /** Open/close the edit popover. */
  openEditor: () => void;
  closeEditor: () => void;
}

export const useDailyLogsStore = create<DailyLogsState>((set, get) => ({
  selectedDate: getTodayISO(),
  currentLog: null,
  loading: false,
  isEditing: false,

  prevDay: () => {
    set((s) => ({ selectedDate: addDaysISO(s.selectedDate, -1) }));
    get().loadLog();
  },

  nextDay: () => {
    set((s) => ({ selectedDate: addDaysISO(s.selectedDate, 1) }));
    get().loadLog();
  },

  setDate: (date) => {
    set({ selectedDate: date });
    get().loadLog();
  },

  loadLog: async () => {
    const a = api();
    if (!a) return;
    const { selectedDate } = get();
    set({ loading: true });
    try {
      const log = await a.dailyLogs.get(selectedDate);
      set({ currentLog: log });
    } catch (err) {
      console.error('[dailyLogsStore] Failed to load log:', err);
    } finally {
      set({ loading: false });
    }
  },

  setMood: async (mood) => {
    const a = api();
    if (!a) return;
    const { selectedDate } = get();
    try {
      const updated = await a.dailyLogs.set(selectedDate, { mood });
      set({ currentLog: updated });
    } catch (err) {
      console.error('[dailyLogsStore] Failed to set mood:', err);
      // Reload to revert
      const log = await a.dailyLogs.get(selectedDate);
      set({ currentLog: log });
    }
  },

  setSleep: async (hours) => {
    const a = api();
    if (!a) return;
    const { selectedDate } = get();
    try {
      const updated = await a.dailyLogs.set(selectedDate, { sleepHours: hours });
      set({ currentLog: updated });
    } catch (err) {
      console.error('[dailyLogsStore] Failed to set sleep:', err);
      const log = await a.dailyLogs.get(selectedDate);
      set({ currentLog: log });
    }
  },

  openEditor: () => set({ isEditing: true }),
  closeEditor: () => set({ isEditing: false }),
}));
