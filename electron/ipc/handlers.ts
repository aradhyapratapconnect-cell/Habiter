// IPC handlers: renderer <-> main process communication.
//
// Each ipcMain.handle channel corresponds 1:1 to a method on window.habiterAPI
// (see electron/preload.ts and src/types/index.ts). Handlers do three things:
//  1. Validate the untrusted renderer payload (electron/ipc/validation.ts)
//  2. Run the query against the database (electron/db/queries/)
//  3. Persist the in-memory sql.js DB to disk after any write
//
// Thrown errors propagate to the renderer as a rejected Promise from
// ipcRenderer.invoke(), so the UI gets a clear message instead of a silent
// failure (Security doc §4: "Catch the write error, show a clear message").

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import { getDatabase, saveDatabase } from '../db/database.js';
import * as habits from '../db/queries/habits.js';
import * as categories from '../db/queries/categories.js';
import * as checkins from '../db/queries/checkins.js';
import * as dailyLogs from '../db/queries/dailyLogs.js';
import * as settings from '../db/queries/settings.js';
import {
  assertCheckinStatus,
  assertDate,
  assertId,
  assertSettingKey,
  assertSettingValue,
  validateCategoryCreate,
  validateCategoryUpdate,
  validateDailyLogInput,
  validateHabitCreate,
  validateHabitUpdate,
} from './validation.js';
import {
  scheduleHabit,
  unscheduleHabit,
} from '../notifications/scheduler.js';

function db() {
  return getDatabase();
}

// ---------------------------------------------------------------------------
// TICKET-027: Editable-date window enforcement
//
// A user may only write (create/edit/delete) check-ins, mood, or sleep
// entries for today or yesterday. Everything else is read-only.
// ---------------------------------------------------------------------------

/**
 * Returns true if the given ISO date string is today or yesterday in the
 * user's local timezone. Uses plain Date arithmetic so there is no
 * timezone mismatch with the ISO strings stored in the database.
 */
function isEditableDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const target = new Date(y, m - 1, d);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return target.getTime() === today.getTime() || target.getTime() === yesterday.getTime();
}

