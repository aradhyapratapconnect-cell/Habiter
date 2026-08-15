# Feature Ticket List — Habiter

**Version:** 1.0
**Format:** Each ticket is self-contained and written so it can be pasted directly into an AI coding tool as a build prompt. Tickets are ordered so earlier tickets unblock later ones.

---

## Epic: Foundation

### TICKET-001 — Project Scaffolding
**Description:** Set up the Electron + React + TypeScript + Vite project skeleton for Habiter. Configure Tailwind CSS, Zustand, and the folder structure: `electron/` (main process: `main.ts`, `preload.ts`, `db/`, `notifications/`, `ipc/`) and `src/` (renderer: `components/`, `stores/`, `hooks/`, `types/`, `utils/`, `styles/`). Set up `electron-builder.yml` for future packaging. App should launch to a blank window with "Habiter" in the title bar.
**Acceptance Criteria:**
- `npm run dev` launches an Electron window running the Vite dev server with HMR working.
- Folder structure matches the specified layout.
- TypeScript strict mode is enabled with no errors on a clean build.
- Tailwind classes render correctly in the renderer.
**Dependencies:** None.
**Priority:** Must-have

### TICKET-002 — SQLite Database Setup & Migration System
**Description:** Integrate `better-sqlite3` in the Electron main process. Create the database file in the OS-appropriate app data directory via `app.getPath('userData')`. Build a versioned migration runner that applies pending `.sql` migration files in `electron/db/migrations/` on every app start, wrapped in a transaction that rolls back cleanly on failure. Enable WAL mode.
**Acceptance Criteria:**
- On first launch, a `habiter.db` file is created in the correct OS-specific directory.
- Migrations run automatically and are idempotent (safe to run again with no effect if already applied).
- WAL mode is confirmed enabled.
- A failed migration rolls back and does not corrupt the existing schema.
**Dependencies:** TICKET-001
**Priority:** Must-have

### TICKET-003 — Core Database Schema
**Description:** Write the initial migration creating the `habits`, `categories`, `checkins`, `daily_logs`, and `settings` tables exactly as specified in the Technical Architecture Document: `habits` (id, name, icon, category_id, frequency_type, frequency_value, reminder_time, is_archived, sort_order, created_at), `categories` (id, name, color, created_at), `checkins` (id, habit_id, date, status, updated_at — unique on habit_id+date), `daily_logs` (id, date unique, mood, sleep_hours, updated_at), `settings` (key PK, value). Add foreign key constraints between habits→categories and checkins→habits.
**Acceptance Criteria:**
- All five tables exist with correct columns/types after migration runs.
- Foreign key constraints are enforced (inserting a checkin with a non-existent habit_id fails).
- Unique constraint on (habit_id, date) in `checkins` prevents duplicate check-ins.
- Unique constraint on `date` in `daily_logs` prevents duplicate day entries.
**Dependencies:** TICKET-002
**Priority:** Must-have

### TICKET-004 — IPC Bridge Between Renderer and Main Process
**Description:** Build the `preload.ts` contextBridge API and `electron/ipc/handlers.ts` so the React renderer can call database operations (CRUD for habits, categories, checkins, daily_logs, settings) securely without direct Node.js access. Expose a typed API on `window` (e.g., `window.habiterAPI.habits.create(...)`).
**Acceptance Criteria:**
- Renderer can call at least one create/read/update/delete operation per table through the exposed API and see results reflected in the SQLite file.
- `contextIsolation` is enabled and `nodeIntegration` is disabled in the renderer for security.
- All IPC calls are typed end-to-end (shared TypeScript types between main and renderer).
**Dependencies:** TICKET-003
**Priority:** Must-have

### TICKET-005 — Single Instance Lock
**Description:** Prevent two copies of the app from running simultaneously and writing to the same SQLite file concurrently, using Electron's `app.requestSingleInstanceLock()`.
**Acceptance Criteria:**
- Launching a second instance while one is already open focuses the existing window instead of opening a new one.
**Dependencies:** TICKET-001
**Priority:** Must-have

---

## Epic: Habit & Category Management

### TICKET-006 — Habit CRUD UI
**Description:** Build the add/edit habit modal (per Frontend Spec Section 1.3 — Modals component style) allowing the user to set name, icon/emoji, category, frequency type (daily / specific days / times per week), and optional reminder time. Build the habit list/archive view where users can edit, archive, or permanently delete a habit, with a confirm-delete step before permanent deletion (per Security Doc edge case on deleting habits with history — default action is archive, not delete).
**Acceptance Criteria:**
- User can create a habit with all fields and it appears immediately in the check-in grid.
- Editing a habit updates its record without affecting past check-in history.
- Archiving a habit hides it from the active grid but preserves all its check-in history.
- Permanent delete requires an explicit confirmation step and removes the habit and its check-ins.
**Dependencies:** TICKET-004
**Priority:** Must-have

