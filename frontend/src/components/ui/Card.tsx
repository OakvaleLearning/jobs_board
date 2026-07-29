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
  // Clean, minimal surfaces: hairline borders + a whisper of shadow at rest.
  // Accent variants read as flat tints, not coloured glows.
  default: 'rounded-2xl bg-white border border-ink/[0.06] shadow-sm',
  // Frosted surface: translucent white + backdrop blur for a layered, modern feel
  // over the atmospheric page wash.
  glass: 'rounded-2xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-sm',
  brand: 'rounded-2xl bg-brand-50 border border-brand-200 shadow-sm',
  amber: 'rounded-2xl bg-amber-50 border border-amber-200 shadow-sm',
  teal: 'rounded-2xl bg-teal-50 border border-teal-200 shadow-sm',
  sage: 'rounded-2xl bg-sage-50 border border-sage-200 shadow-sm',
  // Rich gradient surface, reserved for the single hero/feature moment.
  gradient: 'rounded-2xl bg-gradient-brand text-white border border-brand-600/40 shadow-sm',
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
        interactive &&
          'transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/10 hover:shadow-lg',
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
