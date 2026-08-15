import { useState, useEffect } from 'react';
import { useCategoryFormStore, useCategoriesStore } from '../../stores/categoriesStore';
import Modal from '../shared/Modal';
import Button from '../shared/Button';
import Input from '../shared/Input';

// ---------------------------------------------------------------------------
// Color palette — accessible on dark backgrounds
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  '#22C55E', '#4ADE80', '#34D399', '#2DD4BF',
  '#38BDF8', '#60A5FA', '#818CF8', '#A78BFA',
  '#F472B6', '#FB923C', '#FACC15', '#EF4444',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CategoryFormModal() {
  const isOpen = useCategoryFormStore((s) => s.isOpen);
  const editingCategory = useCategoryFormStore((s) => s.editingCategory);
  const close = useCategoryFormStore((s) => s.close);
  const createCategory = useCategoriesStore((s) => s.createCategory);
  const updateCategory = useCategoriesStore((s) => s.updateCategory);

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Populate form when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (editingCategory) {
      setName(editingCategory.name);
      setColor(editingCategory.color ?? COLOR_PALETTE[0]);
    } else {
      setName('');
      setColor(COLOR_PALETTE[0]);
    }
  }, [isOpen, editingCategory]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Category name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: name.trim(),
          color,
        });
      } else {
        await createCategory({ name: name.trim(), color });
      }
      close();
    } catch (err) {
      console.error('[CategoryForm] Save failed:', err);
      setErrors({
        submit: err instanceof Error ? err.message : 'Failed to save category',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const title = editingCategory ? 'Edit Category' : 'New Category';

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errors.submit && (
          <div className="px-3 py-2 rounded bg-status-skipped/10 border border-status-skipped/30 text-status-skipped text-small">
            {errors.submit}
          </div>
        )}

        {/* Name */}
        <Input
          label="Category Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev }));
          }}
          placeholder="e.g. Health, Work, Mindfulness"
          error={errors.name}
          autoFocus
        />

        {/* Color picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-small font-medium text-text-secondary">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  color === c
                    ? 'border-text-primary scale-110'
                    : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          {/* Live preview */}
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-small text-text-secondary">
              {name.trim() || 'Preview'} — {color}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting
              ? 'Saving...'
              : editingCategory
                ? 'Save Changes'
                : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
