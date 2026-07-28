import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

/**
 * Native `<select>` styled to match `Input` — same height, radius, border, and
 * brand focus ring — with a leading-agnostic trailing chevron. Pass `<option>`s
 * as children.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'w-full appearance-none rounded-xl border border-ink/12 bg-white px-4 pr-10 h-11 text-ink',
          'shadow-edge',
          'hover:border-ink/20 cursor-pointer',
          'focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:bg-white',
          'transition duration-200',
          error && 'border-terracotta-500/60 focus:border-terracotta-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4',
          error ? 'text-terracotta-500' : 'text-brand-500',
        )}
      />
    </div>
  );
});
