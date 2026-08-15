import { app, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, runMigrations, closeDatabase, getDatabase, getDatabasePath, saveDatabase } from './db/database.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { backupDatabase, getLatestBackupPath, restoreFromBackup } from './db/backup.js';
import { seedIfEmpty } from './db/seed.js';
import {
  rescheduleAll,
  startScheduler,
  stopAll,
  requestNotificationPermission,
} from './notifications/scheduler.js';

// In CJS context (which Vite outputs when "type":"module" is not in package.json),
// __dirname is available as a built-in global pointing to the compiled file's directory.
// The bundled output at dist-electron/main.js will have __dirname = dist-electron/

// Ensure the app name is "Habiter" everywhere — taskbar context menu,
// process list, About dialog — not "electron".
app.name = 'Habiter';

let mainWindow: BrowserWindow | null = null;

// ---------------------------------------------------------------------------
// App icon — resolved relative to the project so it works in both
// development (dist-electron/) and production (packaged asar).
// ---------------------------------------------------------------------------

function getAppIcon(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    // Dev: __dirname = dist-electron/, icon is at project root/build/
    return path.join(__dirname, '..', 'build', 'icons', 'win', 'icon.ico');
  }
  // Production: icon is inside the asar at build/icons/win/icon.ico
  return path.join(app.getAppPath(), 'build', 'icons', 'win', 'icon.ico');
}

// ---------------------------------------------------------------------------
// Periodic backup timer (TICKET-021)
// ---------------------------------------------------------------------------

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let backupInterval: ReturnType<typeof setInterval> | null = null;

function startPeriodicBackup(): void {
  if (backupInterval) return;
  backupInterval = setInterval(() => {
    try {
      console.log('[main] Running periodic backup…');
      saveDatabase(); // flush in-memory state before snapshotting
      backupDatabase(getDatabasePath());
    } catch (err) {
      console.error('[main] Periodic backup failed:', err);
    }
  }, BACKUP_INTERVAL_MS);
  console.log('[main] Periodic backup scheduled (every 24 hours).');
}

function stopPeriodicBackup(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log('[main] Periodic backup stopped.');
  }
}

// ---------------------------------------------------------------------------
// Database integrity check & recovery (TICKET-020)
// ---------------------------------------------------------------------------

/**
 * Handle a corrupted or missing database file on startup.
 * Shows a native dialog offering recovery options and executes the user's choice.
 *
 * Per the Security Document:
 *   - Never silently overwrite a corrupted file.
 *   - Offer repair, restore from backup, or start fresh.
 *   - "Start fresh" requires explicit confirmation.
 */
async function handleDatabaseRecovery(error: Error): Promise<boolean> {
  console.error('[main] Database initialization failed:', error.message);

  const dbPath = getDatabasePath();
  const dbExists = fs.existsSync(dbPath);
  const hasBackup = getLatestBackupPath(dbPath) !== null;

  // Build button list dynamically based on whether a backup exists
  const buttons = dbExists
    ? hasBackup
      ? ['Restore from Backup', 'Start Fresh', 'Quit']
      : ['Start Fresh', 'Quit']
    : ['Create New Database', 'Quit'];

  // Derive action indices from the actual button list so they stay correct
  // even when the list changes.
  const restoreIdx = buttons.indexOf('Restore from Backup');
  const quitIdx = buttons.length - 1;

  const result = await dialog.showMessageBox({
    type: 'warning',
    title: 'Database Problem',
    message: 'Habiter could not open its database.',
    detail: dbExists
      ? `The database file may be corrupted.\n\nLocation: ${dbPath}\n\nError: ${error.message}`
      : `The database file could not be created.\n\nLocation: ${dbPath}\n\nError: ${error.message}`,
    buttons,
    defaultId: 0,
    cancelId: quitIdx,
    noLink: true,
  });

  if (result.response === quitIdx) {
    app.quit();
    return false;
  }

  // TICKET-021: User chose to restore from backup
  if (result.response === restoreIdx) {
    const restored = restoreFromBackup(dbPath);
    if (restored) {
      console.log(`[main] Restored database from backup: ${restored}`);
      try {
        const db = await initDatabase();
        runMigrations(db);
        console.log('[main] Database restored and migrations applied successfully.');
        return true;
      } catch (restoreErr) {
        console.error('[main] Failed to initialize after restore:', restoreErr);
        dialog.showErrorBox(
          'Restore Failed',
          'The backup could not be restored. The backup file may also be corrupted.\n\nPlease try "Start Fresh" or contact support.',
        );
        app.quit();
        return false;
      }
    } else {
      dialog.showErrorBox(
        'No Backup Found',
        'No backup file was found to restore from.',
      );
      app.quit();
      return false;
    }
  }

  // User chose to start fresh
  if (dbExists) {
    // Confirm before destroying the existing file
    const confirm = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confirm Start Fresh',
      message: 'This will replace the corrupted database with a new empty one.',
      detail: 'Your old database will be kept as a backup file (habiter.db.corrupted) so you can try to recover data later.',
      buttons: ['Start Fresh', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (confirm.response === 1) {
      app.quit();
      return false;
    }

    // Rename corrupted file as backup
    const corruptedPath = dbPath + '.corrupted';
    try {
      fs.renameSync(dbPath, corruptedPath);
      console.log(`[main] Corrupted database backed up to: ${corruptedPath}`);
    } catch (renameErr) {
      console.error('[main] Failed to rename corrupted database:', renameErr);
      // Try to delete instead
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // Ignore — initDatabase will handle it
      }
    }
  }

  // Initialize a fresh database
  try {
    const db = await initDatabase();
    runMigrations(db);
    console.log('[main] Fresh database created successfully.');
    return true;
  } catch (freshErr) {
    console.error('[main] Failed to create fresh database:', freshErr);
    dialog.showErrorBox(
      'Fatal Error',
      'Could not create a new database. Please check that the app has write permissions and try again.',
    );
    app.quit();
    return false;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    icon: getAppIcon(),
    title: 'Habiter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#0B1410',
    show: false,
  });

  // Gracefully show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // In development, load from Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

