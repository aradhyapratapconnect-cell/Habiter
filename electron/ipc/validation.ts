// Input validation for the IPC boundary.
//
// The renderer is treated as untrusted input (per the Security doc's import
// guidance, the same discipline applies to any IPC payload). These guards
// reject malformed input with a clear, specific message BEFORE it reaches the
// database, so a buggy or malicious renderer can't write junk rows. The
// database CHECK/UNIQUE constraints remain the structural backstop.
//
// Every validator takes `unknown` (IPC arguments arrive untyped over the wire)
// and uses an `asserts ... is ...` signature so handlers get narrowing for free.

import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CheckinStatus,
  DailyLogInput,
  FrequencyType,
  HabitCreateInput,
  HabitUpdateInput,
  Mood,
} from '../../src/types/index.js';

const FREQUENCY_TYPES: FrequencyType[] = ['daily', 'specific_days', 'times_per_week'];
const CHECKIN_STATUSES: CheckinStatus[] = ['completed', 'partial', 'not_done', 'skipped'];
const MOODS: Mood[] = ['great', 'good', 'neutral', 'bad', 'terrible'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

type RecordInput = Record<string, unknown>;

export function assertId(value: unknown, label = 'id'): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertDate(value: unknown, label = 'date'): asserts value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new Error(`${label} must be a date in YYYY-MM-DD format`);
  }
}

export function assertCheckinStatus(status: unknown): asserts status is CheckinStatus {
  if (typeof status !== 'string' || !CHECKIN_STATUSES.includes(status as CheckinStatus)) {
    throw new Error(`status must be one of: ${CHECKIN_STATUSES.join(', ')}`);
  }
}

function assertOptionalString(
  value: unknown,
  label: string,
  options?: { allowNull: true; pattern?: RegExp },
): void {
  if (value === undefined || (options?.allowNull && value === null)) return;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  if (options?.pattern && !options.pattern.test(value)) {
    throw new Error(`${label} has an invalid format`);
  }
}

function assertOptionalNumber(value: unknown, label: string, min: number, max: number): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`);
  }
}

export function validateHabitCreate(input: unknown): asserts input is HabitCreateInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Habit payload must be an object');
  }
  const obj = input as RecordInput;

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new Error('Habit name is required');
  }
  if (obj.name.length > 200) {
    throw new Error('Habit name must be 200 characters or fewer');
  }

  const frequencyType = obj.frequency_type;
  if (typeof frequencyType !== 'string' || !FREQUENCY_TYPES.includes(frequencyType as FrequencyType)) {
    throw new Error(`frequency_type must be one of: ${FREQUENCY_TYPES.join(', ')}`);
  }

  assertOptionalString(obj.icon, 'icon', { allowNull: true });
  assertOptionalString(obj.category_id, 'category_id', { allowNull: true });
  assertOptionalString(obj.frequency_value, 'frequency_value', { allowNull: true });
  assertOptionalString(obj.reminder_time, 'reminder_time', { allowNull: true, pattern: TIME_RE });
  assertOptionalNumber(obj.sort_order, 'sort_order', 0, Number.MAX_SAFE_INTEGER);
  if (obj.sort_order !== undefined && !Number.isInteger(obj.sort_order)) {
    throw new Error('sort_order must be an integer');
  }
}

export function validateHabitUpdate(changes: unknown): asserts changes is HabitUpdateInput {
  if (typeof changes !== 'object' || changes === null) {
    throw new Error('Habit update payload must be an object');
  }
  const obj = changes as RecordInput;

  if (obj.name !== undefined) {
    if (typeof obj.name !== 'string' || obj.name.trim() === '') {
      throw new Error('Habit name must be a non-empty string');
    }
    if (obj.name.length > 200) {
      throw new Error('Habit name must be 200 characters or fewer');
    }
  }

  const frequencyType = obj.frequency_type;
  if (frequencyType !== undefined && (typeof frequencyType !== 'string' || !FREQUENCY_TYPES.includes(frequencyType as FrequencyType))) {
    throw new Error(`frequency_type must be one of: ${FREQUENCY_TYPES.join(', ')}`);
  }

  assertOptionalString(obj.icon, 'icon', { allowNull: true });
  assertOptionalString(obj.category_id, 'category_id', { allowNull: true });
  assertOptionalString(obj.frequency_value, 'frequency_value', { allowNull: true });
  assertOptionalString(obj.reminder_time, 'reminder_time', { allowNull: true, pattern: TIME_RE });
  if (obj.is_archived !== undefined && obj.is_archived !== 0 && obj.is_archived !== 1) {
    throw new Error('is_archived must be 0 or 1');
  }
  assertOptionalNumber(obj.sort_order, 'sort_order', 0, Number.MAX_SAFE_INTEGER);
  if (obj.sort_order !== undefined && !Number.isInteger(obj.sort_order)) {
    throw new Error('sort_order must be an integer');
  }
}

export function validateCategoryCreate(input: unknown): asserts input is CategoryCreateInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Category payload must be an object');
  }
  const obj = input as RecordInput;

  if (typeof obj.name !== 'string' || obj.name.trim() === '') {
    throw new Error('Category name is required');
  }
  assertOptionalString(obj.color, 'color', { allowNull: true });
}

export function validateCategoryUpdate(changes: unknown): asserts changes is CategoryUpdateInput {
  if (typeof changes !== 'object' || changes === null) {
    throw new Error('Category update payload must be an object');
  }
  const obj = changes as RecordInput;

  if (obj.name !== undefined && (typeof obj.name !== 'string' || obj.name.trim() === '')) {
    throw new Error('Category name must be a non-empty string');
  }
  assertOptionalString(obj.color, 'color', { allowNull: true });
}

export function validateDailyLogInput(input: unknown): asserts input is DailyLogInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Daily log payload must be an object');
  }
  const obj = input as RecordInput;

  const mood = obj.mood;
  if (mood !== undefined && mood !== null) {
    if (typeof mood !== 'string' || !MOODS.includes(mood as Mood)) {
      throw new Error(`mood must be one of: ${MOODS.join(', ')}`);
    }
  }

  assertOptionalNumber(obj.sleepHours, 'sleep_hours', 0, 24);
}

export function assertSettingKey(key: unknown): asserts key is string {
  assertId(key, 'setting key');
}

export function assertSettingValue(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('Setting value must be a string');
  }
}
