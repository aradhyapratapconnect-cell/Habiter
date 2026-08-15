-- Migration: 004_remove_categories.sql
-- TICKET-031 Part B: Remove the category feature completely.
--
-- The categories table and habits.category_id are dropped for real (not just
-- unused). Existing habits that had a category simply lose it — the column's
-- data is discarded cleanly, so upgrading users see no errors or crashes.
--
-- Order matters: drop the column first (removes the FK reference), then the
-- table. Verified against the bundled sql.js (DROP COLUMN is allowed on a
-- column used in a foreign key constraint in this SQLite version).

ALTER TABLE habits DROP COLUMN category_id;

DROP TABLE IF EXISTS categories;
