-- Migration: 003_lock_dates.sql
-- TICKET-027: Clean up future-dated entries before enforcing the
-- editable-date window (today + 1-day grace).
--
-- Any check-in or daily log entry with a date after "today" is deleted,
-- since those entries should never have been writable.  Historical data
-- (yesterday and older) is preserved — it remains visible as read-only.

DELETE FROM checkins
WHERE date > date('now', 'localtime');

DELETE FROM daily_logs
WHERE date > date('now', 'localtime');
