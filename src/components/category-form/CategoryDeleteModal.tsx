import { useState, useEffect } from 'react';
import { useCategoriesStore } from '../../stores/categoriesStore';
import { useHabitsStore } from '../../stores/habitsStore';
import { useShallow } from 'zustand/react/shallow';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import Select from '../shared/Select';

// ---------------------------------------------------------------------------
// Delete confirmation with habit reassignment
// ---------------------------------------------------------------------------

interface Props {
  isOpen: boolean;
  categoryId: string | null;
  categoryName: string;
  onClose: () => void;
}

export default function CategoryDeleteModal({
  isOpen,
  categoryId,
  categoryName,
  onClose,
}: Props) {
  // Use individual selectors to avoid full-state re-renders on every set()
  const habits = useHabitsStore((s) => s.habits);
  const updateHabit = useHabitsStore((s) => s.updateHabit);
  const loadHabits = useHabitsStore((s) => s.loadHabits);
  const deleteCategory = useCategoriesStore((s) => s.deleteCategory);

  const [reassignTarget, setReassignTarget] = useState('__none__');
  const [submitting, setSubmitting] = useState(false);

  // Habits currently assigned to this category
  const affectedHabits = habits.filter(
    (h) => h.category_id === categoryId && h.is_archived === 0,
  );

  // Other categories the user can reassign to — use useShallow for stable ref
  const otherCategories = useCategoriesStore(
    useShallow((s) =>
      s.categories
        .filter((c) => c.id !== categoryId)
        .map((c) => ({ id: c.id, name: c.name })),
    ),
  );

  useEffect(() => {
    if (isOpen) {
      setReassignTarget('__none__');
    }
  }, [isOpen]);

  if (!categoryId) return null;

  const reassignOptions = [
    { value: '__none__', label: 'Leave uncategorized' },
    ...otherCategories.map((c) => ({
      value: c.id,
      label: c.name,
    })),
  ];

  async function handleConfirm() {
    if (!categoryId) return;
    setSubmitting(true);
    try {
      // Reassign affected habits if the user chose a target
      if (reassignTarget !== '__none__' && affectedHabits.length > 0) {
        await Promise.all(
          affectedHabits.map((h) =>
            updateHabit(h.id, { category_id: reassignTarget }),
          ),
        );
      }

      // Delete the category (FK SET NULL handles any remaining habits)
      await deleteCategory(categoryId);

      // Reload habits to reflect the category changes
      await loadHabits();

      onClose();
    } catch (err) {
      console.error('[CategoryDelete] Failed:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const message =
    affectedHabits.length > 0
      ? `The category "${categoryName}" has ${affectedHabits.length} habit${affectedHabits.length > 1 ? 's' : ''} assigned:\n\n${affectedHabits.map((h) => `• ${h.icon ?? '·'} ${h.name}`).join('\n')}\n\nChoose where to move them before deleting this category.`
      : `Delete the category "${categoryName}"? No habits are currently assigned to it.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Category"
      maxWidth="max-w-md"
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-secondary whitespace-pre-line leading-relaxed">
          {message}
        </p>

        {/* Reassign selector — only shown when habits are affected */}
        {affectedHabits.length > 0 && (
          <Select
            label="Move habits to"
            value={reassignTarget}
            onChange={setReassignTarget}
            options={reassignOptions}
          />
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Deleting...' : 'Delete Category'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
