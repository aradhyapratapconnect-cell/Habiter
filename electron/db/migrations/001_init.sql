-- Migration: 001_init.sql
-- Description: Initial migration to verify the migration runner works.
-- This creates a simple app_info table as a sanity check.
-- TICKET-003 will create the core schema (habits, categories, etc.).

CREATE TABLE IF NOT EXISTS app_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_info (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO app_info (key, value) VALUES ('created_at', datetime('now'));
