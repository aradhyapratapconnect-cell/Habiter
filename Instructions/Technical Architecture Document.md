# Technical Architecture Document — Habiter

**Version:** 1.0

---

## 1. Recommended Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| **App shell** | Electron | Only realistic option for a single codebase that ships native installers for Windows, macOS, and Linux with access to OS-level features (native notifications, file system, tray icon) while using web technologies for the UI. |
| **UI framework** | React 18 + TypeScript | React gives a mature component model for the dashboard-heavy UI (grids, charts, modals). TypeScript catches schema/shape mismatches between the SQLite layer and the UI at compile time — important since this is a solo/small-team project without a large QA net. |
| **Build tooling** | Vite | Fast dev server and HMR for the renderer process; far quicker iteration than Webpack for a small-to-medium app. |
| **Local database** | SQLite via `better-sqlite3` | Synchronous, fast, zero-config, single-file database — ideal for a local desktop app with no server. `better-sqlite3` is used (over `sqlite3`) because it's synchronous and simpler to reason about inside Electron's main process, and has no native async callback overhead for a single-user, low-concurrency use case. |
| **State management** | Zustand | Lightweight, minimal boilerplate compared to Redux; fits an app of this size (habits, check-ins, stats, settings) without over-engineering. |
| **Charts** | Recharts | Covers all dashboard needs (bar charts, donut/pie, line charts) with a React-native API and good performance for the data volumes involved (max ~365 days × dozens of habits). |
| **Styling** | Tailwind CSS | Enables the dark green/black design system to be expressed as reusable utility classes and design tokens (see Frontend Specification Document) without a heavy CSS-in-JS runtime cost. |
| **Notifications** | Electron `Notification` API (native OS notifications) | Gives true native notification behavior per OS rather than an in-app fake toast, matching the "reminders" requirement. |
| **Packaging/distribution** | `electron-builder` | Produces signed installers (.exe, .dmg, .AppImage/.deb) and supports auto-update infrastructure if added later; the standard tool for this exact use case. |
| **Testing** | Vitest (unit) + Playwright (E2E via Electron) | Vitest integrates natively with Vite; Playwright has first-class Electron support for testing the full app flow (add habit → check in → see stats). |

## 2. Project File & Folder Structure

```
habiter/
├── electron/                      # Main process (Node.js side)
│   ├── main.ts                    # App entry point, window creation, lifecycle
│   ├── preload.ts                 # Secure bridge between main and renderer (contextBridge)
│   ├── db/
│   │   ├── database.ts            # SQLite connection setup, migrations runner
│   │   ├── migrations/            # Versioned .sql migration files
│   │   └── queries/                # Query modules: habits.ts, checkins.ts, moods.ts, etc.
│   ├── notifications/
│   │   └── scheduler.ts           # Schedules and fires native OS reminders
│   └── ipc/
│       └── handlers.ts            # IPC channel handlers (renderer <-> main communication)
├── src/                            # Renderer process (React app)
│   ├── main.tsx                   # React entry point
│   ├── App.tsx
│   ├── components/
│   │   ├── dashboard/              # Overall progress donut, streak cards, top habits
│   │   ├── habit-grid/             # The daily check-in grid component
│   │   ├── charts/                 # Daily progress, weekly progress, mood/sleep charts
│   │   ├── habit-form/              # Add/edit habit modal
│   │   └── shared/                  # Buttons, inputs, cards, modals (design system components)
│   ├── stores/                     # Zustand stores: habitsStore.ts, checkinsStore.ts, settingsStore.ts
│   ├── hooks/                      # Custom React hooks
│   ├── types/                      # Shared TypeScript types/interfaces
│   ├── utils/                      # Streak calculation, date helpers, export/import logic
│   └── styles/                     # Tailwind config, global CSS, design tokens
├── build/                          # electron-builder config & platform icons
├── scripts/                        # Build/release helper scripts
├── tests/
│   ├── unit/
│   └── e2e/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
└── README.md
```

## 3. Database Schema

