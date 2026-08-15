import { useState } from 'react';
import {
  useHabitsStore,
  useHabitModalStore,
  useConfirmModalStore,
} from '../../stores/habitsStore';
import { useCheckinsStore } from '../../stores/checkinsStore';
import { formatFrequency } from '../../utils/frequency';

export default function HabitList() {
  // Individual selectors — prevents re-render on every unrelated set() call
  const habits = useHabitsStore((s) => s.habits);
  const categories = useHabitsStore((s) => s.categories);
  const seededIds = useCheckinsStore((s) => s.seededIds);
  const archiveHabit = useHabitsStore((s) => s.archiveHabit);
  const unarchiveHabit = useHabitsStore((s) => s.unarchiveHabit);
  const deleteHabit = useHabitsStore((s) => s.deleteHabit);
  const openNew = useHabitModalStore((s) => s.openNew);
  const openEdit = useHabitModalStore((s) => s.openEdit);
  const openArchived = useHabitModalStore((s) => s.openArchived);
  const openConfirm = useConfirmModalStore((s) => s.open);

  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const activeHabits = habits.filter((h) => h.is_archived === 0);
  const archivedHabits = habits.filter((h) => h.is_archived === 1);

  const currentList = tab === 'active' ? activeHabits : archivedHabits;

  function getCategoryName(id: string | null): string | null {
    if (!id) return null;
    return categories.find((c) => c.id === id)?.name ?? null;
  }

  function getCategoryColor(id: string | null): string | null {
    if (!id) return null;
    return categories.find((c) => c.id === id)?.color ?? null;
  }

  function handleArchive(habitId: string, habitName: string) {
    openConfirm({
      title: 'Archive Habit',
      message: `Archive "${habitName}"? It will be hidden from the active grid but all history is preserved. You can restore it from the Archived tab anytime.`,
      confirmLabel: 'Archive',
      onConfirm: () => archiveHabit(habitId),
    });
  }

  function handleUnarchive(habitId: string) {
    unarchiveHabit(habitId);
  }

  function handleDelete(habitId: string, habitName: string) {
    openConfirm({
      title: 'Permanently Delete Habit',
      message: `This will permanently delete "${habitName}" and ALL of its check-in history. This action cannot be undone.\n\nType the habit name to confirm:`,
      confirmLabel: 'Delete Permanently',
      confirmInputPlaceholder: habitName,
      requiresInput: true,
      onConfirm: () => deleteHabit(habitId),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold text-text-primary">My Habits</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary text-bg-primary rounded-button text-small font-semibold hover:bg-accent-primary-hover transition-colors active:scale-[0.97]"
        >
          <span className="text-base leading-none">+</span>
          Add Habit
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-button">
        <button
          onClick={() => setTab('active')}
          className={`flex-1 py-1.5 rounded-button text-small font-medium transition-all ${
            tab === 'active'
              ? 'bg-bg-elevated text-accent-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Active ({activeHabits.length})
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`flex-1 py-1.5 rounded-button text-small font-medium transition-all ${
            tab === 'archived'
              ? 'bg-bg-elevated text-accent-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Archived ({archivedHabits.length})
        </button>
      </div>

      {/* Empty state */}
      {currentList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl mb-3">
            {tab === 'active' ? '📋' : '📦'}
          </div>
          <p className="text-body text-text-secondary">
            {tab === 'active'
              ? 'No habits yet. Click "Add Habit" to get started!'
              : 'No archived habits.'}
          </p>
        </div>
      )}

      {/* Habit list */}
      <div className="flex flex-col gap-1.5">
        {currentList.map((habit) => {
          const categoryName = getCategoryName(habit.category_id);
          const categoryColor = getCategoryColor(habit.category_id);

          return (
            <div
              key={habit.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-bg-secondary border border-border-subtle rounded-card hover:border-accent-primary/20 transition-colors group"
            >
              {/* Icon */}
              <div className="w-10 h-10 flex items-center justify-center rounded-button bg-bg-elevated text-lg flex-shrink-0">
                {habit.icon ?? '·'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium text-text-primary truncate">
                    {habit.name}
                  </span>
                  {seededIds.has(habit.id) && (
                    <span className="px-1 py-px text-[9px] font-medium text-accent-secondary bg-accent-secondary/10 border border-accent-secondary/20 rounded flex-shrink-0">
                      Example
                    </span>
                  )}
                  {categoryName && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium border flex-shrink-0"
                      style={{
                        color: categoryColor ?? 'var(--text-secondary)',
                        borderColor: categoryColor
                          ? `${categoryColor}40`
                          : 'var(--border-subtle)',
                        backgroundColor: categoryColor
                          ? `${categoryColor}15`
                          : 'transparent',
                      }}
                    >
                      {categoryName}
                    </span>
                  )}
                </div>
                <span className="text-small text-text-secondary">
                  {formatFrequency(habit.frequency_type, habit.frequency_value)}
                  {habit.reminder_time && ` · ⏰ ${habit.reminder_time}`}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {tab === 'active' ? (
                  <>
                    <button
                      onClick={() => openEdit(habit)}
                      className="p-1.5 rounded-button text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleArchive(habit.id, habit.name)}
                      className="p-1.5 rounded-button text-text-secondary hover:text-status-partial hover:bg-status-partial/10 transition-colors"
                      title="Archive"
                    >
                      📦
                    </button>
                    <button
                      onClick={() => handleDelete(habit.id, habit.name)}
                      className="p-1.5 rounded-button text-text-secondary hover:text-status-skipped hover:bg-status-skipped/10 transition-colors"
                      title="Delete permanently"
                    >
                      🗑️
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openArchived(habit)}
                      className="p-1.5 rounded-button text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                      title="View / Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleUnarchive(habit.id)}
                      className="p-1.5 rounded-button text-text-secondary hover:text-accent-secondary hover:bg-accent-secondary/10 transition-colors"
                      title="Restore to active"
                    >
                      ↩️
                    </button>
                    <button
                      onClick={() => handleDelete(habit.id, habit.name)}
                      className="p-1.5 rounded-button text-text-secondary hover:text-status-skipped hover:bg-status-skipped/10 transition-colors"
                      title="Delete permanently"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
