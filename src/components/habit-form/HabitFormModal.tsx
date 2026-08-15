import { useState, useEffect, useCallback } from 'react';
import { useHabitModalStore, useHabitsStore } from '../../stores/habitsStore';
import type { FrequencyType, HabitCreateInput } from '../../types';
import { DAYS_OF_WEEK } from '../../utils/frequency';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import Input from '../shared/Input';
import Select from '../shared/Select';

// ---------------------------------------------------------------------------
// Emoji picker data
// ---------------------------------------------------------------------------

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Activities',
    emojis: [
      '🏃', '🏋️', '🧘', '🚴', '🏊', '⚽', '🎯', '✍️', '📖', '💡',
      '🎵', '🎨', '🧹', '💧', '🍎', '🥗', '☕', '🌅', '💤', '🧠',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '📝', '📅', '⏰', '💻', '📚', '🎒', '🔔', '🔑', '🗂️', '📱',
      '💰', '🎁', '📦', '🔧', '🎓', '🏆', '📊', '🗓️', '🧹', '💊',
    ],
  },
  {
    label: 'Symbols',
    emojis: [
      '✅', '⭐', '🔥', '❤️', '💚', '🔔', '🚀', '💪', '🌟', '🎯',
      '✨', '🙏', '🤝', '👍', '💯', '🏆', '📈', '🌱', '☀️', '🌙',
    ],
  },
];

// ---------------------------------------------------------------------------
// Habit form state
// ---------------------------------------------------------------------------

interface HabitFormState {
  name: string;
  icon: string;
  category_id: string;
  frequency_type: FrequencyType;
  frequency_value: string;
  reminder_time: string;
}

function emptyForm(): HabitFormState {
  return {
    name: '',
    icon: '',
    category_id: '',
    frequency_type: 'daily',
    frequency_value: '',
    reminder_time: '',
  };
}

function habitToForm(habit: { name: string; icon: string | null; category_id: string | null; frequency_type: FrequencyType; frequency_value: string | null; reminder_time: string | null }): HabitFormState {
  return {
    name: habit.name,
    icon: habit.icon ?? '',
    category_id: habit.category_id ?? '',
    frequency_type: habit.frequency_type,
    frequency_value: habit.frequency_value ?? '',
    reminder_time: habit.reminder_time ?? '',
  };
}

// ---------------------------------------------------------------------------
// HabitFormModal component
// ---------------------------------------------------------------------------

