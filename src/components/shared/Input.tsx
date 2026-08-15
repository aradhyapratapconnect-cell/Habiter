import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-small font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 bg-bg-elevated border rounded-input text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-colors ${
            error ? 'border-status-skipped' : 'border-border-subtle'
          } ${className}`}
          {...props}
        />
        {error && <p className="text-xs text-status-skipped">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
