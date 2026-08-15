import { create } from 'zustand';
import type { Category, CategoryCreateInput, CategoryUpdateInput } from '../types';

// ---------------------------------------------------------------------------
// Safe API accessor — returns null when running outside Electron (browser dev)
// ---------------------------------------------------------------------------

function api() {
  return typeof window !== 'undefined' && window.habiterAPI
    ? window.habiterAPI
    : null;
}

// ---------------------------------------------------------------------------
// Category CRUD state
// ---------------------------------------------------------------------------

interface CategoriesState {
  categories: Category[];
  loading: boolean;

  loadCategories: () => Promise<void>;
  createCategory: (input: CategoryCreateInput) => Promise<Category>;
  updateCategory: (id: string, changes: CategoryUpdateInput) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],
  loading: false,

  loadCategories: async () => {
    const a = api();
    if (!a) return;
    set({ loading: true });
    try {
      const categories = await a.categories.list();
      set({ categories });
    } catch (err) {
      console.error('[categoriesStore] Failed to load categories:', err);
    } finally {
      set({ loading: false });
    }
  },

  createCategory: async (input) => {
    const a = api();
    if (!a) throw new Error('API not available');
    const category = await a.categories.create(input);
    set((s) => ({ categories: [...s.categories, category] }));
    return category;
  },

  updateCategory: async (id, changes) => {
    const a = api();
    if (!a) throw new Error('API not available');
    const updated = await a.categories.update(id, changes);
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCategory: async (id) => {
    const a = api();
    if (!a) throw new Error('API not available');
    await a.categories.delete(id);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },
}));

// ---------------------------------------------------------------------------
// Category form modal state
// ---------------------------------------------------------------------------

interface CategoryFormState {
  isOpen: boolean;
  editingCategory: Category | null;

  openNew: () => void;
  openEdit: (category: Category) => void;
  close: () => void;
}

export const useCategoryFormStore = create<CategoryFormState>((set) => ({
  isOpen: false,
  editingCategory: null,

  openNew: () => set({ isOpen: true, editingCategory: null }),
  openEdit: (category) => set({ isOpen: true, editingCategory: category }),
  close: () => set({ isOpen: false, editingCategory: null }),
}));
