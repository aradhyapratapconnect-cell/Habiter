interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive';
  children: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-accent-primary text-bg-primary hover:bg-accent-primary-hover font-semibold',
  secondary:
    'bg-transparent border border-border-subtle text-text-primary hover:bg-bg-elevated',
  destructive:
    'bg-transparent border border-status-skipped text-status-skipped hover:bg-status-skipped/10 font-semibold',
};

export default function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-button text-body transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