/**
 * Create the main window if one isn't already open. Used everywhere a window
 * could be (re)created — first launch, macOS 'activate', and second-instance —
 * so a single guard prevents accidentally opening two windows (e.g. a second
 * launch racing the first's async startup).
 */
function ensureWindow(): void {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}

// Single instance lock (TICKET-005 foundation)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // A second copy of the app was launched while this instance holds the lock
  // (TICKET-005). The second copy exits before it can touch the database; the
  // first instance brings its existing window to the foreground instead of
  // opening another one.
  app.on('second-instance', () => {
    const existing = mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
    } else {
      // No window yet (very early second launch) or all were closed — open one.
      ensureWindow();
    }
    console.log('[main] Second instance detected — brought app to front.');
  });

  app.whenReady().then(async () => {
    // Windows: set the App User Model ID so the taskbar button (name + icon)
    // uses this app's identity instead of falling back to electron.exe.
    // Must match the appId in electron-builder.yml and be set before any
    // window is created.
    app.setAppUserModelId('com.habiter.app');

    // Initialize database and run migrations before creating the window.
    // The losing instance above quit before this point, so only one process
    // ever writes to the SQLite file.
    //
    // TICKET-020: If the database is corrupted or can't be created, show a
    // recovery dialog instead of crashing or silently resetting.
    let db;
    try {
      db = await initDatabase();
    } catch (err) {
      const recovered = await handleDatabaseRecovery(err instanceof Error ? err : new Error(String(err)));
      if (!recovered) return; // user chose to quit
      db = getDatabase();
    }

    // TICKET-021: Run a backup on startup before migrations
    backupDatabase(getDatabasePath());
    runMigrations(db);

    // TICKET-026: Seed example data on first launch (empty database)
    seedIfEmpty(db);

    // TICKET-021: Start the periodic backup timer (every 24 hours)
    startPeriodicBackup();

    // Register IPC channels so the renderer can talk to the database
    registerIpcHandlers();

    // Request macOS notification permission (no-op on Windows/Linux)
    await requestNotificationPermission();

    // Initialize the notification scheduler: schedule reminders for all
    // habits that have a reminder_time set, then start the 30s tick loop.
    rescheduleAll(() => {
      const dbInstance = getDatabase();
      const results = dbInstance.exec(
        'SELECT id, name, icon, reminder_time FROM habits WHERE is_archived = 0 AND reminder_time IS NOT NULL',
      );
      if (results.length === 0) return [];
      const { columns, values } = results[0]!;
      return values.map((row) => {
        const obj: Record<string, string | null> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i] as string | null;
        });
        return obj as { id: string; name: string; icon: string | null; reminder_time: string | null };
      });
    });
    startScheduler();

    ensureWindow();

    app.on('activate', () => {
      // macOS: re-create window when dock icon is clicked
      ensureWindow();
    });
  });

  // Clean up on app quit
  app.on('before-quit', () => {
    stopAll();
    stopPeriodicBackup();
    closeDatabase();
  });
}

app.on('window-all-closed', () => {
  // macOS convention: quit when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
