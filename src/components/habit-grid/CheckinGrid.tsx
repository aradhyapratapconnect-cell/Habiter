import { useEffect } from 'react';
import {
  useCheckinsStore,
  getDaysInMonth,
  checkinKey,
  isEditableDateISO,
} from '../../stores/checkinsStore';
import type { CheckinStatus, ISODate } from '../../types';

// ---------------------------------------------------------------------------
// Status → visual config
// ---------------------------------------------------------------------------

const STATUS_BG: Record<CheckinStatus, string> = {
  completed: 'bg-accent-primary',
  partial: 'bg-status-partial',
  skipped: 'bg-status-skipped/30',
  not_done: 'bg-status-not-done',
};

const STATUS_ICON: Record<CheckinStatus, string> = {
  completed: '✓',
  partial: '◐',
  skipped: '⊘',
  not_done: '',
};

const LEGEND: { status: CheckinStatus; label: string; color: string }[] = [
  { status: 'completed', label: 'Completed', color: 'bg-accent-primary' },
  { status: 'partial', label: 'Partially Done', color: 'bg-status-partial' },
  { status: 'not_done', label: 'Not Done', color: 'bg-status-not-done' },
  { status: 'skipped', label: 'Skipped', color: 'bg-status-skipped/30' },
];

// ---------------------------------------------------------------------------
// Month name helper
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// CheckinGrid Component (TICKET-008)
// ---------------------------------------------------------------------------

interface CheckinGridProps {
  /** Habit IDs that were seeded on first launch — shown with an "Example" badge (TICKET-026). */
  seededIds?: Set<string>;
}

