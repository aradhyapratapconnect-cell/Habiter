/**
 * Rolling automatic backup utility for the SQLite database (TICKET-021).
 *
 * Keeps up to 2 most recent backup copies of habiter.db alongside the
 * primary database file in the userData directory:
 *
 *   habiter.db           — live database
 *   habiter.backup.1.db  — most recent backup
 *   habiter.backup.2.db  — second most recent backup
 *
 * The rolling strategy:
 *   1. If backup.2 exists, delete it (oldest beyond retention).
 *   2. If backup.1 exists, rename it to backup.2.
 *   3. Copy the current habiter.db to backup.1.
 *
 * Backups are taken:
 *   - Before every migration run (called from database.ts).
 *   - On a periodic schedule (24-hour interval, managed from main.ts).
 *   - Once at app startup (also managed from main.ts).
 *
 * All public functions accept `dbPath` explicitly so the module can be
 * unit-tested without an Electron runtime.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of rolling backups to keep. */
export const MAX_BACKUPS = 2;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** Build the backup file path for a given 1-based slot index. */
export function getBackupPath(dbPath: string, slot: number): string {
  const ext = path.extname(dbPath);
  const stem = path.basename(dbPath, ext);
  return path.join(path.dirname(dbPath), `${stem}.backup.${slot}${ext}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the path to the most recent existing backup, or null if none.
 * Used by the recovery dialog (TICKET-020) to offer a restore option.
 */
export function getLatestBackupPath(dbPath: string): string | null {
  for (let slot = 1; slot <= MAX_BACKUPS; slot++) {
    const p = getBackupPath(dbPath, slot);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Create a rolling backup of the current database file.
 *
 * Safe to call at any time — if the source database doesn't exist yet
 * (very first launch), this is a no-op.
 *
 * @returns The new backup path, or null if skipped/failed.
 */
export function backupDatabase(
  dbPath: string,
  maxBackups: number = MAX_BACKUPS,
): string | null {
  if (!fs.existsSync(dbPath)) {
    console.log(`[Backup] No database file at ${dbPath} — skipping.`);
    return null;
  }

  try {
    // 1. Drop the oldest backup that will fall out of the retention window.
    const oldest = getBackupPath(dbPath, maxBackups);
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);

    // 2. Shift .N → .N+1 from newest to oldest so we never clobber a
    //    backup we still need. With maxBackups=2 this is just .1 → .2.
    for (let slot = maxBackups - 1; slot >= 1; slot--) {
      const current = getBackupPath(dbPath, slot);
      const next = getBackupPath(dbPath, slot + 1);
      if (fs.existsSync(current)) fs.renameSync(current, next);
    }

    // 3. Copy the current database into the newest slot.
    const newest = getBackupPath(dbPath, 1);
    fs.copyFileSync(dbPath, newest);

    // 4. Enforce retention on any out-of-window stragglers (e.g. from an
    //    older version that kept more backups, or manual copies).
    cleanupOldBackups(dbPath, maxBackups);

    console.log(`[Backup] Database backed up to: ${newest}`);
    return newest;
  } catch (err) {
    // Backup failure should never crash the app — log and continue.
    console.error(
      '[Backup] Failed to create backup:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Delete backup files beyond the retention limit.
 * Returns the paths that were removed.
 */
export function cleanupOldBackups(
  dbPath: string,
  maxBackups: number = MAX_BACKUPS,
): string[] {
  const dir = path.dirname(dbPath);
  const ext = path.extname(dbPath);
  const stem = path.basename(dbPath, ext);
  const pattern = new RegExp(
    `^${escapeRegExp(stem)}\\.backup\\.(\\d+)${escapeRegExp(ext)}$`,
  );

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const removed: string[] = [];
  for (const entry of entries) {
    const match = entry.match(pattern);
    if (!match) continue;
    const slot = Number(match[1]);
    if (slot > maxBackups) {
      const fullPath = path.join(dir, entry);
      try {
        fs.unlinkSync(fullPath);
        removed.push(fullPath);
        console.log(`[Backup] Removed old backup: ${fullPath}`);
      } catch (err) {
        console.error(
          `[Backup] Failed to remove old backup:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
  return removed;
}

/**
 * Restore the most recent backup over dbPath, preserving the current
 * (possibly corrupted) file as <dbPath>.corrupted.
 *
 * @returns The backup path used, or null if no backup exists / restore failed.
 */
export function restoreFromBackup(dbPath: string): string | null {
  const latest = getLatestBackupPath(dbPath);
  if (!latest) {
    console.warn('[Backup] No backup available to restore.');
    return null;
  }

  try {
    // Preserve the current (corrupted) file before overwriting
    if (fs.existsSync(dbPath)) {
      const corruptedPath = dbPath + '.corrupted';
      try {
        fs.renameSync(dbPath, corruptedPath);
        console.log(`[Backup] Current database saved as: ${corruptedPath}`);
      } catch {
        // If rename fails, try to delete so the restore can proceed
        try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
      }
    }

    fs.copyFileSync(latest, dbPath);
    console.log(`[Backup] Database restored from: ${latest}`);
    return latest;
  } catch (err) {
    console.error(
      '[Backup] Restore failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Escape a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
