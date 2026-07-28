import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardVariant = 'default' | 'glass' | 'brand' | 'amber' | 'teal' | 'sage' | 'gradient';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: CardVariant;
  /** Opt-in hover-lift for clickable/marketing cards. Off by default so static
   *  form and dashboard cards don't move on hover. */
  interactive?: boolean;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default: 'rounded-2xl bg-white border border-ink/[0.06] shadow-card',
  // Frosted surface: translucent white + backdrop blur for a layered, modern feel
  // over the atmospheric page wash.
  glass: 'rounded-2xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-glass',
  brand: 'rounded-2xl bg-brand-50 border border-brand-200 shadow-brandLift',
  amber: 'rounded-2xl bg-amber-50 border border-amber-200 shadow-amberLift',
  teal: 'rounded-2xl bg-teal-50 border border-teal-200 shadow-tealLift',
  sage: 'rounded-2xl bg-sage-50 border border-sage-200 shadow-sageLift',
  // Rich gradient surface for hero/feature cards (was a flat brand fill).
  gradient: 'rounded-2xl bg-gradient-brand text-white border border-brand-600/40 shadow-brandLift',
};

export function Card({
  className,
  children,
  variant = 'default',
  interactive = false,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        VARIANT_CLASSES[variant],
        'p-6',
        interactive && 'transition-all duration-300 hover:-translate-y-1 hover:shadow-brandLiftHover',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-eyebrow text-muted', className)}>
      {children}
    </p>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn('h-display text-xl text-ink mt-2', className)}>{children}</h3>
  );
}
