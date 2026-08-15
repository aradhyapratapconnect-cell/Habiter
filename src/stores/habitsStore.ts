import { create } from 'zustand';
import type {
  Habit,
  HabitCreateInput,
  HabitUpdateInput,
} from '../types';
import { useCheckinsStore } from './checkinsStore';

// ---------------------------------------------------------------------------
// Safe API accessor — returns null when running outside Electron (browser dev)
// ---------------------------------------------------------------------------

function api() {
  return typeof window !== 'undefined' && window.habiterAPI
    ? window.habiterAPI
    : null;
}

/**
 * Refresh the daily tracker grid after a habit mutation.
 *
 * The grid reads its own copy of habits from useCheckinsStore, which loads
 * once on mount. Without this, a habit added/edited/deleted/archived in the
 * My Habits list would not show up in the grid until the app restarted.
 * Re-loading also recomputes streaks and stats so everything stays live.
 */
function refreshGridHabits() {
  useCheckinsStore.getState().loadHabits();
}

// ---------------------------------------------------------------------------
// Habit CRUD state
// ---------------------------------------------------------------------------

interface HabitsState {
  habits: Habit[];
  loading: boolean;

  loadHabits: () => Promise<void>;
  createHabit: (input: HabitCreateInput) => Promise<Habit>;
  updateHabit: (id: string, changes: HabitUpdateInput) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  unarchiveHabit: (id: string) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
}

export const useHabitsStore = create<HabitsState>((set, _get) => ({
  habits: [],
  loading: false,

  loadHabits: async () => {
    const a = api();
    if (!a) return;
    set({ loading: true });
    try {
      const habits = await a.habits.list({ includeArchived: true });
      set({ habits });
    } catch (err) {
      console.error('[habitsStore] Failed to load habits:', err);
    } finally {
      set({ loading: false });
    }
  },

  createHabit: async (input) => {
    const a = api();
    if (!a) throw new Error('API not available');
    const habit = await a.habits.create(input);
    set((s) => ({ habits: [...s.habits, habit] }));
    refreshGridHabits();
    return habit;
  },

  updateHabit: async (id, changes) => {
    const a = api();
    if (!a) throw new Error('API not available');
    const updated = await a.habits.update(id, changes);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? updated : h)),
    }));
    refreshGridHabits();
  },

  archiveHabit: async (id) => {
    const a = api();
    if (!a) throw new Error('API not available');
    await a.habits.update(id, { is_archived: 1 });
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, is_archived: 1 } : h,
      ),
    }));
    refreshGridHabits();
  },

  unarchiveHabit: async (id) => {
    const a = api();
    if (!a) throw new Error('API not available');
    await a.habits.update(id, { is_archived: 0 });
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? { ...h, is_archived: 0 } : h,
      ),
    }));
    refreshGridHabits();
  },

  deleteHabit: async (id) => {
    const a = api();
    if (!a) throw new Error('API not available');
    await a.habits.delete(id);
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
    refreshGridHabits();
  },
}));

// ---------------------------------------------------------------------------
// Habit modal state (add / edit / archived-view)
// ---------------------------------------------------------------------------

export type HabitModalMode = 'new' | 'edit' | 'archived';

interface HabitFormState {
  isOpen: boolean;
  mode: HabitModalMode;
  editingHabit: Habit | null;

  openNew: () => void;
  openEdit: (habit: Habit) => void;
  openArchived: (habit: Habit) => void;
  close: () => void;
}

export const useHabitModalStore = create<HabitFormState>((set) => ({
  isOpen: false,
  mode: 'new',
  editingHabit: null,

  openNew: () => set({ isOpen: true, mode: 'new', editingHabit: null }),
  openEdit: (habit) => set({ isOpen: true, mode: 'edit', editingHabit: habit }),
  openArchived: (habit) => set({ isOpen: true, mode: 'archived', editingHabit: habit }),
  close: () => set({ isOpen: false, editingHabit: null }),
}));

// ---------------------------------------------------------------------------
// Confirm modal state (delete / archive confirmation)
// ---------------------------------------------------------------------------

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmInputPlaceholder: string;
  requiresInput: boolean;
  onConfirm: () => void;

  open: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    confirmInputPlaceholder?: string;
    requiresInput?: boolean;
    onConfirm: () => void;
  }) => void;
  close: () => void;
}

export const useConfirmModalStore = create<ConfirmModalState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  confirmInputPlaceholder: '',
  requiresInput: false,
  onConfirm: () => {},

  open: (opts) =>
    set({
      isOpen: true,
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      confirmInputPlaceholder: opts.confirmInputPlaceholder ?? '',
      requiresInput: opts.requiresInput ?? false,
      onConfirm: opts.onConfirm,
    }),
  close: () => set({ isOpen: false }),
}));
