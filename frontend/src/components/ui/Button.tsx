import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500/40 disabled:bg-brand-500/40 shadow-card active:scale-[0.98]',
  secondary:
    'bg-terracotta-500 text-cream-50 hover:bg-terracotta-600 focus-visible:ring-terracotta-500/40 disabled:bg-terracotta-500/40 active:scale-[0.98]',
  outline:
    'border border-ink/12 bg-white text-ink hover:border-brand-500/40 hover:bg-cream-50 focus-visible:ring-brand-500/20 active:scale-[0.98]',
  ghost:
    'text-ink hover:bg-ink/5 focus-visible:ring-ink/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100',
        'disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
