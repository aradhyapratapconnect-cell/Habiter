// Shared TypeScript types for Habiter.
// These are the single source of truth for the database entity shapes and the
// renderer <-> main process API (window.habiterAPI), imported by both sides:
//   * electron/ (main process + preload) imports the HabiterAPI contract
//   * src/ (renderer) imports the entity/input types and the window declaration
//
// Entities mirror electron/db/migrations/002_core_schema.sql exactly.

// ---------------------------------------------------------------------------
// Enumerated values (enforced by CHECK constraints in the schema)
// ---------------------------------------------------------------------------

export type FrequencyType = 'daily' | 'specific_days' | 'times_per_week';

export type CheckinStatus = 'completed' | 'partial' | 'not_done' | 'skipped';

export type Mood = 'great' | 'good' | 'neutral' | 'bad' | 'terrible';

// SQLite boolean — stored as INTEGER 0/1.
export type SqliteBool = 0 | 1;

// ISO calendar date, e.g. "2026-08-10". No timezone, per the Security doc.
export type ISODate = string;

// ---------------------------------------------------------------------------
// Entities (rows as stored in the database)
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string | null;
  category_id: string | null;
  frequency_type: FrequencyType;
  frequency_value: string | null; // JSON, e.g. '["mon","wed","fri"]' or '{"count":3}'
  reminder_time: string | null; // local time "HH:MM"
  is_archived: SqliteBool;
  sort_order: number;
  created_at: string;
}

export interface Checkin {
  id: string;
  habit_id: string;
  date: ISODate;
  status: CheckinStatus;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  date: ISODate;
  mood: Mood | null;
  sleep_hours: number | null;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Input types — what the renderer sends to create/update. IDs and timestamps
// are generated in the main process, so they are never accepted as input.
// ---------------------------------------------------------------------------

export interface HabitCreateInput {
  name: string;
  icon?: string | null;
  category_id?: string | null;
  frequency_type: FrequencyType;
  frequency_value?: string | null;
  reminder_time?: string | null;
  sort_order?: number;
}

/** All editable habit fields. `undefined` = leave unchanged, `null` = clear. */
export interface HabitUpdateInput {
  name?: string;
  icon?: string | null;
  category_id?: string | null;
  frequency_type?: FrequencyType;
  frequency_value?: string | null;
  reminder_time?: string | null;
  is_archived?: SqliteBool;
  sort_order?: number;
}

export interface HabitListOptions {
  /** Include archived habits in the result (default: false). */
  includeArchived?: boolean;
}

export interface CategoryCreateInput {
  name: string;
  color?: string | null;
}

export interface CategoryUpdateInput {
  name?: string;
  color?: string | null;
}

/** Optional filters for checkins.list(). `startDate`/`endDate` are inclusive. */
export interface CheckinFilter {
  habitId?: string;
  startDate?: ISODate;
  endDate?: ISODate;
}

export interface DailyLogInput {
  /** `undefined` = leave unchanged, `null` = clear. */
  mood?: Mood | null;
  sleepHours?: number | null;
}

// ---------------------------------------------------------------------------
// The renderer <-> main process API. Exposed on window.habiterAPI via the
// preload contextBridge. Every method resolves to the matching ipcMain.handle
// channel in electron/ipc/handlers.ts.
// ---------------------------------------------------------------------------

export interface HabiterAPI {
  habits: {
    create(input: HabitCreateInput): Promise<Habit>;
    list(options?: HabitListOptions): Promise<Habit[]>;
    get(id: string): Promise<Habit | null>;
    update(id: string, changes: HabitUpdateInput): Promise<Habit>;
    /** Permanently deletes the habit and (via FK cascade) its check-ins. */
    delete(id: string): Promise<void>;
  };
  categories: {
    create(input: CategoryCreateInput): Promise<Category>;
    list(): Promise<Category[]>;
    update(id: string, changes: CategoryUpdateInput): Promise<Category>;
    delete(id: string): Promise<void>;
  };
  checkins: {
    /** Create or update the status for a habit on a date (upsert). */
    set(habitId: string, date: ISODate, status: CheckinStatus): Promise<Checkin>;
    get(habitId: string, date: ISODate): Promise<Checkin | null>;
    list(filter?: CheckinFilter): Promise<Checkin[]>;
    delete(habitId: string, date: ISODate): Promise<void>;
  };
  dailyLogs: {
    get(date: ISODate): Promise<DailyLog | null>;
    /** Create or update mood/sleep for a date (upsert). */
    set(date: ISODate, input: DailyLogInput): Promise<DailyLog>;
    list(): Promise<DailyLog[]>;
    delete(date: ISODate): Promise<void>;
  };
  settings: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  export: {
    /** Export all data to a user-chosen JSON file. Returns the file path or null if cancelled. */
    json(): Promise<{ path: string | null }>;
    /** Export all data to a user-chosen CSV file. Returns the file path or null if cancelled. */
    csv(): Promise<{ path: string | null }>;
  };
  import: {
    /**
     * Import data from a user-chosen JSON file. Validates structure, data types,
     * and foreign key integrity before writing. Returns success/failure with message.
     */
    json(): Promise<{ success: boolean; message: string }>;
  };
}
