import { cn } from '@/lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  'aria-label'?: string;
  className?: string;
}

const SIZES = {
  sm: { track: 'h-4 w-7', knob: 'h-3 w-3', shift: 'translate-x-3' },
  md: { track: 'h-5 w-9', knob: 'h-4 w-4', shift: 'translate-x-4' },
} as const;

/** Accessible toggle styled with the ink/sage palette. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
  ...rest
}: SwitchProps) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:cursor-not-allowed disabled:opacity-50',
        s.track,
        checked ? 'bg-sage-500' : 'bg-ink/15',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'inline-block transform rounded-full bg-white shadow-sm transition-transform duration-200',
          'ml-0.5',
          s.knob,
          checked ? s.shift : 'translate-x-0',
        )}
      />
    </button>
  );
}
