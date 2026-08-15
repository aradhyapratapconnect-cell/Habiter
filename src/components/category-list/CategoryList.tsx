import { useState } from 'react';
import { useCategoriesStore, useCategoryFormStore } from '../../stores/categoriesStore';
import { useHabitsStore } from '../../stores/habitsStore';
import CategoryFormModal from '../category-form/CategoryFormModal';
import CategoryDeleteModal from '../category-form/CategoryDeleteModal';

export default function CategoryList() {
  const categories = useCategoriesStore((s) => s.categories);
  const habits = useHabitsStore((s) => s.habits);
  const openNew = useCategoryFormStore((s) => s.openNew);
  const openEdit = useCategoryFormStore((s) => s.openEdit);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  function habitCount(categoryId: string): number {
    return habits.filter(
      (h) => h.category_id === categoryId && h.is_archived === 0,
    ).length;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold text-text-primary">Categories</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-primary text-bg-primary rounded-button text-small font-semibold hover:bg-accent-primary-hover transition-colors active:scale-[0.97]"
        >
          <span className="text-base leading-none">+</span>
          Add Category
        </button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-3xl mb-2">🏷️</div>
          <p className="text-body text-text-secondary">
            No categories yet. Create one to organize your habits.
          </p>
        </div>
      )}

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {categories.map((cat) => {
          const count = habitCount(cat.id);
          return (
            <div
              key={cat.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-bg-secondary border border-border-subtle rounded-card hover:border-accent-primary/20 transition-colors group"
            >
              {/* Color swatch */}
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color ?? 'var(--text-secondary)' }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="text-body font-medium text-text-primary truncate block">
                  {cat.name}
                </span>
                <span className="text-small text-text-secondary">
                  {count} habit{count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Actions — visible on hover */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(cat)}
                  className="p-1.5 rounded-button text-text-secondary hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() =>
                    setDeleteTarget({ id: cat.id, name: cat.name })
                  }
                  className="p-1.5 rounded-button text-text-secondary hover:text-status-skipped hover:bg-status-skipped/10 transition-colors"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <CategoryFormModal />
      <CategoryDeleteModal
        isOpen={deleteTarget !== null}
        categoryId={deleteTarget?.id ?? null}
        categoryName={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
