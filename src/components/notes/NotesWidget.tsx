import { useCallback, useEffect, useRef, useState } from 'react';
import { useCheckinsStore } from '../../stores/checkinsStore';

// ---------------------------------------------------------------------------
// Safe API accessor
// ---------------------------------------------------------------------------

function api() {
  return typeof window !== 'undefined' && window.habiterAPI
    ? window.habiterAPI
    : null;
}

// ---------------------------------------------------------------------------
// Month names
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// NotesWidget Component (TICKET-024)
// ---------------------------------------------------------------------------

/**
 * Per-month free-text notes card for the dashboard footer.
 *
 * Stores one note per month in the settings table with key format
 * `note_YYYY-MM`. The note auto-saves when the textarea loses focus.
 */
export default function NotesWidget() {
  const year = useCheckinsStore((s) => s.year);
  const month = useCheckinsStore((s) => s.month);

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastKeyRef = useRef<string>('');

  // Build the settings key for the current month
  const settingsKey = `note_${year}-${String(month + 1).padStart(2, '0')}`;

  // Load the note when the month changes
  useEffect(() => {
    let cancelled = false;

    async function loadNote() {
      const a = api();
      if (!a) return;
      try {
        const value = await a.settings.get(settingsKey);
        if (!cancelled) {
          setNote(value ?? '');
          setLoaded(true);
          lastKeyRef.current = settingsKey;
        }
      } catch (err) {
        console.error('[NotesWidget] Failed to load note:', err);
        if (!cancelled) setLoaded(true);
      }
    }

    loadNote();
    return () => { cancelled = true; };
  }, [settingsKey]);

  // Save the note to settings
  const saveNote = useCallback(async (value: string) => {
    const a = api();
    if (!a) return;
    setSaving(true);
    try {
      if (value.trim() === '') {
        // Delete the setting if the note is empty
        await a.settings.delete(settingsKey);
      } else {
        await a.settings.set(settingsKey, value);
      }
      lastKeyRef.current = settingsKey;
    } catch (err) {
      console.error('[NotesWidget] Failed to save note:', err);
    } finally {
      setSaving(false);
    }
  }, [settingsKey]);

  // Save on blur — only if content changed
  function handleBlur() {
    if (note !== '' || lastKeyRef.current === settingsKey) {
      // If note is non-empty or we already loaded this key, save if changed
      saveNote(note);
    } else {
      // Note is empty and we haven't saved for this key yet — just delete
      saveNote('');
    }
  }

  return (
    <section className="bg-bg-secondary border border-border-subtle rounded-card px-5 py-4 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-h2 font-semibold text-text-primary flex items-center gap-2">
          Notes
          <span className="text-lg">📝</span>
        </h3>
        {saving && (
          <span className="text-[10px] text-text-disabled animate-pulse">
            Saving…
          </span>
        )}
      </div>
      <p className="text-small text-text-secondary mb-3">
        {MONTH_NAMES[month]} {year}
      </p>

      {!loaded ? (
        <div className="flex-1 flex items-center justify-center py-4 text-text-secondary text-body">
          Loading…
        </div>
      ) : (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleBlur}
          placeholder="Consistency is more important than perfection. Keep showing up for yourself! 💚"
          className="flex-1 min-h-[80px] w-full px-3 py-2 bg-bg-elevated border border-border-subtle rounded-input text-body text-text-primary placeholder:text-text-disabled resize-none focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-colors"
        />
      )}
    </section>
  );
}
