# Frontend Specification Document — Habiter

**Version:** 1.0

---

## 1. Design System

### 1.1 Color Palette

Dark, green-accented theme — no light mode in v1.

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0B1410` | App background (near-black with a green undertone) |
| `--bg-secondary` | `#121F19` | Card/panel backgrounds |
| `--bg-elevated` | `#182B22` | Modals, dropdowns, hover surfaces |
| `--border-subtle` | `#24382E` | Card borders, grid lines, dividers |
| `--accent-primary` | `#22C55E` | Primary green — completed states, primary buttons, active streak flame |
| `--accent-primary-hover` | `#16A34A` | Hover/pressed state for primary accent |
| `--accent-secondary` | `#4ADE80` | Lighter green — highlights, progress bar fills, chart lines |
| `--status-partial` | `#EAB308` | Partially-done cell/badge color (amber, kept distinct from green) |
| `--status-not-done` | `#3A4A41` | Not-done cell — muted, low-contrast, recedes visually |
| `--status-skipped` | `#EF4444` | Skipped/missed indicator (used sparingly — not punitive, just informational) |
| `--text-primary` | `#EAF5EE` | Headings, primary body text |
| `--text-secondary` | `#8FA89B` | Secondary/muted text, labels, captions |
| `--text-disabled` | `#54695E` | Disabled states |

**Design principle:** green = progress/completion, amber = partial, muted gray-green = neutral/not-done, red = used only for "skipped," never as a shaming or aggressive color — it should read as informational, not punitive, in keeping with the product's non-judgmental tone.

### 1.2 Typography

| Token | Font | Usage |
|---|---|---|
| Primary typeface | **Inter** (or system-ui fallback stack) | All UI text — clean, highly legible at small sizes needed for the dense check-in grid |
| Monospace (optional) | **JetBrains Mono** | Numeric stats (streak counts, percentages) if a slightly technical/data feel is desired |

| Style | Size | Weight | Usage |
|---|---|---|---|
| `text-display` | 28px | 700 | Dashboard title ("Habiter") |
| `text-h1` | 20px | 600 | Section headers ("Overall Progress", "Daily Habit Tracker") |
| `text-h2` | 16px | 600 | Card titles |
| `text-body` | 14px | 400 | Standard UI text |
| `text-small` | 12px | 400 | Grid date headers, captions, secondary labels |
| `text-stat` | 32px | 700 | Large stat numbers (e.g., "76%", streak counts) |

### 1.3 Component Styles

**Buttons**
- Primary: solid `--accent-primary` fill, `--bg-primary` text, 8px border-radius, subtle scale/opacity on hover (`--accent-primary-hover`).
- Secondary: transparent background, 1px `--border-subtle` border, `--text-primary` text; fills to `--bg-elevated` on hover.
- Destructive (delete habit, etc.): outline style using `--status-skipped` red, only filled solid after a confirm step — avoid a solid red button as the default resting state to prevent accidental destructive clicks.

**Inputs**
- Background `--bg-elevated`, 1px `--border-subtle` border, 8px border-radius, `--text-primary` text, `--text-secondary` placeholder.
- Focus state: border color shifts to `--accent-primary` with a subtle 2px glow/outline — no color changes elsewhere to keep focus indication unambiguous.

**Cards**
- Background `--bg-secondary`, 1px `--border-subtle` border, 12px border-radius, 16–20px internal padding.
- Used for every dashboard module (progress donut, streak stats, chart panels) — consistent card shell throughout so the dashboard reads as one system, not mismatched widgets.

**Modals**
- Background `--bg-elevated`, centered, 16px border-radius, dimmed `--bg-primary` overlay at ~70% opacity behind it.
- Used for: add/edit habit, add/edit category, confirm-delete, export/import.

**Check-in grid cells** (the core interactive element)
- Default (not done): `--status-not-done` fill, no icon.
- Completed: `--accent-primary` fill with a checkmark icon.
- Partial: `--status-partial` fill with a half-fill or dash icon.
- Skipped: `--border-subtle` fill with a small "skip" icon (e.g., a circle-slash), kept visually quiet rather than alarming.
- Cells are click-to-cycle (click advances through states) or right-click/long-press for a status picker — single-click-cycle is recommended as the primary interaction for speed.

### 1.4 Spacing & Layout Rules

- **Base unit:** 4px grid — all spacing values are multiples of 4 (4, 8, 12, 16, 24, 32, 48px).
- **Page margin:** 24px on desktop window edges.
- **Card gap:** 16px between dashboard cards in the grid layout.
- **Check-in grid:** fixed-width day columns (minimum 24px per cell for click targets), horizontally scrollable for the full-year view, with the habit-name column sticky/pinned on the left.
- **Responsive behavior:** since this is a desktop app with a resizable window (not a phone), layout should reflow from a multi-column dashboard grid (wide window) down to a single-column stacked layout (narrow window) rather than using fixed breakpoints tied to specific device sizes.

