import { useMemo } from 'react';
import CheckinGrid from './components/habit-grid/CheckinGrid';
import HabitFormModal from './components/habit-form/HabitFormModal';
import ConfirmModal from './components/shared/ConfirmModal';
import DailyLogWidget from './components/daily-log/DailyLogWidget';
import MoodTrackerStrip from './components/daily-log/MoodTrackerStrip';
import NotesWidget from './components/notes/NotesWidget';
import { useHabitModalStore } from './stores/habitsStore';
import { useCheckinsStore, computeDailyProgress, computeWeeklyProgress, computeTopHabits } from './stores/checkinsStore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// ---------------------------------------------------------------------------
// Monthly Progress pie chart — status colors per Frontend Spec §1.1
// ---------------------------------------------------------------------------

const STATUS_SEGMENTS = [
  { key: 'completed', label: 'Completed', color: 'var(--accent-primary)' },
  { key: 'partial', label: 'In Progress', color: 'var(--status-partial)' },
  { key: 'skipped', label: 'Skipped', color: 'var(--status-skipped)' },
  { key: 'not_started', label: 'Not Started', color: 'var(--text-disabled)' },
] as const;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getFormattedToday(): string {
  const d = new Date();
  const day = d.getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
          ? 'rd'
          : 'th';
  return `${day}${suffix} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function getDayOfWeek(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Main dashboard screen — loaded by App.tsx once the IPC bridge is ready.
 * TICKET-008: Check-in grid is now the primary element. Future tickets will
 * add the top bar (date/sleep), stats row, side charts, and bottom row.
 */
export default function Dashboard() {
  const openNew = useHabitModalStore((s) => s.openNew);
  const overallCurrent = useCheckinsStore((s) => s.streaks.overallCurrent);
  const overallBest = useCheckinsStore((s) => s.streaks.overallBest);
  const habits = useCheckinsStore((s) => s.habits);
  const stats = useCheckinsStore((s) => s.stats);
  const year = useCheckinsStore((s) => s.year);
  const month = useCheckinsStore((s) => s.month);
  const checkins = useCheckinsStore((s) => s.checkins);
  const seededIds = useCheckinsStore((s) => s.seededIds);
  const activeCount = habits.filter((h) => h.is_archived === 0).length;

  // Export handlers (TICKET-018)
  async function handleExportJson() {
    try {
      const result = await window.habiterAPI.export.json();
      if (result.path) {
        console.log(`[Export] JSON saved to: ${result.path}`);
      }
    } catch (err) {
      console.error('[Export] JSON export failed:', err);
    }
  }

  async function handleExportCsv() {
    try {
      const result = await window.habiterAPI.export.csv();
      if (result.path) {
        console.log(`[Export] CSV saved to: ${result.path}`);
      }
    } catch (err) {
      console.error('[Export] CSV export failed:', err);
    }
  }

  async function handleImportJson() {
    try {
      const result = await window.habiterAPI.import.json();
      if (result.success) {
        console.log(`[Import] ${result.message}`);
        // Reload all data after import
        useCheckinsStore.getState().loadHabits();
        useCheckinsStore.getState().loadCheckins();
      } else {
        console.warn(`[Import] ${result.message}`);
      }
    } catch (err) {
      console.error('[Import] JSON import failed:', err);
    }
  }

  // Daily progress data — recomputes when habits, checkins, or month changes
  const dailyProgress = useMemo(
    () => computeDailyProgress(habits, checkins, year, month),
    [habits, checkins, year, month],
  );

  // Weekly progress data — recomputes when habits, checkins, or month changes
  const weeklyProgress = useMemo(
    () => computeWeeklyProgress(habits, checkins, year, month),
    [habits, checkins, year, month],
  );

  // Top habits ranking — recomputes when habits, checkins, or month changes
  const topHabits = useMemo(
    () => computeTopHabits(habits, checkins, year, month),
    [habits, checkins, year, month],
  );

  return (
    <div className="h-screen w-full overflow-y-auto bg-bg-primary">
      {/* Page wrapper — 24px margin per Frontend Spec §1.4 */}
      <div className="max-w-[1800px] mx-auto px-page-margin py-6 flex flex-col gap-5">

        {/* --- Top bar (Frontend Spec §2: date | title | sleep) --- */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: Today's date */}
          <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-2.5">
            <div className="text-small text-text-secondary mb-0.5">
              Today's Date
            </div>
            <div className="text-body font-medium text-text-primary">
              {getFormattedToday()}
            </div>
            <div className="text-small text-text-secondary">
              {getDayOfWeek()}
            </div>
          </div>

          {/* Center: App title + tagline */}
          <div className="text-center">
            <h1 className="text-display font-bold text-accent-primary">
              Habiter
            </h1>
            <p className="text-body text-text-secondary">
              Small steps today, brighter tomorrow.
            </p>
          </div>

          {/* Right: Daily log widget — mood & sleep (TICKET-016) */}
          <div className="w-[180px]">
            <DailyLogWidget />
          </div>
        </header>

        {/* --- Stats row (Frontend Spec §2: 5 summary cards) --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Completed */}
          <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-primary/15 flex items-center justify-center text-lg flex-shrink-0">
              ✅
            </div>
            <div>
              <div className="text-small text-text-secondary">Completed</div>
              <div className="text-stat font-bold text-accent-primary leading-tight">
                {stats.completedDays}
              </div>
              <div className="text-small text-text-secondary">habits this month</div>
            </div>
          </div>

          {/* 2. Remaining */}
          <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-status-partial/15 flex items-center justify-center text-lg flex-shrink-0">
              ⏳
            </div>
            <div>
              <div className="text-small text-text-secondary">Remaining</div>
              <div className="text-stat font-bold text-status-partial leading-tight">
                {stats.remainingDays}
              </div>
              <div className="text-small text-text-secondary">habits left</div>
            </div>
          </div>

          {/* 3. Current Streak */}
          <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-primary/15 flex items-center justify-center text-lg flex-shrink-0">
              🔥
            </div>
            <div>
              <div className="text-small text-text-secondary">Current Streak</div>
              <div className="text-stat font-bold text-accent-primary leading-tight">
                {overallCurrent}
              </div>
              <div className="text-small text-text-secondary">days</div>
            </div>
          </div>

          {/* 4. Best Streak */}
          <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-status-partial/15 flex items-center justify-center text-lg flex-shrink-0">
              🏆
            </div>
            <div>
              <div className="text-small text-text-secondary">Best Streak</div>
              <div className="text-stat font-bold text-status-partial leading-tight">
                {overallBest}
              </div>
              <div className="text-small text-text-secondary">days</div>
            </div>
          </div>

          {/* 5. Total Habits */}
          <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-secondary/15 flex items-center justify-center text-lg flex-shrink-0">
              📋
            </div>
            <div>
              <div className="text-small text-text-secondary">Total Habits</div>
              <div className="text-stat font-bold text-accent-secondary leading-tight">
                {activeCount}
              </div>
              <div className="text-small text-text-secondary">habits tracked</div>
            </div>
          </div>
        </div>

        {/* --- Two-column layout: Center grid + Left sidebar ---
             Grid is first in DOM so it stacks first on narrow windows
             (per Frontend Spec: "grid keeps priority space"). On xl+
             the sidebar moves to the right via order. --- */}
        <div className="flex flex-col xl:flex-row gap-5 min-h-0">

          {/* ===== Center column — Grid (priority element) ===== */}
          <main className="flex-1 min-w-0 flex flex-col gap-4 order-1">
            {/* Add Habit action row + Export buttons */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-h1 font-semibold text-text-primary">
                Daily Habit Tracker
              </h2>
              <div className="flex items-center gap-2">
                {/* Export buttons (TICKET-018) */}
                <button
                  onClick={handleExportJson}
                  className="px-2.5 py-1.5 bg-transparent border border-border-subtle text-text-secondary rounded-button text-small hover:bg-bg-elevated hover:text-text-primary transition-colors active:scale-[0.97]"
                >
                  ⬇ JSON
                </button>
                <button
                  onClick={handleExportCsv}
                  className="px-2.5 py-1.5 bg-transparent border border-border-subtle text-text-secondary rounded-button text-small hover:bg-bg-elevated hover:text-text-primary transition-colors active:scale-[0.97]"
                >
                  ⬇ CSV
                </button>
                <button
                  onClick={handleImportJson}
                  className="px-2.5 py-1.5 bg-transparent border border-border-subtle text-text-secondary rounded-button text-small hover:bg-bg-elevated hover:text-text-primary transition-colors active:scale-[0.97]"
                >
                  ⬆ Import
                </button>
                <button
                  onClick={openNew}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary text-bg-primary rounded-button text-small font-semibold hover:bg-accent-primary-hover transition-colors active:scale-[0.97]"
                >
                  <span className="text-base leading-none">+</span>
                  Add Habit
                </button>
              </div>
            </div>

            {/* Check-in Grid (TICKET-008) */}
            <CheckinGrid seededIds={seededIds} />
          </main>

          {/* ===== Left column (~220px) — sidebar charts =====
               On xl+ it sits on the right side of the grid.
               Below xl it stacks above the grid (hidden by order-2 → below grid
               which is order-1). Actually, we want sidebar BELOW grid on narrow,
               so: grid=order-1, sidebar=order-2. On xl+ the sidebar visually
               moves right via flex-row + order-2. */}
          <aside className="w-full xl:w-[280px] xl:min-w-[220px] xl:max-w-[340px] flex-shrink-0 flex flex-col gap-4 order-2 xl:order-2">

            {/* Overall Progress donut card */}
            <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-5 flex flex-col items-center">
              <div className="text-small text-text-secondary mb-2">
                Overall Progress
              </div>
              <div className="relative w-[110px] h-[110px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { value: stats.completedDays },
                        { value: stats.remainingDays },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={50}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="var(--accent-primary)" />
                      <Cell fill="var(--bg-elevated)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-stat font-bold text-text-primary">
                    {stats.completionPct}%
                  </span>
                </div>
              </div>
              <div className="text-small text-accent-secondary mt-2">
                {stats.completionPct >= 70
                  ? 'Great job!'
                  : stats.completionPct >= 40
                    ? 'Keep going!'
                    : 'You got this!'}
              </div>
            </div>

            {/* Monthly Progress pie chart (TICKET-012) */}
            <div className="bg-bg-secondary border border-border-subtle rounded-card px-4 py-5">
              <div className="text-small text-text-secondary mb-1">
                Monthly Progress
              </div>
              <div className="text-h2 font-semibold text-text-primary mb-3">
                {MONTH_NAMES[month]} {year}
              </div>

              {/* Pie chart */}
              <div className="relative w-[140px] h-[140px] mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={STATUS_SEGMENTS.map((s) => ({
                        name: s.label,
                        value: stats.statusBreakdown[s.key],
                        color: s.color,
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      dataKey="value"
                      stroke="none"
                    >
                      {STATUS_SEGMENTS.map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Color-key legend */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-4">
                {STATUS_SEGMENTS.map((s) => {
                  const count = stats.statusBreakdown[s.key];
                  const pct = stats.totalDays > 0
                    ? Math.round((count / stats.totalDays) * 100)
                    : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-[11px] text-text-secondary truncate">
                        {s.label} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        {/* --- Bottom row: 3-column grid (Frontend Spec §2) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Column 1: Daily Progress Overview (TICKET-013) */}
          <section className="bg-bg-secondary border border-border-subtle rounded-card px-5 py-4">
            <h3 className="text-h2 font-semibold text-text-primary mb-4">
              Daily Progress Overview
            </h3>

            {dailyProgress.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-body">
                No habits to track yet.
              </div>
            ) : (
              <div className="flex items-end gap-[3px] h-[140px]">
                {dailyProgress.map((dp) => (
                  <div
                    key={dp.day}
                    className="flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <div
                      className="w-full rounded-t-sm transition-all duration-200"
                      style={{
                        height: `${dp.pct}%`,
                        backgroundColor: dp.pct > 0 ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                        minHeight: dp.pct > 0 ? 2 : 0,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {dailyProgress.length > 0 && (
              <div className="flex gap-[3px] mt-1.5">
                {dailyProgress.map((dp) => (
                  <div
                    key={dp.day}
                    className="flex-1 text-center text-[9px] text-text-secondary"
                  >
                    {dp.day}
                  </div>
                ))}
              </div>
            )}

            {dailyProgress.length > 0 && (
              <div className="flex justify-between mt-1 px-1">
                <span className="text-[9px] text-text-disabled">0%</span>
                <span className="text-[9px] text-text-disabled">50%</span>
                <span className="text-[9px] text-text-disabled">100%</span>
              </div>
            )}
          </section>

          {/* Column 2: Weekly Progress (TICKET-014) */}
          <section className="bg-bg-secondary border border-border-subtle rounded-card px-5 py-4">
            <h3 className="text-h2 font-semibold text-text-primary mb-3">
              Weekly Progress
            </h3>

            {weeklyProgress.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-body">
                No habits to track yet.
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {/* Day-of-week header */}
                <div className="grid items-center gap-1 mb-2"
                  style={{ gridTemplateColumns: '56px repeat(7, 1fr) 42px' }}>
                  <div />
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-medium text-text-secondary">
                      {d}
                    </div>
                  ))}
                  <div />
                </div>

                {/* Week rows */}
                {weeklyProgress.map((week) => (
                  <div
                    key={week.label}
                    className="grid items-center gap-1 py-1.5 border-b border-border-subtle/40 last:border-b-0"
                    style={{ gridTemplateColumns: '56px repeat(7, 1fr) 42px' }}
                  >
                    {/* Week label */}
                    <span className="text-small text-text-secondary font-medium">
                      {week.label}
                    </span>

                    {/* Day cells — Mon to Sun */}
                    {Array.from({ length: 7 }, (_, i) => {
                      const dayData = week.days[i] ?? null;
                      return (
                        <div key={i} className="flex justify-center">
                          {dayData ? (
                            <div
                              className="w-full h-3 rounded-sm transition-all duration-200"
                              style={{
                                backgroundColor:
                                  dayData.pct >= 80
                                    ? 'var(--accent-primary)'
                                    : dayData.pct >= 50
                                      ? 'var(--accent-secondary)'
                                      : dayData.pct > 0
                                        ? 'var(--status-partial)'
                                        : 'var(--bg-elevated)',
                                opacity: dayData.pct > 0 ? 1 : 0.5,
                              }}
                              title={`${dayData.day}: ${dayData.pct}%`}
                            />
                          ) : (
                            <div className="w-full h-3" />
                          )}
                        </div>
                      );
                    })}

                    {/* Week completion % */}
                    <span className="text-right text-[11px] font-semibold text-text-primary">
                      {week.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Column 3: Top Habits This Month (TICKET-015) */}
          <section className="bg-bg-secondary border border-border-subtle rounded-card px-5 py-4">
            <h3 className="text-h2 font-semibold text-text-primary mb-3">
              Top Habits This Month
            </h3>

            {topHabits.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-body">
                No habits to track yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {topHabits.map((item, idx) => (
                  <div key={item.habit.id} className="flex items-center gap-2.5">
                    {/* Rank number */}
                    <span className="text-body font-semibold text-text-secondary w-5 text-right flex-shrink-0">
                      {idx + 1}
                    </span>

                    {/* Icon */}
                    <span className="text-sm flex-shrink-0 leading-none">
                      {item.habit.icon || '·'}
                    </span>

                    {/* Name + progress bar */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-body text-text-primary truncate flex-shrink-0 max-w-[90px]">
                        {item.habit.name}
                      </span>
                      <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: 'var(--accent-primary)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Percentage */}
                    <span className="text-[11px] font-semibold text-text-primary w-8 text-right flex-shrink-0">
                      {item.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* --- Footer row: Mood Tracker + Notes (Frontend Spec §2) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-4">
          <MoodTrackerStrip />
          <NotesWidget />
        </div>
      </div>

      {/* Global modals */}
      <HabitFormModal />
      <ConfirmModal />
    </div>
  );
}
