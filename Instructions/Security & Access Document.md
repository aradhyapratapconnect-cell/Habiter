# Security & Access Document — Habiter

**Version:** 1.0
**Written for:** a non-technical founder to understand and sign off on before launch

---

## 1. Authentication Method

**Habiter does not use accounts, logins, or passwords.** This is a deliberate security decision, not an oversight.

**Why this fits:** Habiter is a single-user, fully offline application. There is no server to authenticate against, and no other user could ever access the app remotely. The "account" for a Habiter install is simply "whoever is logged into this computer" — the operating system's own user-account login already provides that boundary.

**What this means in practice:**
- Anyone who can log into the computer and open the app can see and edit the data. Habiter relies on OS-level login/lock-screen security as its access boundary — it does not add its own layer on top by default.
- **Optional nice-to-have for a future version:** an app-level PIN/passcode lock (stored locally, checked on app open) for users sharing a computer who want an extra layer. This is not required for v1 but is worth flagging as a common user request.

## 2. User Roles

Habiter has **exactly one role: the local user.** There is no admin/member/guest distinction because there is no multi-user or multi-device concept in v1.

| Role | Can do | Cannot do |
|---|---|---|
| **Local user** (anyone with OS access to the machine) | Full CRUD on all habits, categories, check-ins, mood/sleep logs, settings; export/import data | Access another installation's data; access the app remotely; anything server-side (there is no server) |

If a future version adds an app-level PIN lock, that still governs access to the single local-user role — it does not create new roles.

## 3. Row-Level Security Rules

Habiter uses a local SQLite file, not a shared multi-tenant database, so classic "row-level security" (as used in something like Postgres with Supabase) does not apply in the traditional sense — there's only one tenant: the person using this specific installation. That said, the equivalent discipline still matters at the application layer:

- **All queries must be scoped to what currently exists in this single local database file.** There is no `user_id` column needed anywhere, since every row in every table implicitly belongs to the one local user.
- **Foreign key integrity must be enforced** (`checkins.habit_id` must reference a real `habits.id`, etc.) so that deleting a habit doesn't leave orphaned check-in rows, and so the app can't be tricked (e.g., via a corrupted import file) into displaying data linked to a nonexistent habit.
- **Import safety is the real "row-level security" concern for this app:** when a user imports a backup/export file, that data must be validated (correct shape, valid foreign keys, no SQL injection via crafted field values) before being written to the database — treat any imported file as untrusted input, even though it's the user's own file, because it could be corrupted, from an older schema version, or tampered with.

## 4. Error Handling Guide

| Failure point | What could go wrong | How it should be handled |
|---|---|---|
| **Database file missing/corrupted on launch** | User's `habiter.db` is deleted, moved, or corrupted (e.g., after a crash mid-write) | App detects the failure on startup, does not silently create a blank replacement over a corrupted file. Instead, prompt the user: offer to attempt repair, restore from the most recent auto-backup (see below), or start fresh — never destroy data without explicit confirmation. |
| **Migration failure on update** | A new app version's schema migration fails partway through | Wrap migrations in a database transaction so a failed migration rolls back completely rather than leaving the schema half-updated. Back up the database file before running any migration. |
| **Notification permission denied (macOS)** | User denies notification permission | App still functions fully; reminders silently don't fire. Show a one-time, dismissible in-app note explaining reminders are off and how to re-enable via System Settings — don't repeatedly nag. |
| **Disk full / write failure** | Check-in or habit edit can't be saved because disk is full or the data directory isn't writable | Catch the write error, show a clear "couldn't save — check disk space" message, and keep the unsaved change in memory/UI state so the user doesn't lose what they just entered. |
| **Invalid import file** | User imports a corrupted, wrong-format, or malicious file | Validate the file's structure and data types before touching the database. Reject with a specific error message (not a silent failure or crash) if validation fails. Never execute anything from the file as code. |
| **Clock/timezone changes** | User travels or changes system timezone, affecting what "today" means for streaks/reminders | Store all dates as plain calendar dates (`YYYY-MM-DD`, no timezone) tied to the user's local day, not UTC timestamps, so a timezone change doesn't retroactively shift historical check-ins. |
| **App crash mid-session** | Electron process crashes | SQLite's write-ahead logging (WAL mode) should be enabled so the last committed check-in isn't lost and the database self-recovers cleanly on next launch. |
| **Duplicate check-in for the same day** | A race condition or double-click creates two status entries for one habit/day | Enforce the unique constraint on (`habit_id`, `date`) at the database level, not just in the UI, so this is structurally impossible. |

## 5. Edge Cases to Handle Before Launch

- **First launch with no habits:** app should show a helpful empty state, not a blank grid that looks broken.
- **Habit deleted but has years of history:** decide and clearly communicate whether deleting a habit deletes its check-in history or just archives/hides it (recommendation: archive by default, with a separate explicit "delete permanently" action that warns about history loss).
- **Very long-running installs (multi-year data):** grid/chart rendering must stay performant as check-in rows grow into the tens of thousands; paginate or virtualize the year view rather than rendering every day at once if needed.
- **Leap years / month-length differences:** grid and chart components must correctly handle 28/29/30/31-day months and not hardcode 31 columns.
- **System sleep/wake affecting scheduled reminders:** a reminder scheduled while the laptop was asleep should still fire (or be caught up) on wake, not silently get skipped.
- **Multiple app instances:** prevent two copies of the app from opening simultaneously and writing to the same SQLite file concurrently (single-instance lock via Electron's `app.requestSingleInstanceLock()`).
- **Uninstall/reinstall:** clarify whether uninstalling the app deletes the local database or leaves it in place for a future reinstall — recommend leaving user data untouched by default OS uninstallers (Electron typically doesn't touch `userData` on uninstall, but this should be verified per-platform).
- **Editing a habit's frequency retroactively:** changing a habit from "daily" to "3x/week" shouldn't retroactively mark past days as missed — streak/completion calculations should respect what the frequency rule was at the time, or clearly document that they always use the current rule.
- **Manual system clock changes:** a user manually setting their system date backward/forward shouldn't be able to corrupt streak calculations in a way that's hard to recover from.
- **Automatic local backups:** recommend the app automatically keeps 1–2 rolling backup copies of the database file (e.g., before each migration and on a periodic schedule) so the corruption scenario above has something to restore from.