## 2. Dashboard Layout (Wireframe)

The main screen is a single scrollable dashboard, organized top to bottom into the following zones. Layout structure follows the reference wireframe the founder provided, re-themed to dark green/black (that reference was purple/lavender and is explicitly rejected for color — only its spatial layout is being reused).

**Top bar** (full width, single row, three sections)
- Left: "Today's Date" card — current date + day of week.
- Center: App title ("Habiter") + tagline, centered.
- Right: "Hours of Sleep" card — last logged sleep value + short encouraging note.

**Stats row** (full width, single row of 6 cards)
1. Overall Progress — donut chart with center percentage label.
2. Completed — count + "habits this month" label.
3. Remaining — count + "habits left" label.
4. Current Streak — count + "days" label.
5. Best Streak — count + "days" label.
6. Total Habits — count + "habits tracked" label.

**Left column** (below top bar, narrow ~20% width)
- Overall Progress donut (large version) with a "Great job!" / encouragement caption.
- Monthly Progress pie chart below it, broken down by status (Completed / Partial / Skipped / Not Started), with a color-key legend.

**Center — Daily Habit Tracker** (wide, ~60% width, the largest element on the page)
- A legend row at top: Completed / Partially Done / Not Done / Skipped, each with its status color swatch.
- Below that: the full check-in grid — habit names as sticky left-hand rows, days of the current month as columns (1–31), each cell showing the status color/icon per the design system in Section 1.3.
- Grid is horizontally scrollable if the window is narrow; habit name column stays pinned.

**Bottom row, three columns, roughly equal width**
1. **Daily Progress Overview** — bar chart, one bar per day of the month, showing that day's overall completion %.
2. **Weekly Progress** — a small table/list, one row per week (Week 1–5), showing a horizontal progress bar per day of week (Mon–Sun) plus a completion % per week.
3. **Top Habits This Month** — ranked list (top 5), each row showing rank number, habit icon + name, a horizontal progress bar, and completion %.

**Footer row, two columns**
1. **Mood Tracker** — one row, one emoji per day of the month (1–31), reflecting the day's logged mood.
2. **Notes** — a simple free-text card for the user's own reminders/motivational note, static per month (not day-specific).

**Layout notes for implementation:**
- Every zone above is its own Card component per Section 1.3 — consistent border-radius, background, and padding throughout.
- On a narrower window, columns stack vertically in this priority order: Daily Habit Tracker first (it's the core feature), then stats row, then side charts, then bottom row items, then footer.
- The grid is the visual and functional center of the app — it should never be the first thing to shrink or scroll out of view; give it the most horizontal space by default.

## 3. API & Integration Specification

Habiter's core functionality requires **no third-party services** — it is offline by design (per the PRD and Security document, zero telemetry, no cloud sync). The "integrations" in this app are all **local OS-level APIs**, not external HTTP services:

| Integration | What it does | How it's called | Data sent / response |
|---|---|---|---|
| **Electron `Notification` API** | Fires native OS desktop notifications for habit reminders | Called from the Electron main process via `new Notification({ title, body })`, triggered by the local reminder scheduler at the user-set time | No data sent externally — this is a local OS call. The notification body contains the habit name/reminder text; response is the OS notification being displayed (no callback data expected, optional click-to-open-app handler). |
| **Electron `dialog` API** | Native "Save File" / "Open File" dialogs for export/import | Called from the main process when the user clicks Export or Import in Settings | No data sent externally. Sends the local file path chosen by the OS dialog back to the app; the app then reads/writes the JSON/CSV file directly to disk. |
| **`app.getPath('userData')`** | Resolves the correct OS-specific storage directory for the SQLite database | Called once at app startup before opening the database connection | Returns a local file system path string; no external data transfer. |
| **electron-updater (optional, future)** | If auto-update is added later, checks a GitHub Releases feed for new versions | Would call the GitHub Releases API on a schedule/on-launch (only integration that would touch the network) | Sends: current app version, OS/arch. Receives: latest release metadata and download URL. **This must remain the only network-touching feature and must be clearly disclosed to users if implemented, or made explicitly opt-in**, to stay consistent with the zero-telemetry commitment in the Security & Access Document. |

**No other integrations exist in v1** — no analytics SDK, no crash reporting service, no authentication provider, no payment processor, no cloud storage API. Any future nice-to-have that requires a real third-party service (e.g., an optional user-managed cloud backup) should get its own addendum to this document before implementation, specifically calling out what data would leave the device and requiring explicit user opt-in.