export default function HabitFormModal() {
  const isOpen = useHabitModalStore((s) => s.isOpen);
  const mode = useHabitModalStore((s) => s.mode);
  const editingHabit = useHabitModalStore((s) => s.editingHabit);
  const close = useHabitModalStore((s) => s.close);
  const categories = useHabitsStore((s) => s.categories);
  const createHabit = useHabitsStore((s) => s.createHabit);
  const updateHabit = useHabitsStore((s) => s.updateHabit);

  const [form, setForm] = useState<HabitFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Populate form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setShowEmojiPicker(false);
    if (editingHabit && (mode === 'edit' || mode === 'archived')) {
      setForm(habitToForm(editingHabit));
    } else {
      setForm(emptyForm());
    }
  }, [isOpen, mode, editingHabit]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    function handle(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-emoji-picker]')) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showEmojiPicker]);

  const set = useCallback(
    <K extends keyof HabitFormState>(key: K, value: HabitFormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    },
    [],
  );

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';

    if (form.frequency_type === 'specific_days') {
      if (!form.frequency_value) {
        errs.frequency_value = 'Select at least one day';
      } else {
        try {
          const days: string[] = JSON.parse(form.frequency_value);
          if (!Array.isArray(days) || days.length === 0) {
            errs.frequency_value = 'Select at least one day';
          }
        } catch {
          errs.frequency_value = 'Invalid frequency value';
        }
      }
    }

    if (form.frequency_type === 'times_per_week') {
      if (!form.frequency_value) {
        errs.frequency_value = 'Enter a number of days';
      } else {
        try {
          const parsed: { count?: number } = JSON.parse(form.frequency_value);
          const count = parsed.count ?? 0;
          if (count < 1 || count > 7) {
            errs.frequency_value = 'Must be between 1 and 7';
          }
        } catch {
          errs.frequency_value = 'Invalid frequency value';
        }
      }
    }

    if (form.reminder_time && !/^\d{2}:\d{2}$/.test(form.reminder_time)) {
      errs.reminder_time = 'Use HH:MM format';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const input: HabitCreateInput = {
        name: form.name.trim(),
        icon: form.icon || null,
        category_id: form.category_id || null,
        frequency_type: form.frequency_type,
        frequency_value: form.frequency_value || null,
        reminder_time: form.reminder_time || null,
      };

      if ((mode === 'edit' || mode === 'archived') && editingHabit) {
        await updateHabit(editingHabit.id, input);
      } else {
        await createHabit(input);
      }
      close();
    } catch (err) {
      console.error('[HabitForm] Save failed:', err);
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to save habit' });
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === 'new'
      ? 'Add New Habit'
      : mode === 'edit'
        ? 'Edit Habit'
        : 'Habit Details';

  // Build category options for the Select component
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Global submit error */}
        {errors.submit && (
          <div className="px-3 py-2 rounded bg-status-skipped/10 border border-status-skipped/30 text-status-skipped text-small">
            {errors.submit}
          </div>
        )}

        {/* Name */}
        <Input
          label="Habit Name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Gym, Read, Meditate"
          error={errors.name}
          autoFocus
        />

        {/* Icon / Emoji */}
        <div className="flex flex-col gap-1.5" data-emoji-picker="">
          <label className="text-small font-medium text-text-secondary">
            Icon
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-full flex items-center gap-3 px-3 py-2 bg-bg-elevated border border-border-subtle rounded-input text-body hover:border-accent-primary/40 transition-colors"
            >
              <span className="w-10 h-10 flex items-center justify-center rounded-button bg-bg-secondary text-xl">
                {form.icon || '—'}
              </span>
              <span className="text-text-secondary">
                {form.icon ? 'Change icon' : 'Choose an icon'}
              </span>
            </button>

            {/* Emoji picker popover */}
            {showEmojiPicker && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-bg-elevated border border-border-subtle rounded-modal shadow-xl p-3 max-h-56 overflow-y-auto">
                {form.icon && (
                  <button
                    type="button"
                    onClick={() => {
                      set('icon', '');
                      setShowEmojiPicker(false);
                    }}
                    className="w-full text-left px-2 py-1.5 text-small text-text-secondary hover:text-status-skipped hover:bg-status-skipped/10 rounded-button transition-colors mb-1"
                  >
                    Remove icon
                  </button>
                )}
                {EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.label} className="mb-2">
                    <div className="text-xs text-text-disabled font-medium px-1 mb-1 uppercase tracking-wider">
                      {cat.label}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {cat.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            set('icon', emoji);
                            setShowEmojiPicker(false);
                          }}
                          className={`w-9 h-9 flex items-center justify-center rounded-button text-lg hover:bg-bg-secondary transition-colors ${
                            form.icon === emoji
                              ? 'bg-accent-primary/20 ring-1 ring-accent-primary'
                              : ''
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <Select
          label="Category"
          value={form.category_id}
          onChange={(v) => set('category_id', v)}
          options={categoryOptions}
          placeholder="No category"
        />

        {/* Frequency type */}
        <Select
          label="Frequency"
          value={form.frequency_type}
          onChange={(v) => {
            set('frequency_type', v as FrequencyType);
            // Clear frequency_value when switching types
            set('frequency_value', '');
          }}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'specific_days', label: 'Specific days' },
            { value: 'times_per_week', label: 'Times per week' },
          ]}
        />

        {/* Frequency value — conditional */}
        {form.frequency_type === 'specific_days' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-small font-medium text-text-secondary">
              Select Days
            </label>
            <div className="flex gap-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const selected: string[] = form.frequency_value
                  ? JSON.parse(form.frequency_value)
                  : [];
                const isSelected = selected.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? selected.filter((d: string) => d !== day.value)
                        : [...selected, day.value];
                      set('frequency_value', JSON.stringify(next));
                    }}
                    className={`flex-1 py-2 rounded-button text-small font-medium border transition-all ${
                      isSelected
                        ? 'bg-accent-primary text-bg-primary border-accent-primary'
                        : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-accent-primary/40'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {errors.frequency_value && (
              <p className="text-xs text-status-skipped">{errors.frequency_value}</p>
            )}
          </div>
        )}

        {form.frequency_type === 'times_per_week' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-small font-medium text-text-secondary">
              Days per week
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                const currentCount = form.frequency_value
                  ? (JSON.parse(form.frequency_value) as { count?: number }).count ?? 0
                  : 0;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      set('frequency_value', JSON.stringify({ count: n }))
                    }
                    className={`flex-1 py-2 rounded-button text-small font-medium border transition-all ${
                      currentCount === n
                        ? 'bg-accent-primary text-bg-primary border-accent-primary'
                        : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-accent-primary/40'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {errors.frequency_value && (
              <p className="text-xs text-status-skipped">{errors.frequency_value}</p>
            )}
          </div>
        )}

        {/* Reminder time */}
        <Input
          label="Reminder Time (optional)"
          type="time"
          value={form.reminder_time}
          onChange={(e) => set('reminder_time', e.target.value)}
          error={errors.reminder_time}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : mode === 'new' ? 'Add Habit' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
