Product Requirements Document — Habiter

Version: 1.0 Document owner: Product Status: Draft for build

1. Overview

Habiter is a free, offline-first desktop application for tracking daily habits. It runs entirely on the user's own machine (Windows, macOS, and Linux), stores all data locally, and requires no account, no internet connection, and no cloud sync. Users download it from GitHub or a project website, install it, and start tracking habits immediately.

One-line description: A private, offline habit tracker that gives you a full year of your habits, streaks, mood, and sleep in one dashboard — with zero data ever leaving your machine.

2. Problem Statement

Most habit trackers today are:

Subscription-gated — core features locked behind a paywall.
Cloud-dependent — require an account and send personal behavioral data to a third-party server.
Mobile-first — weak or nonexistent desktop experiences, despite many people planning their day at a desk.
Cluttered — dashboards that prioritize gamification and social features over a clear, honest view of consistency.

People who want to build habits need a tool that is private by default, doesn't ask them to pay or sign up, and gives them an honest, data-rich view of their own consistency over time — not streak-shaming or social comparison.

3. Target Users
Primary: Individuals who want a personal, private habit-tracking tool and are comfortable installing a desktop app (self-directed learners, remote workers, people already using tools like Notion/Obsidian for personal systems).
Secondary: Developers/tinkerers who find the project on GitHub, use it themselves, and potentially contribute.

Habiter is built first for personal use by the creator, then packaged for public distribution — so "user" and "developer" are initially the same person, which should inform tone and defaults (no onboarding friction, no forced tutorials).

4. Core Features
Must-Have (MVP / v1)
Feature	Description
Habit management	Create, edit, archive, and delete habits. Each habit has a name, icon/emoji, category, and a target frequency (daily, specific days of week, or X times per week).
Categories	Group habits into user-defined categories (e.g., Health, Work, Mindfulness) with a color tag.
Daily check-in grid	Annual/monthly grid view (habit rows × day columns) where each cell can be marked Completed, Partially Done, Not Done, or Skipped.
Streaks	Current streak and best streak calculated per habit, plus an overall current/best streak.
Reminders	Native OS desktop notifications at user-set times per habit (e.g., "Meditation — 7:00 AM daily").
Stats dashboard	Overall completion %, monthly progress breakdown, daily progress-over-time chart, weekly progress by day-of-week, and a top-N habits ranking by completion rate.
Mood & sleep tracking	Daily mood (emoji scale) and hours-of-sleep log, shown as a monthly strip/line chart.
Local data storage	All data in a local SQLite database file; no network calls required for core functionality.
Data export/import	Export all data to a JSON/CSV file for backup; import to restore.
Cross-platform installers	Signed/packaged builds for Windows (.exe), macOS (.dmg), and Linux (.AppImage/.deb).
Nice-to-Have (Post-v1 / Backlog)
Feature	Description
Custom themes / light mode	Additional color themes beyond the default dark green/black.
Habit notes	Free-text note attached to any day's check-in.
Weekly/monthly email or PDF summary	Auto-generated report exported locally.
Optional encrypted cloud backup	User-opt-in sync via their own storage (e.g., a file they manage, not a Habiter server).
Widgets / menu bar quick check-in	Quick-mark today's habits from a tray icon without opening the full app.
Habit templates	Pre-built habit sets (e.g., "Morning Routine") users can add in one click.
Multi-language support	Localization beyond English.
5. User Flow (Start to Finish)
Download & install — User downloads the installer for their OS from GitHub Releases or the project website, installs, and launches the app. No sign-up screen.
First launch — Empty state with a prompt to add their first habit; a few example habits are pre-filled but clearly marked as removable/editable.
Add a habit — User names the habit, picks an icon and category, sets frequency, and optionally sets a reminder time.
Daily use — User opens the app (or gets a reminder notification), marks today's habits as Completed/Partial/Not Done/Skipped from the dashboard grid, and optionally logs mood and sleep for the day.
Review progress — User checks the stats dashboard weekly/monthly to see streaks, completion trends, and top-performing habits.
Manage over time — User edits, archives, or deletes habits as routines change; can export data anytime as a backup.
6. MVP Definition

The MVP is the full v1 feature set listed as Must-Have above — this was a deliberate scope decision (not a smaller lean slice), because the core value proposition (a complete honest picture of consistency) requires the check-in grid, streaks, stats, and mood/sleep together. A version without reminders or stats would not deliver the product's core promise.

MVP is complete when:

A user can install the app on any of the three platforms.
A user can create habits with categories and frequencies.
A user can check in daily via the grid and receive OS reminders.
The stats dashboard reflects real check-in data (completion %, streaks, weekly/monthly views).
Mood and sleep can be logged and viewed on a monthly chart.
Data persists locally across app restarts and can be exported/imported.
7. Success Metrics

Since Habiter is offline with zero telemetry, success cannot be measured via analytics dashboards. Metrics instead rely on qualitative and indirect signals:

Personal usage retention — the creator (primary user) uses it daily without switching back to another tool, for 30+ consecutive days.
GitHub signals — stars, downloads/release counts, issues opened (engagement/interest from the public).
Data integrity — zero data-loss incidents (crashes that corrupt the local database) across normal usage.
Time-to-first-check-in — a new user can install and log their first habit in under 2 minutes, without documentation.
Qualitative feedback — GitHub issues/discussions indicate the app is being used as a daily driver, not just downloaded and abandoned.
8. Explicitly NOT in Version 1
No user accounts, login, or authentication of any kind.
No cloud sync or server-side storage — all data stays on the user's device.
No social features (sharing, friends, leaderboards, comparisons).
No mobile app (iOS/Android) — desktop only for v1.
No in-app purchases, subscriptions, or ads.
No analytics or telemetry of any kind, even anonymous.
No AI-generated insights or coaching (may be considered later, but not v1).
No habit templates/marketplace.
No light mode or theme customization — dark green/black only for v1.
No multi-device sync between two installs (each install is fully independent).