### TICKET-007 — Category Management UI
**Description:** Build a simple interface (list + add/edit modal) for creating categories with a name and color tag, per the `categories` table schema. Categories should be selectable from the habit form built in TICKET-006.
**Acceptance Criteria:**
- User can create, rename, recolor, and delete a category.
- Deleting a category that has habits assigned prompts the user to reassign or leave those habits uncategorized (does not delete the habits).
- Category color tag displays next to habit names in the grid.
**Dependencies:** TICKET-004
**Priority:** Must-have

---

## Epic: Daily Check-In Grid

### TICKET-008 — Check-In Grid Component
**Description:** Build the core daily habit tracker grid per Frontend Spec Section 2 (Center — Daily Habit Tracker): habit names as a sticky left-hand column, days of the current month as columns, each cell colored per status (Completed / Partial / Not Done / Skipped) using the design tokens in Frontend Spec Section 1.1/1.3. Clicking a cell cycles through statuses; writes to the `checkins` table via the IPC API.
**Acceptance Criteria:**
- Grid renders all active (non-archived) habits as rows and all days of the currently viewed month as columns.
- Clicking a cell cycles Not Done → Completed → Partial → Skipped → Not Done and persists the change immediately.
- Grid correctly handles months with 28, 29, 30, and 31 days.
- Grid is horizontally scrollable with the habit-name column pinned when content overflows.
- A legend showing all four status colors is displayed above the grid.
**Dependencies:** TICKET-006, TICKET-003
**Priority:** Must-have

### TICKET-009 — Streak Calculation
**Description:** Implement streak calculation logic in `src/utils/` that computes current streak and best streak per habit, and an overall current/best streak across all habits, calculated on-read from the `checkins` table (not stored as separate columns, per Technical Architecture Document Section 3). A day only counts toward a streak if it matches the habit's frequency rule (e.g., a "3x/week" habit shouldn't require every single day to maintain its streak).
**Acceptance Criteria:**
- Current streak correctly reflects consecutive qualifying days up to today for a `daily` frequency habit.
- Current streak correctly reflects a non-consecutive-days pattern for `specific_days` and `times_per_week` frequency habits.
- Best streak correctly reflects the longest historical streak, not just the current one.
- Streak values update immediately when a check-in status changes.
**Dependencies:** TICKET-008
**Priority:** Must-have

---

## Epic: Reminders

