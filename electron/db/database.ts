import { app } from 'electron';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { backupDatabase } from './backup.js';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

export function getDatabasePath(): string {
  return path.join(app.getPath('userData'), 'habiter.db');
}

/**
 * Initialize the SQLite database using sql.js (WebAssembly-based).
 * Creates the database file in the OS-appropriate app data directory.
 * The database is loaded into memory and saved to disk on changes.
 */
export async function initDatabase(): Promise<SqlJsDatabase> {
  if (db) return db;

  // Locate the WASM file for sql.js. In development, __dirname is dist-electron/
  // and the file is in node_modules/ at the project root. In a packaged app with
  // asarUnpack, the file is extracted to app.asar.unpacked/node_modules/.
  // We check the unpacked path first, then fall back to the ASAR-relative path.
  const appPath = app.getAppPath();
  const unpackedWasm = path.join(appPath, '..', 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const asarWasm = path.join(appPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmPath = fs.existsSync(unpackedWasm) ? unpackedWasm : asarWasm;
  const SQL = await initSqlJs({ locateFile: () => wasmPath });

  dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // Ensure the app data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`[DB] Database loaded from: ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`[DB] New database created at: ${dbPath}`);
  }

  // Enable WAL mode for crash resilience (sql.js supports this via pragma)
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  console.log(`[DB] WAL mode enabled.`);
  console.log(`[DB] Foreign keys enabled.`);

  // Save initial state
  saveDatabase();

  return db;
}

/**
 * Save the in-memory database to disk.
 * Should be called after any write operation.
 */
export function saveDatabase(): void {
  if (!db || !dbPath) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Get the current database connection.
 * Throws if the database hasn't been initialized yet.
 */
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('[DB] Database connection closed.');
  }
}

/**
 * Run all pending migrations from the migrations directory.
 * Migrations are idempotent — safe to run multiple times with no effect if already applied.
 * Each migration runs inside a transaction that rolls back on failure.
 */
export function runMigrations(database: SqlJsDatabase): void {
  // Resolve migrations path relative to the project root.
  // __dirname is dist-electron/, so we go up one level to reach electron/db/migrations/
  const migrationsDir = path.join(__dirname, '..', 'electron', 'db', 'migrations');

  // Create migrations tracking table if it doesn't exist
  database.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get list of already-applied migrations
  const appliedResult = database.exec('SELECT filename FROM _migrations ORDER BY id');
  const applied = new Set<string>();
  if (appliedResult.length > 0) {
    for (const row of appliedResult[0]!.values) {
      applied.add(row[0] as string);
    }
  }

  // Read migration files from the migrations directory
  if (!fs.existsSync(migrationsDir)) {
    console.log('[DB] No migrations directory found. Skipping migrations.');
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort(); // Alphabetical sort ensures numeric prefixes order correctly

  if (migrationFiles.length === 0) {
    console.log('[DB] No migration files found.');
    return;
  }

  // Filter to only pending (unapplied) migrations
  const pending = migrationFiles.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log('[DB] All migrations already applied.');
    return;
  }

  console.log(`[DB] ${pending.length} pending migration(s) to apply.`);

  // TICKET-021: Back up the database before applying any migrations
  // so a failed migration can be recovered from.
  saveDatabase(); // flush in-memory state to disk first
  backupDatabase(getDatabasePath());

  for (const filename of pending) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    try {
      console.log(`[DB] Applying migration: ${filename}`);

      // Run migration in a transaction
      database.run('BEGIN TRANSACTION');
      database.exec(sql);
      database.run(
        'INSERT INTO _migrations (filename) VALUES (?)',
        [filename],
      );
      database.run('COMMIT');

      console.log(`[DB] Migration applied: ${filename}`);
    } catch (error) {
      // Rollback on failure
      database.run('ROLLBACK');
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[DB] Migration failed: ${filename} — ${message}`,
      );
      throw new Error(
        `Migration "${filename}" failed: ${message}. All changes rolled back.`,
      );
    }
  }

  // Save after all migrations
  saveDatabase();
  console.log('[DB] All pending migrations applied successfully.');
}
