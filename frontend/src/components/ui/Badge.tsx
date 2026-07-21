import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'sage' | 'terracotta' | 'ink' | 'brand' | 'amber' | 'teal';

const tones: Record<Tone, string> = {
  neutral: 'bg-white border border-ink/8 text-ink',
  sage: 'bg-sage-100 border border-sage-300/70 text-sage-600',
  terracotta: 'bg-terracotta-100 border border-terracotta-200 text-terracotta-700',
  ink: 'bg-ink text-cream-50',
  brand: 'bg-brand-100 border border-brand-200 text-brand-700',
  amber: 'bg-amber-100 border border-amber-200 text-amber-700',
  teal: 'bg-teal-100 border border-teal-200 text-teal-700',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