### TICKET-010 — Native Notification Scheduler
**Description:** Build `electron/notifications/scheduler.ts` to schedule native OS notifications (via Electron's `Notification` API) for each habit's `reminder_time`, if set. Reminders should be re-scheduled on app start and whenever a habit's reminder time is edited. Handle the system sleep/wake edge case so a reminder due while the machine was asleep still fires (or is caught up) on wake, per the Security Document.
**Acceptance Criteria:**
- Setting a reminder time on a habit produces a native OS notification at that time on subsequent days.
- Editing or removing a reminder time correctly reschedules or cancels the notification.
- On macOS, the app requests notification permission on first launch and degrades gracefully (habit tracking still works) if denied, showing a one-time dismissible note per the Security Document.
- A reminder scheduled during system sleep still fires after wake rather than being silently skipped.
**Dependencies:** TICKET-006
**Priority:** Must-have

---

## Epic: Stats Dashboard

### TICKET-011 — Overall Progress & Stats Row
**Description:** Build the top stats row and left-column donut per Frontend Spec Section 2 (Stats row + Left column): Overall Progress donut with center percentage, plus Completed / Remaining / Current Streak / Best Streak / Total Habits summary cards, using Recharts for the donut.
**Acceptance Criteria:**
- Overall Progress % accurately reflects completed check-ins as a percentage of total trackable habit-days for the current month.
- All five summary cards display live, correct counts sourced from the database.
- Values update immediately after any check-in change.
**Dependencies:** TICKET-009
**Priority:** Must-have

### TICKET-012 — Monthly Progress Breakdown (Pie Chart)
**Description:** Build the Monthly Progress pie chart (Completed / Partial / Skipped / Not Started breakdown) per Frontend Spec Section 2, with a color-key legend matching the status colors defined in Section 1.1.
**Acceptance Criteria:**
- Pie chart segments accurately reflect the proportion of each check-in status for the currently viewed month.
- Legend colors match the design token colors exactly.
**Dependencies:** TICKET-009
**Priority:** Must-have

### TICKET-013 — Daily Progress Overview (Bar Chart)
**Description:** Build the bar chart showing one bar per day of the month with that day's overall completion percentage, per Frontend Spec Section 2 (bottom row, column 1).
**Acceptance Criteria:**
- Chart renders one bar per calendar day in the current month.
- Bar height accurately reflects the percentage of habits marked Completed that day.
- Chart updates when check-ins change.
**Dependencies:** TICKET-009
**Priority:** Must-have

### TICKET-014 — Weekly Progress View
**Description:** Build the Weekly Progress list showing one row per week (Week 1–5) with a per-day-of-week (Mon–Sun) horizontal progress indicator and an overall completion % per week, per Frontend Spec Section 2 (bottom row, column 2).
**Acceptance Criteria:**
- Weeks are correctly bucketed for the current month, including partial first/last weeks.
- Per-day and per-week percentages are accurate against the underlying check-in data.
**Dependencies:** TICKET-009
**Priority:** Must-have

### TICKET-015 — Top Habits Ranking
**Description:** Build the "Top Habits This Month" ranked list (top 5 by completion rate) per Frontend Spec Section 2 (bottom row, column 3), showing rank, icon, name, a progress bar, and completion %.
**Acceptance Criteria:**
- List correctly ranks habits by completion percentage for the current month, highest first.
- Ties are broken by a consistent, defined rule (e.g., alphabetical).
- List updates when check-ins change.
**Dependencies:** TICKET-009
**Priority:** Should-have

---

## Epic: Mood & Sleep

### TICKET-016 — Mood & Sleep Daily Logging
**Description:** Build a simple daily input (e.g., accessible from the grid header or a small daily-log widget) for logging mood (emoji scale) and sleep hours, writing to the `daily_logs` table.
**Acceptance Criteria:**
- User can set mood and sleep hours for any day (defaulting to today).
- Only one `daily_logs` row exists per date (enforced by the unique constraint from TICKET-003).
- Values persist and are retrievable for the charts in TICKET-017.
**Dependencies:** TICKET-003, TICKET-004
**Priority:** Must-have

### TICKET-017 — Mood Tracker Strip
**Description:** Build the Mood Tracker footer row per Frontend Spec Section 2: one emoji per day of the month reflecting that day's logged mood.
**Acceptance Criteria:**
- Row renders one emoji slot per day of the currently viewed month.
- Days with no logged mood show a clear neutral/empty state, not a misleading default.
**Dependencies:** TICKET-016
**Priority:** Must-have

---

## Epic: Data Portability & Reliability

### TICKET-018 — Export to JSON/CSV
**Description:** Build an export feature (Settings screen) that writes all habits, categories, checkins, and daily_logs to a user-chosen local file via Electron's native `dialog` API, in JSON (full fidelity) and CSV (human-readable) formats.
**Acceptance Criteria:**
- Exported JSON file contains all data needed to fully reconstruct the database.
- CSV export is readable in a spreadsheet application.
- Export completes without any network call.
**Dependencies:** TICKET-004
**Priority:** Must-have

### TICKET-019 — Import with Validation
**Description:** Build an import feature that reads a previously exported JSON file and restores it into the database. Per the Security Document, treat the imported file as untrusted input: validate structure, data types, and foreign key integrity before writing anything to the database, and reject with a specific error message on any validation failure.
**Acceptance Criteria:**
- A valid export file re-imports cleanly with all data intact.
- A malformed or corrupted file is rejected with a clear, specific error message and no partial/corrupt write occurs.
- Import does not execute any code or content from the file beyond parsing structured data fields.
**Dependencies:** TICKET-018
**Priority:** Must-have

### TICKET-020 — Startup Database Integrity Check & Recovery
**Description:** Per the Security Document's error handling guide, detect a missing or corrupted database file on launch. Do not silently overwrite it. Offer the user a choice: attempt repair, restore from the most recent automatic backup (see TICKET-021), or start fresh.
**Acceptance Criteria:**
- A corrupted `habiter.db` is detected on launch rather than crashing or silently resetting.
- User is shown a clear choice dialog with the three recovery options.
- Choosing "start fresh" only happens with explicit confirmation and never destroys a recoverable backup without warning.
**Dependencies:** TICKET-002
**Priority:** Must-have

### TICKET-021 — Automatic Local Backups
**Description:** Implement rolling automatic backups of the SQLite database file — before every migration and on a periodic schedule (e.g., daily) — keeping the 1–2 most recent backups, per the Security Document's recommendation.
**Acceptance Criteria:**
- A backup copy is created before any migration runs.
- A periodic backup runs automatically during normal use without user action.
- Old backups beyond the retention limit are cleaned up automatically.
**Dependencies:** TICKET-002
**Priority:** Should-have

---

## Epic: Visual Design & Layout

### TICKET-022 — Design System Implementation (Theme Tokens)
**Description:** Implement the full dark green/black color palette, typography scale, and component styles (buttons, inputs, cards, modals) exactly as specified in Frontend Spec Section 1, as Tailwind config tokens / CSS variables reused across all components.
**Acceptance Criteria:**
- All colors used in the app map to the named tokens in Frontend Spec Section 1.1 (no ad-hoc hex values in component code).
- Buttons, inputs, cards, and modals visually match the specified styles across the whole app.
- Typography scale is applied consistently (no one-off font sizes).
**Dependencies:** TICKET-001
**Priority:** Must-have

### TICKET-023 — Full Dashboard Layout Assembly
**Description:** Assemble the complete dashboard screen matching the zone-by-zone layout in Frontend Spec Section 2: top bar (date, title, sleep), stats row (6 cards), left column (donut + pie), center (check-in grid), bottom row (daily bar chart, weekly progress, top habits), footer (mood tracker, notes). Implement the responsive stacking behavior described (grid keeps priority space; columns stack on narrow windows).
**Acceptance Criteria:**
- Full dashboard matches the described zone layout with all components from prior tickets slotted into their correct positions.
- Resizing the window below a defined width threshold reflows to a single-column stacked layout in the specified priority order (grid first).
- No zone overlaps or clips content at common desktop window sizes.
**Dependencies:** TICKET-008, TICKET-011, TICKET-012, TICKET-013, TICKET-014, TICKET-015, TICKET-017, TICKET-022
**Priority:** Must-have

### TICKET-024 — Notes Widget
**Description:** Build the simple free-text Notes card in the dashboard footer per Frontend Spec Section 2 — a static per-month note field the user can edit, stored via the `settings` table (or a dedicated small table if preferred).
**Acceptance Criteria:**
- User can type and save a note; it persists across app restarts.
- Note is scoped per month (or clearly documented as global, if that's the simpler chosen implementation).
**Dependencies:** TICKET-004
**Priority:** Nice-to-have

---

## Epic: Packaging & Distribution

### TICKET-025 — Cross-Platform Build & Packaging
**Description:** Configure `electron-builder` to produce a Windows `.exe`, macOS `.dmg`, and Linux `.AppImage`/`.deb` installer, per the Technical Architecture Document. Confirm `app.getPath('userData')` resolves correctly and consistently on all three OSes.
**Acceptance Criteria:**
- Running the build produces installable packages for all three target platforms.
- App launches correctly post-install on each platform with database creation working in the correct OS-specific directory.
**Dependencies:** TICKET-001 through TICKET-024 (functionally complete app)
**Priority:** Must-have

### TICKET-026 — First-Launch Empty State
**Description:** Build the first-launch experience per PRD Section 5: an empty-grid state with a prompt to add the first habit, with a few example habits pre-filled but clearly marked as removable/editable.
**Acceptance Criteria:**
- On a fresh install with no habits, the dashboard shows a clear, friendly empty state rather than a blank/broken-looking grid.
- Example habits are present but visually/textually flagged as editable starter content, not permanent defaults.
**Dependencies:** TICKET-006, TICKET-023
**Priority:** Must-have

---

###	TICKET-027 - 	Restrict Check-In & Sleep/Mood Entry to Today + 24-Hour Grace Window
**Description:**	Currently, clicking the day-navigation controls in the check-in grid and the mood/sleep log lets a user navigate to any date — past or future — and mark habits as Completed/Partial/Skipped, or log mood and sleep hours, for days other than today. This is a data-integrity loophole: it lets a user pre-fill future days or retroactively fill in old missed days, artificially inflating completion %, current streak, and best streak. The rule must become: a user can create or edit a check-in, mood entry, or sleep entry only for today, or for yesterday (a one-day grace window to correct an honest mistake, like forgetting to check off a habit they actually completed). Every other day — anything older than yesterday, and any future day — becomes view-only.
**Acceptance Criteria**	
1. In the check-in grid, only today's and yesterday's date columns are clickable/editable. All other columns (2+ days old, and any future date) are visually locked — grayed cursor, no hover state, no click response — and display existing historical status as read-only.
2. Mood and sleep logging follows the same rule: editable only for today and yesterday.
3. Once yesterday rolls past the grace window (i.e., it becomes 2 days old at the next midnight), it locks permanently — no further edits possible.
4. Enforced at the database/IPC service layer, not just the UI — any direct API call attempting to write a check-in, mood, or sleep entry for a date older than yesterday, or a future date, must be rejected.
5. At midnight, the editable window automatically shifts (today becomes yesterday, new today unlocks) without requiring an app restart.
6. Existing historical data beyond the grace window remains fully visible and unaffected — this ticket restricts new edits, not display.
7. Streak and stats calculations (TICKET-009, TICKET-011–015) are re-verified to work correctly with the write-window rule in place, and any pre-existing future-dated entries in a user's data are nulled out via a migration before this fix ships.
**Dependencies**	TICKET-003 (schema), TICKET-008 (check-in grid), TICKET-016 (mood/sleep logging), TICKET-009 (streak calc — must be re-verified after this fix)
**Priority**	Must-have (data-integrity bug — blocks launch)

### TICKET-028 	Fix App Identity — Taskbar Shows "Electron" Instead of "Habiter"
**Description** The taskbar/dock right-click menu and window title currently show the default Electron boilerplate name and icon instead of "Habiter" and the Habiter logo. This happens because the app's product name, icon, and window metadata were never properly configured — Electron falls back to its own default branding (name "Electron", generic icon) when these aren't set. This must be fixed at the packaging/build-config level, not just in the window title string, so it's correct in the taskbar, dock, Alt-Tab/Task Switcher, right-click context menu, and installer — everywhere the OS displays the app identity

**Acceptance criteria**  . package.json productName (or equivalent in electron-builder.yml) is set to "Habiter" — this is what the OS uses for the taskbar/dock/right-click label, not the window title alone.
2. The app icon (from the finalized Habiter logo) is set for all platforms: .ico for Windows, .icns for macOS, and .png set for Linux, referenced correctly in electron-builder.yml.
3. BrowserWindow's title property and the HTML <title> tag are both set to "Habiter", not the Vite/Electron default.
4. After a fresh build and install (not just npm run dev), right-clicking the taskbar/dock icon shows "Habiter" and the correct logo — verified on Windows specifically, since that's what the screenshot shows, and cross-checked on macOS/Linux per TICKET-029.
5. Alt-Tab / Task Switcher and the OS notification sender name (from TICKET-010 reminders) also show "Habiter", not "Electron".
6. Uninstaller/Programs list entry (Windows "Apps & Features", macOS Applications folder) shows "Habiter" as the app name.

**Dependencies***	TICKET-001 (project scaffolding), TICKET-022 (final logo/icon asset must exist before this can be fully completed), TICKET-025 (packaging config)

**Priority**	Must-have (branding/identity bug — blocks launch)

### TICKET-029 	Full Cross-OS Compatibility Verification (Windows / macOS / Linux)

**Description** Before launch, the entire app must be manually verified end-to-end on all three target operating systems — Windows, macOS, and Linux — not just built successfully, but actually run and tested for functional and visual correctness on each. This ticket exists to catch OS-specific issues that don't show up in development on a single machine: file path handling, native notification behavior, window chrome/title bar rendering, packaging differences, and app-data directory resolution.

**Acceptance Criteria**	1. App installs and launches successfully from the packaged installer (not dev mode) on Windows 10/11, macOS (latest and one version prior), and at least one major Linux distro (e.g., Ubuntu via .AppImage or .deb).
2. app.getPath('userData') correctly resolves to the OS-appropriate directory on all three, and the SQLite database is created and persists correctly on each.
3. Native OS notifications (TICKET-010) fire correctly and show the correct app name/icon (per TICKET-028) on all three OSes — including confirming the macOS notification-permission prompt appears and is handled gracefully.
4. Taskbar/dock icon, right-click menu label, window title, and Alt-Tab identity all show "Habiter" correctly on all three (this ticket re-verifies TICKET-028's fix across every OS, not just Windows).
5. Full dashboard layout (TICKET-023) renders correctly with no clipping, overlap, or font-rendering issues on each OS's default display scaling settings.
6. Export/import (TICKET-018/019) and the native file save/open dialogs work correctly on each OS.
7. Single-instance lock (TICKET-005) is confirmed working on each OS, since instance-locking behavior can differ by platform.
8. Any OS-specific bug found during this verification gets logged as its own follow-up ticket rather than being silently patched without a record.

**Dependencies**	TICKET-025 (cross-platform build), TICKET-028 (app identity fix — needs to be verified across OSes here)
**Priority**	Must-have (blocks launch — an app that only works on one OS doesn't meet the PRD's stated platform support)


###	TICKET-030 	Set Up GitHub Actions Workflow for Automated Windows/macOS/Linux Builds & GitHub Releases
**Description**	Habiter currently has to be built manually on each OS to produce installers. This ticket sets up a GitHub Actions workflow (.github/workflows/release.yml) that automatically builds the Windows .exe, macOS .dmg, and Linux .AppImage/.deb installers in parallel whenever a version tag (e.g., v1.0.0) is pushed, and uploads all three to a single GitHub Release using electron-builder's --publish always flag. This removes the need to own or access three separate physical machines to cut a release.
**Acceptance Criteria**	1. .github/workflows/release.yml exists with a matrix strategy running on windows-latest, macos-latest, and ubuntu-latest simultaneously.
2. Workflow triggers on pushing a tag matching v* (e.g., v1.0.0).
3. Each OS runner installs dependencies, runs the TypeScript/Vite build, then runs electron-builder --publish always to build and upload that platform's installer.
4. Workflow has permissions: contents: write set so it's authorized to create/update the GitHub Release.
5. A test tag push produces a single GitHub Release containing all three installer files (.exe, .dmg, .AppImage/.deb).
6. Build failures on any one OS are clearly visible in the Actions tab with readable logs, without silently failing.
7. productName, icon paths, and app identity from TICKET-028 are confirmed correctly baked into each platform's build output through this pipeline (not just local builds).
**Dependencies**	TICKET-025 (electron-builder packaging config), TICKET-028 (app identity/icon must be finalized so the pipeline packages the correct branding)
**Priority**	Must-have (this is the mechanism that makes public distribution repeatable)


###	TICKET-031	Add Missing Delete Option for Habits + Fully Remove the Category Feature
**Description**	Two changes bundled together since they both touch the habit management UI:

Part A — Delete option missing: There is currently no way for a user to permanently delete a habit from the app. TICKET-006 specified a permanent-delete action with a confirmation step (separate from archive), but it's either missing or not reachable in the current build. This must be added to the habit list/management view: an explicit "Delete" action per habit, requiring confirmation before it permanently removes the habit and all its associated check-in history.

Part B — Remove categories completely: The category feature (originally built in TICKET-007) is no longer wanted. Remove it entirely: the category picker from the add/edit habit form, the category management screen, category color tags shown next to habit names in the grid, and the categories table plus the category_id column on habits. This is a full removal, not a hide-and-keep-in-schema — the goal is a simpler habit list with no grouping concept at all.
**Acceptance Criteria**	
Part A:
1. Each habit in the management/list view has a clearly visible "Delete" action.
2. Clicking Delete shows a confirmation dialog warning that this permanently removes the habit and its full check-in history.
3. Confirming delete removes the habit row and cascades to delete all associated checkins rows for that habit.
4. Canceling the confirmation leaves the habit and its data untouched.
5. An "Archive" option (hide from active grid, keep history) remains available as a separate, non-destructive alternative to Delete, per the original TICKET-006 behavior.

Part B:
6. The category field is removed from the add/edit habit form — habits no longer have a category selector.
7. The categories management screen/UI is removed entirely.
8. Category color tags no longer appear anywhere in the check-in grid or habit list.
9. A database migration drops the categories table and removes the category_id column from habits (do not just stop using it — actually remove it from the schema).
10. Existing users upgrading from a version with category data do not see errors or crashes; the migration cleanly handles existing rows that had a category_id set.
11. All references to categories in the PRD, Technical Architecture Document, and Frontend Specification Document should be updated in a follow-up documentation pass to reflect this removal (flagged here, not required for code completion).
**Dependencies**	TICKET-003 (schema), TICKET-006 (habit CRUD/delete), TICKET-007 (categories — being reversed by this ticket)
**Priority**	Must-have

## Explicitly Out of Scope for This Ticket List (per PRD Section 8)
No tickets exist for: user accounts/auth, cloud sync, social/sharing features, mobile apps, in-app purchases, analytics/telemetry, AI coaching, habit templates marketplace, light mode/theme switching, or multi-device sync. Do not create tickets for these without a PRD revision first.