export function registerIpcHandlers(): void {
  // --- habits -------------------------------------------------------------
  ipcMain.handle('habits:create', (_event, input: unknown) => {
    validateHabitCreate(input);
    const result = habits.createHabit(db(), input);
    saveDatabase();
    // Schedule notification if reminder_time is set
    scheduleHabit(
      result.id,
      result.name,
      result.icon ?? '🔔',
      result.reminder_time,
    );
    return result;
  });
  ipcMain.handle('habits:list', (_event, options: unknown) => {
    const includeArchived = typeof options === 'object' && options !== null && (options as { includeArchived?: unknown }).includeArchived === true;
    return habits.listHabits(db(), includeArchived);
  });
  ipcMain.handle('habits:get', (_event, id: unknown) => {
    assertId(id);
    return habits.getHabit(db(), id);
  });
  ipcMain.handle('habits:update', (_event, id: unknown, changes: unknown) => {
    assertId(id);
    validateHabitUpdate(changes);
    const result = habits.updateHabit(db(), id, changes);
    saveDatabase();
    // Reschedule notification if reminder_time was changed
    const typedChanges = changes as Record<string, unknown>;
    if ('reminder_time' in typedChanges) {
      scheduleHabit(
        result.id,
        result.name,
        result.icon ?? '🔔',
        result.reminder_time,
      );
    }
    return result;
  });
  ipcMain.handle('habits:delete', (_event, id: unknown) => {
    assertId(id);
    habits.deleteHabit(db(), id);
    saveDatabase();
    // Cancel any scheduled notification for this habit
    unscheduleHabit(id);
  });

  // --- categories ---------------------------------------------------------
  ipcMain.handle('categories:create', (_event, input: unknown) => {
    validateCategoryCreate(input);
    const result = categories.createCategory(db(), input);
    saveDatabase();
    return result;
  });
  ipcMain.handle('categories:list', () => categories.listCategories(db()));
  ipcMain.handle('categories:update', (_event, id: unknown, changes: unknown) => {
    assertId(id);
    validateCategoryUpdate(changes);
    const result = categories.updateCategory(db(), id, changes);
    saveDatabase();
    return result;
  });
  ipcMain.handle('categories:delete', (_event, id: unknown) => {
    assertId(id);
    categories.deleteCategory(db(), id);
    saveDatabase();
  });

  // --- checkins -----------------------------------------------------------
  ipcMain.handle('checkins:set', (_event, habitId: unknown, date: unknown, status: unknown) => {
    assertId(habitId, 'habit_id');
    assertDate(date);
    assertCheckinStatus(status);
    // TICKET-027: Only allow writes for today or yesterday
    if (!isEditableDate(date as string)) {
      throw new Error('Check-ins can only be edited for today or yesterday');
    }
    const result = checkins.setCheckin(db(), habitId, date, status);
    saveDatabase();
    return result;
  });
  ipcMain.handle('checkins:get', (_event, habitId: unknown, date: unknown) => {
    assertId(habitId, 'habit_id');
    assertDate(date);
    return checkins.getCheckin(db(), habitId, date);
  });
  ipcMain.handle('checkins:list', (_event, filter: unknown) => {
    if (filter !== undefined && (typeof filter !== 'object' || filter === null)) {
      throw new Error('checkins filter must be an object');
    }
    const f = (filter ?? {}) as { habitId?: unknown; startDate?: unknown; endDate?: unknown };
    if (f.habitId !== undefined) assertId(f.habitId, 'habit_id');
    if (f.startDate !== undefined) assertDate(f.startDate, 'start_date');
    if (f.endDate !== undefined) assertDate(f.endDate, 'end_date');
    return checkins.listCheckins(db(), {
      habitId: f.habitId as string | undefined,
      startDate: f.startDate as string | undefined,
      endDate: f.endDate as string | undefined,
    });
  });
  ipcMain.handle('checkins:delete', (_event, habitId: unknown, date: unknown) => {
    assertId(habitId, 'habit_id');
    assertDate(date);
    // TICKET-027: Only allow deletes for today or yesterday
    if (!isEditableDate(date as string)) {
      throw new Error('Check-ins can only be deleted for today or yesterday');
    }
    checkins.deleteCheckin(db(), habitId, date);
    saveDatabase();
  });

  // --- daily_logs ---------------------------------------------------------
  ipcMain.handle('dailyLogs:get', (_event, date: unknown) => {
    assertDate(date);
    return dailyLogs.getDailyLog(db(), date);
  });
  ipcMain.handle('dailyLogs:set', (_event, date: unknown, input: unknown) => {
    assertDate(date);
    validateDailyLogInput(input);
    // TICKET-027: Only allow writes for today or yesterday
    if (!isEditableDate(date as string)) {
      throw new Error('Mood and sleep can only be edited for today or yesterday');
    }
    const result = dailyLogs.setDailyLog(db(), date, input);
    saveDatabase();
    return result;
  });
  ipcMain.handle('dailyLogs:list', () => dailyLogs.listDailyLogs(db()));
  ipcMain.handle('dailyLogs:delete', (_event, date: unknown) => {
    assertDate(date);
    // TICKET-027: Only allow deletes for today or yesterday
    if (!isEditableDate(date as string)) {
      throw new Error('Daily logs can only be deleted for today or yesterday');
    }
    dailyLogs.deleteDailyLog(db(), date);
    saveDatabase();
  });

  // --- settings -----------------------------------------------------------
  ipcMain.handle('settings:get', (_event, key: unknown) => {
    assertSettingKey(key);
    return settings.getSetting(db(), key);
  });
  ipcMain.handle('settings:set', (_event, key: unknown, value: unknown) => {
    assertSettingKey(key);
    assertSettingValue(value);
    settings.setSetting(db(), key, value);
    saveDatabase();
  });
  ipcMain.handle('settings:delete', (_event, key: unknown) => {
    assertSettingKey(key);
    settings.deleteSetting(db(), key);
    saveDatabase();
  });

  // --- export ---------------------------------------------------------------
  ipcMain.handle('export:json', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Habiter Data (JSON)',
      defaultPath: `habiter-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { path: null };

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      habits: habits.listHabits(db(), true),
      categories: categories.listCategories(db()),
      checkins: checkins.listCheckins(db()),
      dailyLogs: dailyLogs.listDailyLogs(db()),
    };

    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Export] JSON written to: ${result.filePath}`);
    return { path: result.filePath };
  });

  ipcMain.handle('export:csv', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export Habiter Data (CSV)',
      defaultPath: `habiter-export-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return { path: null };

    const lines: string[] = [];

    // --- Categories ---
    lines.push('--- Categories ---');
    lines.push('id,name,color,created_at');
    for (const c of categories.listCategories(db())) {
      lines.push([c.id, csvEscape(c.name), csvEscape(c.color), c.created_at].join(','));
    }
    lines.push('');

    // --- Habits ---
    lines.push('--- Habits ---');
    lines.push('id,name,icon,category_id,frequency_type,frequency_value,reminder_time,is_archived,sort_order,created_at');
    for (const h of habits.listHabits(db(), true)) {
      lines.push([
        h.id, csvEscape(h.name), csvEscape(h.icon), csvEscape(h.category_id),
        h.frequency_type, csvEscape(h.frequency_value), csvEscape(h.reminder_time),
        h.is_archived, h.sort_order, h.created_at,
      ].join(','));
    }
    lines.push('');

    // --- Checkins ---
    lines.push('--- Checkins ---');
    lines.push('id,habit_id,date,status,updated_at');
    for (const c of checkins.listCheckins(db())) {
      lines.push([c.id, c.habit_id, c.date, c.status, c.updated_at].join(','));
    }
    lines.push('');

    // --- Daily Logs ---
    lines.push('--- Daily Logs ---');
    lines.push('id,date,mood,sleep_hours,updated_at');
    for (const l of dailyLogs.listDailyLogs(db())) {
      lines.push([l.id, l.date, l.mood ?? '', l.sleep_hours ?? '', l.updated_at].join(','));
    }

    fs.writeFileSync(result.filePath, lines.join('\n'), 'utf-8');
    console.log(`[Export] CSV written to: ${result.filePath}`);
    return { path: result.filePath };
  });

  // --- import ---------------------------------------------------------------
  ipcMain.handle('import:json', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import Habiter Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Import cancelled.' };
    }

    const filePath = result.filePaths[0]!;
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return { success: false, message: `Could not read file: ${filePath}` };
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return { success: false, message: 'Invalid JSON — file could not be parsed.' };
    }

    // --- Validate structure ---
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { success: false, message: 'Invalid format — expected a JSON object.' };
    }
    const obj = data as Record<string, unknown>;

    if (!Array.isArray(obj.habits)) {
      return { success: false, message: 'Invalid format — missing or invalid "habits" array.' };
    }
    if (!Array.isArray(obj.categories)) {
      return { success: false, message: 'Invalid format — missing or invalid "categories" array.' };
    }
    if (!Array.isArray(obj.checkins)) {
      return { success: false, message: 'Invalid format — missing or invalid "checkins" array.' };
    }
    if (!Array.isArray(obj.dailyLogs)) {
      return { success: false, message: 'Invalid format — missing or invalid "dailyLogs" array.' };
    }

    // --- Validate individual records ---
    const validStatuses = new Set(['completed', 'partial', 'not_done', 'skipped']);
    const validFreqs = new Set(['daily', 'specific_days', 'times_per_week']);
    const validMoods = new Set(['great', 'good', 'neutral', 'bad', 'terrible']);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

    for (const c of obj.categories as unknown[]) {
      if (typeof c !== 'object' || c === null) {
        return { success: false, message: 'Invalid category entry — must be an object.' };
      }
      const cat = c as Record<string, unknown>;
      if (typeof cat.id !== 'string' || typeof cat.name !== 'string') {
        return { success: false, message: `Invalid category: id and name must be strings.` };
      }
    }

    for (const h of obj.habits as unknown[]) {
      if (typeof h !== 'object' || h === null) {
        return { success: false, message: 'Invalid habit entry — must be an object.' };
      }
      const habit = h as Record<string, unknown>;
      if (typeof habit.id !== 'string' || typeof habit.name !== 'string') {
        return { success: false, message: `Invalid habit: id and name must be strings.` };
      }
      if (typeof habit.frequency_type !== 'string' || !validFreqs.has(habit.frequency_type)) {
        return { success: false, message: `Invalid habit frequency_type: "${habit.frequency_type}".` };
      }
      if (habit.reminder_time != null && habit.reminder_time !== '' &&
          (typeof habit.reminder_time !== 'string' || !timeRe.test(habit.reminder_time))) {
        return { success: false, message: `Invalid reminder_time format: "${habit.reminder_time}".` };
      }
    }

    // Validate FK: habit.category_id → categories.id
    const catIds = new Set((obj.categories as Record<string, unknown>[]).map((c) => c.id));
    for (const h of obj.habits as Record<string, unknown>[]) {
      if (h.category_id != null && h.category_id !== '' && !catIds.has(h.category_id)) {
        return { success: false, message: `Habit "${h.name}" references unknown category_id: "${h.category_id}".` };
      }
    }

    for (const c of obj.checkins as unknown[]) {
      if (typeof c !== 'object' || c === null) {
        return { success: false, message: 'Invalid checkin entry — must be an object.' };
      }
      const ci = c as Record<string, unknown>;
      if (typeof ci.habit_id !== 'string' || typeof ci.date !== 'string' || typeof ci.status !== 'string') {
        return { success: false, message: `Invalid checkin: habit_id, date, and status must be strings.` };
      }
      if (!dateRe.test(ci.date)) {
        return { success: false, message: `Invalid checkin date format: "${ci.date}".` };
      }
      if (!validStatuses.has(ci.status)) {
        return { success: false, message: `Invalid checkin status: "${ci.status}".` };
      }
    }

    // Validate FK: checkin.habit_id → habits.id
    const habitIds = new Set((obj.habits as Record<string, unknown>[]).map((h) => h.id));
    for (const c of obj.checkins as Record<string, unknown>[]) {
      if (!habitIds.has(c.habit_id)) {
        return { success: false, message: `Checkin references unknown habit_id: "${c.habit_id}".` };
      }
    }

    for (const l of obj.dailyLogs as unknown[]) {
      if (typeof l !== 'object' || l === null) {
        return { success: false, message: 'Invalid daily log entry — must be an object.' };
      }
      const log = l as Record<string, unknown>;
      if (typeof log.date !== 'string' || !dateRe.test(log.date)) {
        return { success: false, message: `Invalid daily log date: "${log.date}".` };
      }
      if (log.mood != null && log.mood !== '' && !validMoods.has(log.mood as string)) {
        return { success: false, message: `Invalid mood value: "${log.mood}".` };
      }
    }

    // --- Validation passed — restore data inside a transaction ---
    const d = db();
    try {
      d.run('BEGIN TRANSACTION');

      // Clear existing data (order matters due to FK constraints)
      d.run('DELETE FROM checkins');
      d.run('DELETE FROM habits');
      d.run('DELETE FROM daily_logs');
      d.run('DELETE FROM categories');

      // Restore categories
      for (const c of obj.categories as Record<string, unknown>[]) {
        d.run(
          'INSERT INTO categories (id, name, color, created_at) VALUES (?, ?, ?, ?)',
          [c.id, c.name, c.color ?? null, c.created_at ?? new Date().toISOString()] as (string | number | null)[],
        );
      }

      // Restore habits
      for (const h of obj.habits as Record<string, unknown>[]) {
        d.run(
          `INSERT INTO habits (id, name, icon, category_id, frequency_type, frequency_value,
           reminder_time, is_archived, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [h.id, h.name, h.icon ?? null, h.category_id ?? null,
           h.frequency_type, h.frequency_value ?? null, h.reminder_time ?? null,
           h.is_archived ?? 0, h.sort_order ?? 0, h.created_at ?? new Date().toISOString()] as (string | number | null)[],
        );
      }

      // Restore checkins
      for (const c of obj.checkins as Record<string, unknown>[]) {
        d.run(
          'INSERT INTO checkins (id, habit_id, date, status, updated_at) VALUES (?, ?, ?, ?, ?)',
          [c.id, c.habit_id, c.date, c.status, c.updated_at ?? new Date().toISOString()] as (string | number | null)[],
        );
      }

      // Restore daily_logs
      for (const l of obj.dailyLogs as Record<string, unknown>[]) {
        d.run(
          'INSERT INTO daily_logs (id, date, mood, sleep_hours, updated_at) VALUES (?, ?, ?, ?, ?)',
          [l.id, l.date, l.mood ?? null, l.sleep_hours ?? null, l.updated_at ?? new Date().toISOString()] as (string | number | null)[],
        );
      }

      d.run('COMMIT');
    } catch (err) {
      d.run('ROLLBACK');
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Import] Restore failed, rolled back: ${msg}`);
      return { success: false, message: `Import failed during restore: ${msg}. No changes were made.` };
    }

    saveDatabase();
    const counts = {
      categories: (obj.categories as unknown[]).length,
      habits: (obj.habits as unknown[]).length,
      checkins: (obj.checkins as unknown[]).length,
      dailyLogs: (obj.dailyLogs as unknown[]).length,
    };
    console.log(`[Import] Restored: ${JSON.stringify(counts)}`);
    return { success: true, message: `Import complete: ${counts.categories} categories, ${counts.habits} habits, ${counts.checkins} checkins, ${counts.dailyLogs} daily logs.` };
  });
}

/** Escape a value for CSV (wrap in quotes if it contains commas/quotes/newlines). */
function csvEscape(value: string | null | undefined): string {
  if (value == null) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
