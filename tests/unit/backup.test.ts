/**
 * Unit tests for the rolling backup utility (TICKET-021).
 *
 * All functions accept `dbPath` explicitly, so no Electron runtime is needed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  backupDatabase,
  cleanupOldBackups,
  getBackupPath,
  getLatestBackupPath,
  restoreFromBackup,
} from '../../electron/db/backup.js';

let tmpDir: string;
let dbPath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'habiter-backup-test-'));
  dbPath = path.join(tmpDir, 'habiter.db');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeDb(content: string): void {
  fs.writeFileSync(dbPath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// getBackupPath
// ---------------------------------------------------------------------------

describe('getBackupPath', () => {
  it('derives backup filenames from the database filename', () => {
    expect(getBackupPath(dbPath, 1)).toBe(path.join(tmpDir, 'habiter.backup.1.db'));
    expect(getBackupPath(dbPath, 2)).toBe(path.join(tmpDir, 'habiter.backup.2.db'));
  });

  it('works with non-default database filenames', () => {
    const other = path.join(tmpDir, 'mydata.sqlite');
    expect(getBackupPath(other, 1)).toBe(path.join(tmpDir, 'mydata.backup.1.sqlite'));
  });
});

// ---------------------------------------------------------------------------
// backupDatabase
// ---------------------------------------------------------------------------

describe('backupDatabase', () => {
  it('creates backup.1 on the first run', () => {
    writeDb('v1');
    const result = backupDatabase(dbPath);
    expect(result).toBe(getBackupPath(dbPath, 1));
    expect(fs.readFileSync(getBackupPath(dbPath, 1), 'utf-8')).toBe('v1');
    expect(fs.existsSync(getBackupPath(dbPath, 2))).toBe(false);
  });

  it('shifts backup.1 to backup.2 on the second run', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    writeDb('v2');
    backupDatabase(dbPath);

    expect(fs.readFileSync(getBackupPath(dbPath, 1), 'utf-8')).toBe('v2');
    expect(fs.readFileSync(getBackupPath(dbPath, 2), 'utf-8')).toBe('v1');
  });

  it('keeps only the two most recent backups across multiple runs', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    writeDb('v2');
    backupDatabase(dbPath);
    writeDb('v3');
    backupDatabase(dbPath);

    expect(fs.readFileSync(getBackupPath(dbPath, 1), 'utf-8')).toBe('v3');
    expect(fs.readFileSync(getBackupPath(dbPath, 2), 'utf-8')).toBe('v2');
    expect(fs.existsSync(getBackupPath(dbPath, 3))).toBe(false);
  });

  it('returns null when the source database does not exist', () => {
    expect(backupDatabase(dbPath)).toBeNull();
  });

  it('respects a custom maxBackups parameter', () => {
    writeDb('v1');
    backupDatabase(dbPath, 3);
    writeDb('v2');
    backupDatabase(dbPath, 3);

    expect(fs.existsSync(getBackupPath(dbPath, 1))).toBe(true);
    expect(fs.existsSync(getBackupPath(dbPath, 2))).toBe(true);
    expect(fs.existsSync(getBackupPath(dbPath, 3))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getLatestBackupPath
// ---------------------------------------------------------------------------

describe('getLatestBackupPath', () => {
  it('returns null when no backups exist', () => {
    expect(getLatestBackupPath(dbPath)).toBeNull();
  });

  it('returns backup.1 when it exists', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    expect(getLatestBackupPath(dbPath)).toBe(getBackupPath(dbPath, 1));
  });

  it('falls back to backup.2 when backup.1 is missing', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    writeDb('v2');
    backupDatabase(dbPath);
    // Remove the newest backup
    fs.unlinkSync(getBackupPath(dbPath, 1));

    expect(getLatestBackupPath(dbPath)).toBe(getBackupPath(dbPath, 2));
  });
});

// ---------------------------------------------------------------------------
// cleanupOldBackups
// ---------------------------------------------------------------------------

describe('cleanupOldBackups', () => {
  it('removes backups beyond the retention limit and keeps the rest', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    writeDb('v2');
    backupDatabase(dbPath);
    // Create a stray backup beyond the retention limit
    fs.writeFileSync(getBackupPath(dbPath, 3), 'stray');

    const removed = cleanupOldBackups(dbPath);
    expect(removed).toContain(getBackupPath(dbPath, 3));
    expect(fs.existsSync(getBackupPath(dbPath, 3))).toBe(false);
    expect(fs.existsSync(getBackupPath(dbPath, 1))).toBe(true);
    expect(fs.existsSync(getBackupPath(dbPath, 2))).toBe(true);
  });

  it('returns empty array when no stragglers exist', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    const removed = cleanupOldBackups(dbPath);
    expect(removed).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// restoreFromBackup
// ---------------------------------------------------------------------------

describe('restoreFromBackup', () => {
  it('restores the latest backup and preserves the current file as .corrupted', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    writeDb('v2');
    backupDatabase(dbPath);
    writeDb('corrupted-now'); // simulate corruption of the live DB

    const restored = restoreFromBackup(dbPath);
    expect(restored).toBe(getBackupPath(dbPath, 1));
    expect(fs.readFileSync(dbPath, 'utf-8')).toBe('v2');
    expect(fs.readFileSync(dbPath + '.corrupted', 'utf-8')).toBe('corrupted-now');
  });

  it('returns null when no backup exists', () => {
    expect(restoreFromBackup(dbPath)).toBeNull();
  });

  it('works when no current database file exists (missing file scenario)', () => {
    writeDb('v1');
    backupDatabase(dbPath);
    // Remove the current DB to simulate a missing file
    fs.unlinkSync(dbPath);

    const restored = restoreFromBackup(dbPath);
    expect(restored).toBe(getBackupPath(dbPath, 1));
    expect(fs.readFileSync(dbPath, 'utf-8')).toBe('v1');
  });
});
