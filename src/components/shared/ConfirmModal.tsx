import { useState, useEffect, useRef } from 'react';
import { useConfirmModalStore } from '../../stores/habitsStore';
import Button from './Button';
import Input from './Input';

/**
 * Global confirm modal driven by useConfirmModalStore.
 * Renders nothing when closed.
 */
export default function ConfirmModal() {
  const isOpen = useConfirmModalStore((s) => s.isOpen);
  const title = useConfirmModalStore((s) => s.title);
  const message = useConfirmModalStore((s) => s.message);
  const confirmLabel = useConfirmModalStore((s) => s.confirmLabel);
  const confirmInputPlaceholder = useConfirmModalStore((s) => s.confirmInputPlaceholder);
  const requiresInput = useConfirmModalStore((s) => s.requiresInput);
  const onConfirm = useConfirmModalStore((s) => s.onConfirm);
  const close = useConfirmModalStore((s) => s.close);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      // Auto-focus the input field if one is required
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = !requiresInput || inputValue.trim().length > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm();
    close();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={close}
    >
      <div className="absolute inset-0 bg-bg-primary/80" />

      <div
        className="relative z-10 w-full max-w-md mx-4 bg-bg-elevated rounded-modal border border-border-subtle shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <h3 className="text-h2 font-semibold text-text-primary mb-2">{title}</h3>
          <p className="text-body text-text-secondary whitespace-pre-line">{message}</p>

          {requiresInput && (
            <div className="mt-4">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={confirmInputPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