All tables live in a single local SQLite file (e.g., `habiter.db`, stored in the OS's standard app-data directory). Explained in plain English below each table.

### `habits`
Stores each habit the user has created.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID), PK | Unique habit identifier |
| `name` | TEXT | Habit name, e.g., "Gym" |
| `icon` | TEXT | Emoji or icon key |
| `category_id` | TEXT, FK → `categories.id` | Nullable — a habit can be uncategorized |
| `frequency_type` | TEXT | One of: `daily`, `specific_days`, `times_per_week` |
| `frequency_value` | TEXT (JSON) | e.g., `["mon","wed","fri"]` or `{"count":3}` depending on type |
| `reminder_time` | TEXT (nullable) | Local time string, e.g., `"07:00"` |
| `is_archived` | BOOLEAN | Archived habits are hidden from the active grid but retain history |
| `sort_order` | INTEGER | Controls display order in the grid |
| `created_at` | DATETIME | |

### `categories`
User-defined groupings for habits.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID), PK | |
| `name` | TEXT | e.g., "Health" |
| `color` | TEXT | Hex color used as the category tag |
| `created_at` | DATETIME | |

**Relationship:** One category has many habits (`habits.category_id` → `categories.id`).

### `checkins`
One row per habit per day — the core data of the app.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID), PK | |
| `habit_id` | TEXT, FK → `habits.id` | |
| `date` | TEXT (ISO date, `YYYY-MM-DD`) | |
| `status` | TEXT | One of: `completed`, `partial`, `not_done`, `skipped` |
| `updated_at` | DATETIME | |

**Relationship:** One habit has many check-ins (one per date it's tracked). Unique constraint on (`habit_id`, `date`) — a habit can only have one status per day.

### `daily_logs`
Stores mood and sleep, which are day-level (not per-habit) data points.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID), PK | |
| `date` | TEXT (ISO date), unique | One row per calendar day |
| `mood` | TEXT (nullable) | Emoji/enum value, e.g., `great`, `good`, `neutral`, `bad`, `terrible` |
| `sleep_hours` | REAL (nullable) | e.g., `7.5` |
| `updated_at` | DATETIME | |

### `settings`
Simple key-value table for app-level preferences.

| Field | Type | Notes |
|---|---|---|
| `key` | TEXT, PK | e.g., `theme`, `week_start_day`, `notifications_enabled` |
| `value` | TEXT | Stored as string/JSON |

### Derived data (not stored, calculated at runtime)
Streaks (current/best, per-habit and overall) and completion percentages are **calculated from `checkins` on read**, not stored as separate columns — this avoids data drift where a stored streak value could get out of sync with the actual check-in history. If performance becomes an issue with very large histories, a caching layer can be added later without changing the schema.

## 4. Environment Variables & Configuration Notes

Since Habiter is a fully offline, single-user desktop app with no external services, there is **no `.env` file with API keys or secrets required for core functionality**. Configuration to be aware of:

- **App data location:** Use Electron's `app.getPath('userData')` to determine the OS-appropriate storage directory for `habiter.db` (e.g., `%APPDATA%/Habiter` on Windows, `~/Library/Application Support/Habiter` on macOS, `~/.config/Habiter` on Linux). Never hardcode a path.
- **Build-time config:** `electron-builder.yml` needs per-platform signing configuration if you intend to code-sign releases (recommended for macOS/Windows to avoid OS security warnings on install) — this requires a code-signing certificate, which is a paid step to budget for separately if pursued.
- **Migrations:** On every app start, run any pending SQL migrations against the local database before rendering the UI, so schema changes in future versions apply automatically to existing users' data.
- **Notification permissions:** macOS requires the app to request notification permission at first launch; Windows/Linux generally do not need explicit runtime permission but do need a valid app identity (AppUserModelID on Windows) for notifications to display correctly.
- **No network calls in core app.** If nice-to-have features like optional cloud backup are added later, any such calls must be explicitly opt-in and clearly separated from the core offline codepath.