export default function CheckinGrid({ seededIds }: CheckinGridProps) {
  const year = useCheckinsStore((s) => s.year);
  const month = useCheckinsStore((s) => s.month);
  const habits = useCheckinsStore((s) => s.habits);
  const checkins = useCheckinsStore((s) => s.checkins);
  const habitsLoading = useCheckinsStore((s) => s.habitsLoading);
  const checkinsLoading = useCheckinsStore((s) => s.checkinsLoading);
  const loadHabits = useCheckinsStore((s) => s.loadHabits);
  const loadCheckins = useCheckinsStore((s) => s.loadCheckins);
  const toggleCheckin = useCheckinsStore((s) => s.toggleCheckin);
  const prevMonth = useCheckinsStore((s) => s.prevMonth);
  const nextMonth = useCheckinsStore((s) => s.nextMonth);

  const activeHabits = habits.filter((h) => h.is_archived === 0);
  const daysInMonth = getDaysInMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // Build date strings for the month: "YYYY-MM-DD"
  const dateStrings = days.map(
    (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  );

  // Load data on mount and when month changes
  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  useEffect(() => {
    loadCheckins();
  }, [year, month, loadCheckins]);

  const isLoading = habitsLoading || checkinsLoading;

  // Status label for accessibility
  function statusLabel(status: CheckinStatus | null | undefined): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'partial':
        return 'Partially done';
      case 'skipped':
        return 'Skipped';
      case 'not_done':
        return 'Not done';
      default:
        return 'Not done';
    }
  }

  return (
    <section className="bg-bg-secondary border border-border-subtle rounded-card p-5">
      {/* --- Header row: Legend + Month Navigation --- */}
      <div className="flex items-center justify-between mb-4">
        {/* Legend (Frontend Spec §2: status swatches above the grid) */}
        <div className="flex items-center gap-4">
          {LEGEND.map((item) => (
            <div key={item.status} className="flex items-center gap-1.5">
              <span
                className={`inline-block w-3 h-3 rounded-sm ${item.color}`}
              />
              <span className="text-small text-text-secondary">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-button text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors text-sm"
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="text-body font-medium text-text-primary min-w-[120px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-button text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors text-sm"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {/* --- Grid container --- */}
      <div className="overflow-x-auto rounded-button border border-border-subtle">
        {isLoading && activeHabits.length === 0 ? (
          /* Loading state */
          <div className="flex items-center justify-center py-12 text-text-secondary text-body">
            Loading habits…
          </div>
        ) : activeHabits.length === 0 ? (
          /* Empty state — no habits yet */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-body text-text-secondary mb-1">
              No habits to track yet.
            </p>
            <p className="text-small text-text-disabled">
              Add a habit above to start tracking your daily progress.
            </p>
          </div>
        ) : (
          /* --- The Grid --- */
          <table className="border-collapse w-full">
            {/* Column group: fixed habit name column + fluid day columns */}
            <colgroup>
              <col className="w-[180px] min-w-[180px]" />
              {days.map((d) => (
                <col
                  key={d}
                  className={`w-[34px] min-w-[34px] ${
                    isCurrentMonth && d === todayDate
                      ? 'bg-accent-primary/[0.04]'
                      : ''
                  }`}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                {/* Sticky "Habit" label — pinned top-left corner */}
                <th
                  className="sticky left-0 top-0 z-20 bg-bg-secondary text-left text-small font-semibold text-text-secondary px-3 py-2 border-b border-border-subtle"
                  style={{ minWidth: 180 }}
                >
                  Habit
                </th>

                {/* Day number headers — sticky top row */}
                {days.map((d) => {
                  const isToday = isCurrentMonth && d === todayDate;
                  return (
                    <th
                      key={d}
                      className={`sticky top-0 z-10 text-center text-[10px] font-medium text-text-secondary px-0 py-2 border-b border-border-subtle ${
                        isToday ? 'text-accent-primary' : ''
                      }`}
                      style={{ minWidth: 34 }}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {activeHabits.map((habit) => (
                <tr
                  key={habit.id}
                  className="group/row hover:bg-bg-elevated/30 transition-colors"
                >
                  {/* Sticky habit name cell — pinned left */}
                  <td
                    className="sticky left-0 z-10 bg-bg-secondary group-hover/row:bg-bg-elevated/30 px-3 py-2 border-b border-border-subtle"
                    style={{ minWidth: 180 }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm flex-shrink-0 leading-none">
                        {habit.icon || '·'}
                      </span>
                      <span className="text-body text-text-primary truncate">
                        {habit.name}
                      </span>
                      {seededIds?.has(habit.id) && (
                        <span className="px-1 py-px text-[9px] font-medium text-accent-secondary bg-accent-secondary/10 border border-accent-secondary/20 rounded flex-shrink-0">
                          Example
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Check-in cells — one per day */}
                  {dateStrings.map((dateStr, idx) => {
                    const key = checkinKey(habit.id, dateStr);
                    const checkin = checkins.get(key);
                    const status = checkin?.status ?? null;
                    const dayNum = idx + 1;
                    const isToday = isCurrentMonth && dayNum === todayDate;
                    // TICKET-027: only today and yesterday are editable
                    const editable = isEditableDateISO(dateStr as ISODate);

                    return (
                      <td
                        key={dateStr}
                        className={`border-b border-r border-border-subtle/50 p-0 ${
                          isToday ? 'bg-accent-primary/[0.04]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={editable ? () => toggleCheckin(habit.id, dateStr) : undefined}
                          disabled={!editable}
                          className={`
                            w-full aspect-square flex items-center justify-center
                            text-[11px] font-semibold transition-all duration-100
                            focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-primary/40
                            ${
                              editable
                                ? 'cursor-pointer hover:brightness-110 hover:scale-105 active:scale-95'
                                : 'cursor-default opacity-60'
                            }
                            ${
                              status
                                ? STATUS_BG[status]
                                : editable
                                  ? 'bg-transparent hover:bg-status-not-done/60'
                                  : 'bg-transparent'
                            }
                            ${status && status !== 'completed' ? 'text-text-primary' : ''}
                            ${status === 'completed' ? 'text-bg-primary' : ''}
                            ${isToday && !status ? 'ring-1 ring-inset ring-accent-primary/30' : ''}
                          `}
                          aria-label={`${habit.name} — ${statusLabel(status)} — day ${dayNum}${editable ? '' : ' (locked)'}`}
                          title={`${habit.name} — ${statusLabel(status)}${editable ? '' : ' — locked'}`}
                        >
                          {status ? STATUS_ICON[status] : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
