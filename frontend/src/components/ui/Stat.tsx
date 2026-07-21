import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type StatTone = 'neutral' | 'sage' | 'terracotta' | 'brand' | 'amber' | 'teal';

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: 'border-ink/8 bg-cream-50 shadow-card',
  sage: 'border-sage-200 bg-sage-50 shadow-card',
  terracotta: 'border-terracotta-200 bg-terracotta-50 shadow-card',
  brand: 'border-brand-200 bg-brand-50 shadow-card',
  amber: 'border-amber-200 bg-amber-50 shadow-card',
  teal: 'border-teal-200 bg-teal-50 shadow-card',
};

const VALUE_CLASSES: Record<StatTone, string> = {
  neutral: 'text-ink',
  sage: 'text-sage-600',
  terracotta: 'text-terracotta-700',
  brand: 'text-brand-700',
  amber: 'text-amber-700',
  teal: 'text-teal-700',
};

// Stable rotation used when no explicit tone is given, so dashboards full of
// stat tiles come out colourful (and the same label always gets the same hue).
const AUTO_TONES: StatTone[] = ['brand', 'teal', 'amber', 'sage', 'terracotta'];

function autoTone(seed: string): StatTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AUTO_TONES[Math.abs(hash) % AUTO_TONES.length] as StatTone;
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  const resolved = tone ?? autoTone(label);
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition hover:-translate-y-0.5',
        TONE_CLASSES[resolved],
        className,
      )}
    >
      <p className="text-eyebrow text-muted">{label}</p>
      <p className={cn('h-display text-2xl mt-2 tabular-nums', VALUE_CLASSES[resolved])}>{value}</p>
      {sub ? <p className="text-xs text-muted mt-1">{sub}</p> : null}
    </div>
  );
}
