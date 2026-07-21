import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { guessFieldIcon } from '@/lib/field-icons';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn('text-label text-muted', className)}
        {...props}
      />
    );
  },
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  /** Leading icon. Omit to auto-infer from type/name; pass `null` to opt out. */
  icon?: LucideIcon | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, icon, type, ...props },
  ref,
) {
  // Checkboxes/radios are not text fields — render them bare, no icon wrapper.
  const isToggle = type === 'checkbox' || type === 'radio';
  const Icon = isToggle
    ? null
    : icon === null
      ? null
      : icon ?? guessFieldIcon({ type, name: props.name, placeholder: props.placeholder, kind: 'input' });

  // Validation messages surface as toasts on submit; the `error` prop here only
  // drives the visual/a11y invalid state on the field itself.
  const input = (
    <input
      ref={ref}
      type={type}
      aria-invalid={error ? 'true' : undefined}
      className={cn(
        'w-full rounded-xl border border-ink/12 bg-white px-4 h-11 text-ink',
        'placeholder:text-muted-soft',
        'shadow-edge',
        'focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:bg-white',
        'transition',
        Icon && 'pl-10',
        error && 'border-terracotta-500/60 focus:border-terracotta-500',
        className,
      )}
      {...props}
    />
  );

  if (!Icon) return input;

  return (
    <div className="relative">
      <Icon
        className={cn(
          'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4',
          error ? 'text-terracotta-500' : 'text-brand-500',
        )}
      />
      {input}
    </div>
  );
});
